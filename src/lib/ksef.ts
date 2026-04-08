import axios from "axios";
import { buildKsefInvoiceXml } from "./buildKsefInvoiceXml";

// TODO: zrobimy osobny plik do podpisu
import { signXmlWithXades } from "./ksefSign";

const BASE_URL = process.env.KSEF_BASE_URL!;

async function authenticateWithCertificate() {
  // 1. XML request
  const xml = `
    <AuthTokenRequest>
      <Context>
        <Identifier>
          <Type>onip</Type>
          <Value>${process.env.KSEF_NIP}</Value>
        </Identifier>
      </Context>
    </AuthTokenRequest>
  `;

  // 2. podpis XAdES
  const signedXml = await signXmlWithXades(xml);

  // 3. wysyłka do KSeF
  const res = await axios.post(
    `${BASE_URL}/auth/online/Session/InitSigned`,
    signedXml,
    {
      headers: {
        "Content-Type": "application/xml",
      },
    }
  );

  const referenceNumber = res.data?.referenceNumber;

  if (!referenceNumber) {
    throw new Error("Brak referenceNumber z KSeF");
  }

  // 4. polling
  let accessToken = null;

  for (let i = 0; i < 10; i++) {
    const statusRes = await axios.get(
      `${BASE_URL}/auth/online/Session/${referenceNumber}`
    );

    if (statusRes.data?.status === "Ready") {
      accessToken = statusRes.data?.accessToken;
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!accessToken) {
    throw new Error("Nie udało się uzyskać accessToken");
  }

  return accessToken;
}

// 🔥 TO MUSI ZOSTAĆ
export async function sendSingleInvoiceToKsef(invoice: any) {
  const token = await authenticateWithCertificate();

  const xml = buildKsefInvoiceXml(invoice);

  const res = await axios.post(
    `${BASE_URL}/invoices/send`,
    xml,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/xml",
      },
    }
  );

  return res.data;
}

// 🔥 TO MUSI ZOSTAĆ
export async function sendReadyInvoicesToKsef(invoices: any[]) {
  for (const invoice of invoices) {
    await sendSingleInvoiceToKsef(invoice);
  }
}