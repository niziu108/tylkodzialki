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
    throw new Error(`KSeF certificates error: ${text}`);
  }

  return await response.json();
}

function pickCertificateForUsage(
  certs: KsefCertificateRecord[],
  usage: "KsefTokenEncryption" | "SymmetricKeyEncryption"
) {
  const now = Date.now();

  const filtered = certs
    .filter((c) => c.usage?.includes(usage))
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
    throw new Error(`Brak certyfikatu KSeF dla ${usage}`);
  }

  return filtered[0];
}

function encryptWithCertificateBase64(base64DerCert: string, input: Buffer) {
  const pem = base64DerToPem(base64DerCert);
  const cert = new X509Certificate(pem);

  return crypto.publicEncrypt(
    {
      key: cert.publicKey,
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
    throw new Error(`KSeF challenge error: ${text}`);
  }

  return await response.json();
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
    Buffer.from(plaintext)
  ).toString("base64");

  // 🔥 POPRAWIONE AUTH (to naprawia Twój błąd 400)
  const payload = {
    challenge: challenge.challenge,
    contextIdentifier: {
      identifier: contextNip,
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
    throw new Error(`KSeF auth error: ${text}`);
  }

  const started = await startResponse.json();

  const authenticationToken = started.authenticationToken?.token;
  const referenceNumber = started.referenceNumber;

  if (!authenticationToken || !referenceNumber) {
    throw new Error("Brak authenticationToken");
  }

  for (let i = 0; i < 10; i++) {
    await sleep(1000);

    const statusResponse = await ksefFetch(
      `/auth/${referenceNumber}`,
      { method: "GET" },
      authenticationToken
    );

    const statusJson = await statusResponse.json();

    if (statusJson.status?.code === 200) break;
  }

  const redeemResponse = await ksefFetch(
    "/auth/token/redeem",
    { method: "POST" },
    authenticationToken
  );

  const redeemed = await redeemResponse.json();

  const accessToken =
    redeemed.accessToken?.token || redeemed.accessToken;

  if (!accessToken) {
    throw new Error("Brak accessToken");
  }

  return { accessToken };
}

function encryptInvoiceXml(xml: string, publicCertBase64: string) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(xml)),
    cipher.final(),
  ]);

  const encryptedDocument = Buffer.concat([iv, encrypted]);

  return {
    encryptedDocumentBase64: encryptedDocument.toString("base64"),
    encryptedSymmetricKeyBase64: encryptWithCertificateBase64(
      publicCertBase64,
      key
    ).toString("base64"),
    originalHashBase64: sha256Base64(Buffer.from(xml)),
    originalSize: Buffer.byteLength(xml),
    encryptedHashBase64: sha256Base64(encryptedDocument),
    encryptedSize: encryptedDocument.length,
  };
}

async function openSession(accessToken: string, cert: string) {
  const payload = {
    formCode: {
      systemCode: "FA (3)",
      schemaVersion: "1-0E",
      value: "FA",
    },
  };

  const res = await ksefFetch(
    "/sessions/online",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    accessToken
  );

  return await res.json();
}

export async function sendSingleInvoiceToKsef(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) throw new Error("Brak faktury");

  const xml = buildKsefInvoiceXml(invoice);

  const certs = await fetchPublicCertificates();
  const cert = pickCertificateForUsage(
    certs,
    "SymmetricKeyEncryption"
  );

  const auth = await authenticateWithKsefToken();

  const session = await openSession(auth.accessToken, cert.certificate);

  const encrypted = encryptInvoiceXml(xml, cert.certificate);

  await ksefFetch(
    `/sessions/online/${session.referenceNumber}/invoices`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encryptedInvoiceContent: encrypted.encryptedDocumentBase64,
      }),
    },
    auth.accessToken
  );

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      ksefStatus: "ACCEPTED",
      ksefAcceptedAt: new Date(),
    },
  });

  return { ok: true };
}