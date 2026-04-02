import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type InvoiceData = {
  invoiceNumber: string;
  createdAt: Date;
  amountGross: number;
  currency: string;
  buyerType: string;
  companyName?: string | null;
  nip?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  invoiceEmail?: string | null;
  itemName?: string | null;
  quantity?: number | null;
};

function sanitizePdfText(value: string | null | undefined) {
  if (!value) return "";

  return value
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z")
    .replace(/Ą/g, "A")
    .replace(/Ć/g, "C")
    .replace(/Ę/g, "E")
    .replace(/Ł/g, "L")
    .replace(/Ń/g, "N")
    .replace(/Ó/g, "O")
    .replace(/Ś/g, "S")
    .replace(/Ź/g, "Z")
    .replace(/Ż/g, "Z");
}

export async function generateInvoicePdf(invoice: InvoiceData) {
  const dir = path.join(process.cwd(), "public", "invoices");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeFileName = invoice.invoiceNumber.replace(/[\/\\:*?"<>|]/g, "-");
  const fileName = `${safeFileName}.pdf`;
  const filePath = path.join(dir, fileName);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 60;
  const left = 50;

  const drawText = (
    text: string,
    x: number,
    size = 11,
    bold = false,
    color = rgb(0, 0, 0)
  ) => {
    page.drawText(sanitizePdfText(text), {
      x,
      y,
      size,
      font: bold ? fontBold : fontRegular,
      color,
    });
    y -= size + 7;
  };

  drawText("FAKTURA", left, 22, true);
  y -= 10;

  drawText(`Numer faktury: ${invoice.invoiceNumber}`, left);
  drawText(
    `Data wystawienia: ${invoice.createdAt.toLocaleDateString("pl-PL")}`,
    left
  );
  drawText(`Waluta: ${invoice.currency}`, left);

  y -= 16;
  drawText("Sprzedawca", left, 13, true);
  drawText("TylkoDzialki", left);
  drawText("Polska", left);

  y -= 16;
  drawText("Nabywca", left, 13, true);

  if (invoice.buyerType === "company") {
    drawText(invoice.companyName || "—", left);
    if (invoice.nip) drawText(`NIP: ${invoice.nip}`, left);
    if (invoice.addressLine1) drawText(invoice.addressLine1, left);
    if (invoice.addressLine2) drawText(invoice.addressLine2, left);
    if (invoice.postalCode || invoice.city) {
      drawText(
        `${invoice.postalCode || ""} ${invoice.city || ""}`.trim(),
        left
      );
    }
    if (invoice.country) drawText(invoice.country, left);
    if (invoice.invoiceEmail) drawText(invoice.invoiceEmail, left);
  } else {
    drawText("Osoba prywatna", left);
    if (invoice.invoiceEmail) drawText(invoice.invoiceEmail, left);
  }

  y -= 16;
  drawText("Pozycja", left, 13, true);
  drawText(`Nazwa: ${invoice.itemName || "Usluga"}`, left);
  drawText(`Ilosc: ${invoice.quantity || 1}`, left);
  drawText(
    `Kwota brutto: ${(invoice.amountGross / 100).toFixed(2)} ${invoice.currency}`,
    left
  );

  y -= 28;
  page.drawText(sanitizePdfText("Dziekujemy za zakup."), {
    x: left,
    y,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
    publicPath: `/invoices/${fileName}`,
  };
}