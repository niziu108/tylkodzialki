import crypto, { X509Certificate } from "crypto";
import { prisma } from "@/lib/prisma";
import { buildKsefInvoiceXml } from "@/lib/buildKsefInvoiceXml";

const DEFAULT_BASE_URL =
  process.env.KSEF_BASE_URL || "https://api.ksef.mf.gov.pl/api/v2";

type KsefCertificateRecord = {
  certificate: string;
  certificateId: string;
  validFrom: string;
  validTo: string;
  usage: string[];
  keyId?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64DerToPem(base64Der: string) {
  const chunks = base64Der.match(/.{1,64}/g)?.join("\n") ?? base64Der;
  return `-----BEGIN CERTIFICATE-----\n${chunks}\n-----END CERTIFICATE-----`;
}

async function ksefFetch(
  path: string,
  init?: RequestInit,
  bearerToken?: string
): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Accept", "application/json");

  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  return fetch(`${DEFAULT_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

async function fetchPublicCertificates(): Promise<KsefCertificateRecord[]> {
  const response = await ksefFetch("/security/public-key-certificates", {
    method: "GET",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `KSeF certificates error: ${response.status} ${response.statusText} ${text}`
    );
  }

  return (await response.json()) as KsefCertificateRecord[];
}

function pickCertificateForUsage(
  certs: KsefCertificateRecord[],
  usage: "KsefTokenEncryption" | "SymmetricKeyEncryption"
) {
  const now = Date.now();

  const filtered = certs
    .filter((c) => Array.isArray(c.usage) && c.usage.includes(usage))
    .filter((c) => {
      const from = new Date(c.validFrom).getTime();
      const to = new Date(c.validTo).getTime();
      return from <= now && now <= to;
    })
    .sort(
      (a, b) =>
        new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
    );

  if (!filtered.length) {
    throw new Error(`Nie znaleziono ważnego certyfikatu KSeF dla usage=${usage}`);
  }

  return filtered[0];
}

function encryptWithCertificateBase64(base64DerCert: string, input: Buffer) {
  const pem = base64DerToPem(base64DerCert);
  const cert = new X509Certificate(pem);
  const publicKey = cert.publicKey;

  return crypto.publicEncrypt(
    {
      key: publicKey,
      oaepHash: "sha256",
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    input
  );
}

function sha256Base64(data: Buffer) {
  return crypto.createHash("sha256").update(data).digest("base64");
}

async function getAuthChallenge() {
  const response = await ksefFetch("/auth/challenge", {
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `KSeF auth/challenge error: ${response.status} ${response.statusText} ${text}`
    );
  }

  return (await response.json()) as {
    challenge: string;
    timestamp: number;
  };
}

async function authenticateWithKsefToken() {
  const tokenKsef = getRequiredEnv("KSEF_TOKEN");
  const contextNip = getRequiredEnv("KSEF_NIP");

  const challenge = await getAuthChallenge();
  const certs = await fetchPublicCertificates();
  const authCert = pickCertificateForUsage(certs, "KsefTokenEncryption");

  const plaintext = `${tokenKsef}|${challenge.timestamp}`;
  const encryptedToken = encryptWithCertificateBase64(
    authCert.certificate,
    Buffer.from(plaintext, "utf8")
  ).toString("base64");

  const payload = {
    challenge: challenge.challenge,
    contextIdentifier: {
      type: "onip",
      value: contextNip,
    },
    encryptedToken,
  };

  const startResponse = await ksefFetch("/auth/ksef-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!startResponse.ok) {
    const text = await startResponse.text();
    throw new Error(
      `KSeF auth/ksef-token error: ${startResponse.status} ${startResponse.statusText} ${text}`
    );
  }

  const started = (await startResponse.json()) as {
    authenticationToken?: {
      token?: string;
    };
    referenceNumber?: string;
  };

  const authenticationToken = started.authenticationToken?.token;
  const referenceNumber = started.referenceNumber;

  if (!authenticationToken || !referenceNumber) {
    throw new Error(
      "KSeF auth start response nie zawiera authenticationToken/referenceNumber"
    );
  }

  let statusCode: number | null = null;

  for (let i = 0; i < 15; i++) {
    await sleep(i === 0 ? 400 : 1000);

    const statusResponse = await ksefFetch(
      `/auth/${encodeURIComponent(referenceNumber)}`,
      { method: "GET" },
      authenticationToken
    );

    if (!statusResponse.ok) {
      const text = await statusResponse.text();
      throw new Error(
        `KSeF auth status error: ${statusResponse.status} ${statusResponse.statusText} ${text}`
      );
    }

    const statusJson = (await statusResponse.json()) as {
      status?: {
        code?: number;
        description?: string;
      };
    };

    statusCode = statusJson.status?.code ?? null;

    if (statusCode === 200) {
      break;
    }

    if (statusCode && statusCode !== 100) {
      throw new Error(
        `KSeF auth failed with status=${statusCode} ${statusJson.status?.description ?? ""}`
      );
    }
  }

  if (statusCode !== 200) {
    throw new Error("KSeF auth timeout: nie udało się uzyskać statusu 200");
  }

  const redeemResponse = await ksefFetch(
    "/auth/token/redeem",
    {
      method: "POST",
    },
    authenticationToken
  );

  if (!redeemResponse.ok) {
    const text = await redeemResponse.text();
    throw new Error(
      `KSeF token/redeem error: ${redeemResponse.status} ${redeemResponse.statusText} ${text}`
    );
  }

  const redeemed = (await redeemResponse.json()) as {
    accessToken?: {
      token?: string;
    };
    refreshToken?: {
      token?: string;
    };
  };

  const accessToken =
    redeemed.accessToken?.token || (redeemed as any).accessToken || null;
  const refreshToken =
    redeemed.refreshToken?.token || (redeemed as any).refreshToken || null;

  if (!accessToken) {
    throw new Error("KSeF redeem nie zwrócił accessToken");
  }

  return {
    accessToken,
    refreshToken,
  };
}

function encryptInvoiceXml(xml: string, publicCertBase64: string) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(xml, "utf8")),
    cipher.final(),
  ]);

  const encryptedDocument = Buffer.concat([iv, encrypted]);
  const encryptedKey = encryptWithCertificateBase64(publicCertBase64, key);

  return {
    encryptedDocumentBase64: encryptedDocument.toString("base64"),
    encryptedSymmetricKeyBase64: encryptedKey.toString("base64"),
    initializationVectorBase64: iv.toString("base64"),
    originalHashBase64: sha256Base64(Buffer.from(xml, "utf8")),
    originalSize: Buffer.byteLength(xml, "utf8"),
    encryptedHashBase64: sha256Base64(encryptedDocument),
    encryptedSize: encryptedDocument.length,
  };
}

async function openOnlineSession(
  accessToken: string,
  symmetricCertBase64: string
) {
  const emptyKey = crypto.randomBytes(32);
  const encryptedKey = encryptWithCertificateBase64(
    symmetricCertBase64,
    emptyKey
  ).toString("base64");

  const iv = crypto.randomBytes(16).toString("base64");

  const payload = {
    formCode: {
      systemCode: "FA (3)",
      schemaVersion: "1-0E",
      value: "FA",
    },
    encryption: {
      encryptedSymmetricKey: encryptedKey,
      initializationVector: iv,
    },
  };

  const response = await ksefFetch(
    "/sessions/online",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    accessToken
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `KSeF open session error: ${response.status} ${response.statusText} ${text}`
    );
  }

  return (await response.json()) as {
    referenceNumber: string;
    validUntil?: string;
  };
}

async function sendInvoiceToOnlineSession(
  accessToken: string,
  sessionReferenceNumber: string,
  xml: string,
  symmetricCertBase64: string
) {
  const encrypted = encryptInvoiceXml(xml, symmetricCertBase64);

  const payload = {
    invoiceHash: encrypted.originalHashBase64,
    invoiceSize: encrypted.originalSize,
    encryptedInvoiceHash: encrypted.encryptedHashBase64,
    encryptedInvoiceSize: encrypted.encryptedSize,
    encryptedInvoiceContent: encrypted.encryptedDocumentBase64,
  };

  const response = await ksefFetch(
    `/sessions/online/${encodeURIComponent(sessionReferenceNumber)}/invoices`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    accessToken
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `KSeF send invoice error: ${response.status} ${response.statusText} ${text}`
    );
  }

  return (await response.json()) as {
    referenceNumber?: string;
    invoiceReferenceNumber?: string;
  };
}

async function closeOnlineSession(
  accessToken: string,
  sessionReferenceNumber: string
) {
  const response = await ksefFetch(
    `/sessions/online/${encodeURIComponent(sessionReferenceNumber)}/close`,
    {
      method: "POST",
    },
    accessToken
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `KSeF close session error: ${response.status} ${response.statusText} ${text}`
    );
  }

  return await response.json().catch(() => ({}));
}

export async function sendSingleInvoiceToKsef(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error("Nie znaleziono faktury");
  }

  if (!invoice.ksefRequired) {
    throw new Error("Ta faktura nie jest oznaczona do wysyłki do KSeF");
  }

  if (invoice.ksefStatus !== "READY") {
    throw new Error(`Faktura ma status ${invoice.ksefStatus}, a nie READY`);
  }

  const xml = buildKsefInvoiceXml({
    invoiceNumber: invoice.invoiceNumber || "FAKTURA",
    issueDate: invoice.issuedAt || invoice.createdAt,
    saleDate: invoice.issuedAt || invoice.createdAt,
    currency: invoice.currency,
    amountGross: invoice.amountGross,
    quantity: invoice.quantity,
    itemName: invoice.itemName,
    buyerType: invoice.buyerType,
    buyerName: invoice.buyerName,
    companyName: invoice.companyName,
    nip: invoice.nip,
    addressLine1: invoice.addressLine1,
    addressLine2: invoice.addressLine2,
    postalCode: invoice.postalCode,
    city: invoice.city,
    country: invoice.country,
    invoiceEmail: invoice.invoiceEmail,
  });

  const certs = await fetchPublicCertificates();
  const symmetricCert = pickCertificateForUsage(
    certs,
    "SymmetricKeyEncryption"
  );
  const auth = await authenticateWithKsefToken();

  const session = await openOnlineSession(
    auth.accessToken,
    symmetricCert.certificate
  );

  const sentAt = new Date();

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      ksefStatus: "SENT",
      ksefSentAt: sentAt,
      ksefReferenceNumber: session.referenceNumber,
      ksefErrorMessage: null,
    },
  });

  const sentInvoice = await sendInvoiceToOnlineSession(
    auth.accessToken,
    session.referenceNumber,
    xml,
    symmetricCert.certificate
  );

  await closeOnlineSession(auth.accessToken, session.referenceNumber);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      ksefStatus: "ACCEPTED",
      ksefAcceptedAt: new Date(),
      ksefInvoiceNumber:
        sentInvoice.invoiceReferenceNumber ||
        sentInvoice.referenceNumber ||
        session.referenceNumber,
      ksefErrorMessage: null,
    },
  });

  return {
    invoiceId: invoice.id,
    sessionReferenceNumber: session.referenceNumber,
    invoiceReferenceNumber:
      sentInvoice.invoiceReferenceNumber ||
      sentInvoice.referenceNumber ||
      session.referenceNumber,
  };
}

export async function sendReadyInvoicesToKsef(limit = 5) {
  const invoices = await prisma.invoice.findMany({
    where: {
      ksefRequired: true,
      ksefStatus: "READY",
      status: "PAID",
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
    select: {
      id: true,
    },
  });

  const results: Array<{
    invoiceId: string;
    ok: boolean;
    result?: unknown;
    error?: string;
  }> = [];

  for (const invoice of invoices) {
    try {
      const result = await sendSingleInvoiceToKsef(invoice.id);
      results.push({
        invoiceId: invoice.id,
        ok: true,
        result,
      });
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Nieznany błąd KSeF";

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          ksefStatus: "ERROR",
          ksefErrorMessage: message,
        },
      });

      results.push({
        invoiceId: invoice.id,
        ok: false,
        error: message,
      });
    }
  }

  return results;
}