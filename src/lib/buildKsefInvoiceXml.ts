type BuildKsefInvoiceXmlInput = {
  invoiceNumber: string;
  issueDate: Date | string;
  saleDate?: Date | string | null;
  currency: string;
  amountGross: number; // w groszach
  vatRate?: number;
  quantity?: number;
  itemName?: string | null;

  buyerType?: string | null;
  buyerName?: string | null;
  companyName?: string | null;
  nip?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  invoiceEmail?: string | null;
};

const SELLER = {
  name: "Ultima Reality Sp. z o.o.",
  nip: "7252337429",
  country: "PL",
  addressLine1: "Piotrkowska 44/10",
  addressLine2: "90-265 Łódź",
};

function safe(value?: string | null) {
  return (value ?? "").trim();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTimeZulu(date: Date | string) {
  const d = new Date(date);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function getNetFromGross(gross: number, vatRate: number) {
  return gross / (1 + vatRate / 100);
}

export function buildKsefInvoiceXml(input: BuildKsefInvoiceXmlInput) {
  const vatRate = Number(input.vatRate ?? 23);
  const quantity = Number(input.quantity || 1);
  const currency = safe(input.currency || "PLN").toUpperCase();

  const issueDate = formatDate(input.issueDate);
  const saleDate = formatDate(input.saleDate || input.issueDate);
  const createdAtZulu = formatDateTimeZulu(input.issueDate);

  const gross = Number(input.amountGross || 0) / 100;
  const net = getNetFromGross(gross, vatRate);
  const vat = gross - net;

  const itemName = escapeXml(safe(input.itemName || "Usługa"));

  const buyerType = safe(input.buyerType);
  const isCompany = buyerType === "COMPANY";

  const buyerDisplayName = isCompany
    ? safe(input.companyName || "Firma")
    : safe(input.buyerName || "Osoba prywatna");

  const buyerCountry = safe(input.country || "PL");
  const buyerAddressLine1 = safe(input.addressLine1 || "");
  const buyerAddressLine2 = [
    safe(input.addressLine2 || ""),
    [safe(input.postalCode || ""), safe(input.city || "")]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const sellerNameXml = escapeXml(SELLER.name);
  const sellerAddress1Xml = escapeXml(SELLER.addressLine1);
  const sellerAddress2Xml = escapeXml(SELLER.addressLine2);

  const buyerNameXml = escapeXml(buyerDisplayName);
  const buyerAddress1Xml = escapeXml(buyerAddressLine1 || "—");
  const buyerAddress2Xml = escapeXml(buyerAddressLine2 || "—");

  const buyerIdentificationXml = isCompany
    ? `
      <NIP>${escapeXml(safe(input.nip || ""))}</NIP>
      <Nazwa>${buyerNameXml}</Nazwa>`
    : `
      <BrakID>1</BrakID>
      <Nazwa>${buyerNameXml}</Nazwa>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${createdAtZulu}</DataWytworzeniaFa>
    <SystemInfo>TylkoDzialki</SystemInfo>
  </Naglowek>

  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${escapeXml(SELLER.nip)}</NIP>
      <Nazwa>${sellerNameXml}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>${escapeXml(SELLER.country)}</KodKraju>
      <AdresL1>${sellerAddress1Xml}</AdresL1>
      <AdresL2>${sellerAddress2Xml}</AdresL2>
    </Adres>
  </Podmiot1>

  <Podmiot2>
    <DaneIdentyfikacyjne>${buyerIdentificationXml}
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>${escapeXml(buyerCountry)}</KodKraju>
      <AdresL1>${buyerAddress1Xml}</AdresL1>
      <AdresL2>${buyerAddress2Xml}</AdresL2>
    </Adres>
    <JST>2</JST>
    <GV>2</GV>
  </Podmiot2>

  <Fa>
    <KodWaluty>${escapeXml(currency)}</KodWaluty>
    <P_1>${issueDate}</P_1>
    <P_2>${escapeXml(input.invoiceNumber)}</P_2>
    <P_6>${saleDate}</P_6>

    <P_13_1>${formatAmount(net)}</P_13_1>
    <P_14_1>${formatAmount(vat)}</P_14_1>
    <P_15>${formatAmount(gross)}</P_15>

    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie>
        <P_19N>1</P_19N>
      </Zwolnienie>
      <NoweSrodkiTransportu>
        <P_22N>1</P_22N>
      </NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy>
        <P_PMarzyN>1</P_PMarzyN>
      </PMarzy>
    </Adnotacje>

    <RodzajFaktury>VAT</RodzajFaktury>

    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>${itemName}</P_7>
      <P_8A>szt.</P_8A>
      <P_8B>${formatAmount(quantity)}</P_8B>
      <P_11>${formatAmount(net)}</P_11>
      <P_11Vat>${formatAmount(vat)}</P_11Vat>
      <P_12>${vatRate === 23 ? "23" : formatAmount(vatRate)}</P_12>
    </FaWiersz>
  </Fa>

  <Stopka>
    <LiczbaWierszyFaktur>1</LiczbaWierszyFaktur>
    <WartoscWierszyFaktur>${formatAmount(net)}</WartoscWierszyFaktur>
  </Stopka>
</Faktura>`;
}