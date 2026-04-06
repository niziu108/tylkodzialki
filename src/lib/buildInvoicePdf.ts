import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

const VAT_RATE = 23;
const BRAND_HEX = '#7aa333';

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(r, g, b);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('pl-PL');
}

function formatMoney(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function safeText(value?: string | null) {
  return (value ?? '').trim();
}

type InvoicePdfInput = {
  invoiceNumber?: string | null;
  createdAt: Date | string;
  amountGross: number;
  currency?: string | null;
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
  itemName?: string | null;
  quantity?: number | null;
  type?: string | null;
  metadata?: Record<string, string | undefined> | null;
};

function getItemName(invoice: InvoicePdfInput) {
  if (invoice.itemName && safeText(invoice.itemName)) {
    return safeText(invoice.itemName);
  }

  if (invoice.type === 'FEATURED') {
    if (invoice.metadata?.featuredCredits === '3') return 'Pakiet 3 wyróżnień';
    return 'Wyróżnienie ogłoszenia';
  }

  if (invoice.metadata?.packageType === 'SINGLE') return 'Pakiet 1 ogłoszenie';
  if (invoice.metadata?.packageType === 'TEN') return 'Pakiet 10 ogłoszeń';
  if (invoice.metadata?.packageType === 'FORTY') return 'Pakiet 40 ogłoszeń';

  if (invoice.type === 'PACKAGE') return 'Pakiet publikacji';

  return 'Usługa';
}

export async function buildInvoicePdf(invoice: InvoicePdfInput) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const marginX = 50;
  let y = pageHeight - 55;

  const colorText = rgb(0.09, 0.09, 0.09);
  const colorMuted = rgb(0.42, 0.42, 0.42);
  const colorLine = rgb(0.88, 0.88, 0.88);
  const colorBrand = hexToRgb(BRAND_HEX);
  const colorSoft = rgb(0.97, 0.98, 0.95);

  const regularFontPath = path.join(
    process.cwd(),
    'public',
    'fonts',
    'Inter-Regular.ttf'
  );
  const boldFontPath = path.join(
    process.cwd(),
    'public',
    'fonts',
    'Inter-Bold.ttf'
  );
  const logoPath = path.join(process.cwd(), 'public', 'logomail.png');

  if (!fs.existsSync(regularFontPath)) {
    throw new Error(`Brak pliku fontu: ${regularFontPath}`);
  }

  if (!fs.existsSync(boldFontPath)) {
    throw new Error(`Brak pliku fontu: ${boldFontPath}`);
  }

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Brak pliku logo: ${logoPath}`);
  }

  const regularFontBytes = fs.readFileSync(regularFontPath);
  const boldFontBytes = fs.readFileSync(boldFontPath);
  const logoBytes = fs.readFileSync(logoPath);

  const fontRegular = await pdfDoc.embedFont(regularFontBytes);
  const fontBold = await pdfDoc.embedFont(boldFontBytes);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const logoDims = logoImage.scale(0.22);

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options?: {
      size?: number;
      font?: 'regular' | 'bold';
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    }
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size: options?.size ?? 10,
      font: options?.font === 'bold' ? fontBold : fontRegular,
      color: options?.color ?? colorText,
      maxWidth: options?.maxWidth,
      lineHeight: (options?.size ?? 10) * 1.25,
    });
  };

  const drawRightText = (
    text: string,
    rightX: number,
    yPos: number,
    options?: {
      size?: number;
      font?: 'regular' | 'bold';
      color?: ReturnType<typeof rgb>;
    }
  ) => {
    const size = options?.size ?? 10;
    const font = options?.font === 'bold' ? fontBold : fontRegular;
    const width = font.widthOfTextAtSize(text, size);

    page.drawText(text, {
      x: rightX - width,
      y: yPos,
      size,
      font,
      color: options?.color ?? colorText,
    });
  };

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: marginX, y: yPos },
      end: { x: pageWidth - marginX, y: yPos },
      thickness: 0.8,
      color: colorLine,
    });
  };

  const wrapText = (text: string, font: any, size: number, maxWidth: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const drawParagraph = (
    text: string,
    x: number,
    startY: number,
    options?: {
      size?: number;
      font?: 'regular' | 'bold';
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
      lineGap?: number;
    }
  ) => {
    const size = options?.size ?? 10;
    const font = options?.font === 'bold' ? fontBold : fontRegular;
    const color = options?.color ?? colorText;
    const maxWidth = options?.maxWidth ?? 200;
    const lineGap = options?.lineGap ?? 4;

    const lines = wrapText(text, font, size, maxWidth);
    let currentY = startY;

    for (const line of lines) {
      page.drawText(line, {
        x,
        y: currentY,
        size,
        font,
        color,
      });
      currentY -= size + lineGap;
    }

    return {
      endY: currentY,
      height: startY - currentY,
      linesCount: lines.length,
    };
  };

  const gross = Number(invoice.amountGross || 0) / 100;
  const net = gross / (1 + VAT_RATE / 100);
  const vat = gross - net;
  const quantity = Number(invoice.quantity || 1);

  page.drawRectangle({
    x: 0,
    y: pageHeight - 10,
    width: pageWidth,
    height: 10,
    color: colorBrand,
  });

  page.drawImage(logoImage, {
    x: marginX,
    y: pageHeight - 78,
    width: logoDims.width,
    height: logoDims.height,
  });

  drawRightText('FAKTURA VAT', pageWidth - marginX, pageHeight - 52, {
    size: 22,
    font: 'bold',
    color: colorText,
  });

  drawRightText(invoice.invoiceNumber ?? '-', pageWidth - marginX, pageHeight - 76, {
    size: 11,
    font: 'regular',
    color: colorMuted,
  });

  y = pageHeight - 120;

  drawText('Data wystawienia', marginX, y, { size: 9, color: colorMuted });
  drawText(formatDate(invoice.createdAt), marginX, y - 14, {
    size: 11,
    font: 'bold',
  });

  drawText('Data sprzedaży', marginX + 170, y, { size: 9, color: colorMuted });
  drawText(formatDate(invoice.createdAt), marginX + 170, y - 14, {
    size: 11,
    font: 'bold',
  });

  drawText('Waluta', marginX + 340, y, { size: 9, color: colorMuted });
  drawText((invoice.currency || 'PLN').toUpperCase(), marginX + 340, y - 14, {
    size: 11,
    font: 'bold',
  });

  y -= 42;
  drawLine(y);
  y -= 28;

  const boxTop = y;
  const boxHeight = 145;
  const leftBoxX = marginX;
  const rightBoxX = 305;
  const boxWidth = 240;
  const innerPadding = 14;
  const textMaxWidth = boxWidth - innerPadding * 2;

  page.drawRectangle({
    x: leftBoxX,
    y: boxTop - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: colorSoft,
    borderColor: colorLine,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: rightBoxX,
    y: boxTop - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: colorLine,
    borderWidth: 1,
  });

  drawText('SPRZEDAWCA', leftBoxX + innerPadding, boxTop - 18, {
    size: 9,
    font: 'bold',
    color: colorBrand,
  });

  drawText('NABYWCA', rightBoxX + innerPadding, boxTop - 18, {
    size: 9,
    font: 'bold',
    color: colorBrand,
  });

  const sellerLines = [
    'Ultima Reality Sp. z o.o.',
    'Łódź 90-265',
    'Piotrkowska 44/10',
    'NIP: 7252337429',
  ];

  const buyerLines = [
    invoice.buyerType === 'COMPANY'
      ? safeText(invoice.companyName || 'Firma')
      : safeText(invoice.buyerName || 'Osoba prywatna'),
    safeText(invoice.addressLine1 || ''),
    safeText(invoice.addressLine2 || ''),
    [safeText(invoice.postalCode || ''), safeText(invoice.city || '')]
      .filter(Boolean)
      .join(' '),
    invoice.nip ? `NIP: ${invoice.nip}` : '',
    safeText(invoice.invoiceEmail || ''),
  ].filter(Boolean);

  let sellerY = boxTop - 40;
  for (const line of sellerLines) {
    const result = drawParagraph(line, leftBoxX + innerPadding, sellerY, {
      size: 10,
      maxWidth: textMaxWidth,
    });
    sellerY = result.endY - 2;
  }

  let buyerY = boxTop - 40;
  for (const line of buyerLines) {
    const result = drawParagraph(line, rightBoxX + innerPadding, buyerY, {
      size: 10,
      maxWidth: textMaxWidth,
    });
    buyerY = result.endY - 2;
  }

  y = boxTop - boxHeight - 30;

  page.drawRectangle({
    x: marginX,
    y: y - 24,
    width: pageWidth - marginX * 2,
    height: 24,
    color: colorBrand,
  });

  const colLp = 60;
  const colName = 95;
  const colQty = 315;
  const colNetRight = 435;
  const colVatRight = 490;
  const colGrossRight = 540;

  drawText('LP', colLp, y - 16, {
    size: 9,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawText('NAZWA', colName, y - 16, {
    size: 9,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawText('ILOŚĆ', colQty, y - 16, {
    size: 9,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawRightText('NETTO', colNetRight, y - 16, {
    size: 9,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawRightText(`VAT ${VAT_RATE}%`, colVatRight, y - 16, {
    size: 9,
    font: 'bold',
    color: rgb(1, 1, 1),
  });
  drawRightText('BRUTTO', colGrossRight, y - 16, {
    size: 9,
    font: 'bold',
    color: rgb(1, 1, 1),
  });

  y -= 24;

  page.drawRectangle({
    x: marginX,
    y: y - 34,
    width: pageWidth - marginX * 2,
    height: 34,
    borderColor: colorLine,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  drawText('1', colLp, y - 21, { size: 10 });
  drawText(getItemName(invoice), colName, y - 21, {
    size: 10,
    maxWidth: 190,
  });
  drawText(String(quantity), colQty, y - 21, { size: 10 });
  drawRightText(formatMoney(net), colNetRight, y - 21, { size: 10 });
  drawRightText(formatMoney(vat), colVatRight, y - 21, { size: 10 });
  drawRightText(formatMoney(gross), colGrossRight, y - 21, {
    size: 10,
    font: 'bold',
  });

  y -= 58;

  const summaryX = 350;
  const summaryW = 195;
  const summaryTop = y;

  page.drawRectangle({
    x: summaryX,
    y: summaryTop - 78,
    width: summaryW,
    height: 78,
    color: colorSoft,
    borderColor: colorLine,
    borderWidth: 1,
  });

  drawText('Razem netto', summaryX + 14, summaryTop - 18, {
    size: 10,
    color: colorMuted,
  });
  drawRightText(`${formatMoney(net)} PLN`, summaryX + summaryW - 14, summaryTop - 18, {
    size: 10,
    font: 'bold',
  });

  drawText(`VAT ${VAT_RATE}%`, summaryX + 14, summaryTop - 38, {
    size: 10,
    color: colorMuted,
  });
  drawRightText(`${formatMoney(vat)} PLN`, summaryX + summaryW - 14, summaryTop - 38, {
    size: 10,
    font: 'bold',
  });

  drawText('Razem brutto', summaryX + 14, summaryTop - 60, {
    size: 12,
    font: 'bold',
  });
  drawRightText(`${formatMoney(gross)} PLN`, summaryX + summaryW - 14, summaryTop - 60, {
    size: 12,
    font: 'bold',
  });

  y -= 108;

  drawLine(y);
  y -= 24;

  drawText('Dziękujemy za zakup w TylkoDziałki.', marginX, y, {
    size: 10,
    color: colorMuted,
  });
  drawText('tylkodzialki.pl', marginX, y - 16, {
    size: 10,
    font: 'bold',
    color: colorBrand,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}