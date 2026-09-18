import type Stripe from "stripe";
import { InvoiceBuyerType, KsefStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ZakupWyroznien } from "@/lib/zakupWyroznien";

function pad(num: number, size = 4) {
  return String(num).padStart(size, "0");
}

export async function generateInvoiceNumber(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 1, 0, 0, 0, 0);

  const count = await prisma.invoice.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });

  const next = count + 1;

  return `FV/${year}/${String(month).padStart(2, "0")}/${pad(next)}`;
}

export function getItemName(params: {
  type?: string;
  credits?: number;
  featuredCredits?: number;
  packageType?: string;
}) {
  const { type, credits = 0, featuredCredits = 0, packageType } = params;

  if (type === "featured") {
    if (featuredCredits === 1) return "Pakiet 1 wyróżnienia";
    if (featuredCredits === 3) return "Pakiet 3 wyróżnień";
    return `Pakiet wyróżnień (${featuredCredits})`;
  }

  if (packageType === "SINGLE" || credits === 1) {
    return "Pakiet 1 publikacji";
  }

  if (packageType === "PACK_10" || credits === 10) {
    return "Pakiet 10 publikacji";
  }

  if (packageType === "PACK_40" || credits === 40) {
    return "Pakiet 40 publikacji";
  }

  return `Pakiet publikacji (${credits})`;
}

export type ResolvedBuyer = {
  buyerType: InvoiceBuyerType;
  buyerName: string | null;
  companyName: string | null;
  nip: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  invoiceEmail: string | null;
};

export function resolveBuyerFromMetadata(metadata: Record<string, string>): ResolvedBuyer {
  const buyerType: InvoiceBuyerType =
    metadata.buyerType === "company"
      ? InvoiceBuyerType.COMPANY
      : InvoiceBuyerType.PRIVATE;

  const buyerName = (metadata.buyerName || "").trim() || null;
  const companyName = (metadata.companyName || "").trim() || null;
  const nip = (metadata.nip || "").trim() || null;
  const addressLine1 = (metadata.addressLine1 || "").trim() || null;
  const addressLine2 = (metadata.addressLine2 || "").trim() || null;
  const postalCode = (metadata.postalCode || "").trim() || null;
  const city = (metadata.city || "").trim() || null;
  const country = (metadata.country || "").trim() || "PL";
  const invoiceEmail = (metadata.invoiceEmail || "").trim() || null;

  return {
    buyerType,
    buyerName,
    companyName,
    nip,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    country,
    invoiceEmail,
  };
}

async function zaksiegowanieSesji(stripeSessionId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { stripeSessionId },
    select: { paidAt: true, createdAt: true },
  });

  return invoice ? invoice.paidAt ?? invoice.createdAt : null;
}

/* Zakup wyróżnień ze Stripe: punkty i faktura w jednej transakcji. Woła to webhook
 * (checkout.session.completed) i powrót klienta ze Stripe do panelu, bo webhook bywa
 * wolniejszy od przeglądarki, a powrotu nie będzie, gdy klient zamknie kartę (tak zaleca też
 * Stripe). Kto przyjdzie drugi, niczego nie dopisze: fakturę wiąże z sesją unikalne
 * stripeSessionId, a odrzucony zapis faktury cofa w tej samej transakcji dopisanie punktów.
 *
 * Zwraca, czy to ten zapis zaksięgował zakup, i kiedy zakup został zaksięgowany. */
export async function zaksiegujZakupWyroznien(
  session: Stripe.Checkout.Session,
  zakup: ZakupWyroznien
): Promise<{ nowy: boolean; zaksiegowanoAt: Date }> {
  const wczesniej = await zaksiegowanieSesji(session.id);

  if (wczesniej) {
    return { nowy: false, zaksiegowanoAt: wczesniej };
  }

  const buyer = resolveBuyerFromMetadata(session.metadata ?? {});
  const now = new Date();
  const invoiceNumber = await generateInvoiceNumber(now);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: zakup.userId },
        data: {
          featuredCredits: {
            increment: zakup.liczba,
          },
          // Kupione wyróżnienia nie wygasają (obiecuje to strona zakupu), a saldo ma jedną
          // datę ważności, z pakietu przyznanego partnerowi z ręki. Bez jej zdjęcia zakup
          // po wygaśnięciu takiego pakietu dopisywał punkty, których nie dało się wydać,
          // a „Wyróżnij" odsyłał świeżo płacącego klienta z powrotem do zakupu. Jak przy
          // doładowaniu telefonu: zakup przywraca ważność całego salda.
          featuredCreditsExpiresAt: null,
        },
      });

      await tx.invoice.create({
        data: {
          userId: zakup.userId,
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          stripeCheckoutUrl: session.url ?? null,

          invoiceNumber,
          type: "FEATURED_PACKAGE",
          status: "PAID",
          source: "INTERNAL",

          amountGross: session.amount_total ?? 0,
          currency: (session.currency || "pln").toUpperCase(),

          buyerType: buyer.buyerType,
          buyerName:
            buyer.buyerType === InvoiceBuyerType.PRIVATE
              ? buyer.buyerName
              : null,
          companyName:
            buyer.buyerType === InvoiceBuyerType.COMPANY
              ? buyer.companyName
              : null,
          nip:
            buyer.buyerType === InvoiceBuyerType.COMPANY
              ? buyer.nip
              : null,
          addressLine1:
            buyer.buyerType === InvoiceBuyerType.COMPANY
              ? buyer.addressLine1
              : null,
          addressLine2:
            buyer.buyerType === InvoiceBuyerType.COMPANY
              ? buyer.addressLine2
              : null,
          postalCode:
            buyer.buyerType === InvoiceBuyerType.COMPANY
              ? buyer.postalCode
              : null,
          city:
            buyer.buyerType === InvoiceBuyerType.COMPANY
              ? buyer.city
              : null,
          country: buyer.country,
          invoiceEmail:
            buyer.invoiceEmail || session.customer_details?.email || null,

          itemName: getItemName({
            type: "featured",
            featuredCredits: zakup.liczba,
          }),
          quantity: 1,

          issuedAt: now,
          paidAt: now,

          ksefRequired: true,
          ksefStatus: KsefStatus.READY,
        },
      });
    });
  } catch (e) {
    // Webhook i powrót klienta w tej samej chwili: drugi zapis odbija się od unikalnej sesji
    // (albo numeru faktury, policzonego z tego samego stanu). Punkty cofnęła transakcja.
    // Gdy faktury tej sesji nadal nie ma, numer zajął inny zakup: błąd idzie wyżej, a webhook
    // (Stripe ponawia) albo panel (pyta jeszcze raz) spróbują ponownie.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const zapisany = await zaksiegowanieSesji(session.id);

      if (zapisany) {
        return { nowy: false, zaksiegowanoAt: zapisany };
      }
    }

    throw e;
  }

  return { nowy: true, zaksiegowanoAt: now };
}
