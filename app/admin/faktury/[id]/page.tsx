import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth-options";
import type {
  InvoiceBuyerType,
  InvoiceStatus,
  KsefStatus,
  SalesInvoiceType,
} from "@prisma/client";

type FakturaDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatMoney(amount: number, currency: string) {
  return `${(amount / 100).toFixed(2)} ${currency}`;
}

function formatDateTime(date?: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("pl-PL");
}

function formatDate(date?: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pl-PL");
}

function getBuyerTypeLabel(buyerType?: InvoiceBuyerType | null) {
  switch (buyerType) {
    case "COMPANY":
      return "Firma";
    case "PRIVATE":
      return "Osoba prywatna";
    default:
      return "—";
  }
}

function getInvoiceTypeLabel(type: SalesInvoiceType) {
  switch (type) {
    case "FEATURED_PACKAGE":
      return "Wyróżnienie";
    case "LISTING_PACKAGE":
      return "Pakiet publikacji";
    default:
      return type;
  }
}

function getInvoiceStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "PAID":
      return "Zapłacono";
    case "PENDING":
      return "Oczekuje";
    case "FAILED":
      return "Błąd";
    case "REFUNDED":
      return "Zwrot";
    default:
      return status;
  }
}

function getKsefStatusLabel(status: KsefStatus) {
  switch (status) {
    case "READY":
      return "Gotowa";
    case "SENT":
      return "Wysłana";
    case "ACCEPTED":
      return "Zaakceptowana";
    case "ERROR":
      return "Błąd";
    default:
      return status;
  }
}

function getInvoiceStatusBadgeClass(status: InvoiceStatus) {
  switch (status) {
    case "PAID":
      return "bg-[#7aa333]/20 text-[#9fd14b] border border-[#7aa333]/20";
    case "PENDING":
      return "bg-white/10 text-white/80 border border-white/10";
    case "FAILED":
      return "bg-red-500/15 text-red-300 border border-red-500/20";
    case "REFUNDED":
      return "bg-orange-500/15 text-orange-300 border border-orange-500/20";
    default:
      return "bg-white/10 text-white/80 border border-white/10";
  }
}

function getBuyerTypeBadgeClass(buyerType?: InvoiceBuyerType | null) {
  switch (buyerType) {
    case "COMPANY":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
    case "PRIVATE":
      return "bg-white/10 text-white/80 border border-white/10";
    default:
      return "bg-white/5 text-white/50 border border-white/10";
  }
}

function getKsefStatusBadgeClass(status: KsefStatus) {
  switch (status) {
    case "READY":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    case "SENT":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
    case "ACCEPTED":
      return "bg-[#7aa333]/20 text-[#9fd14b] border border-[#7aa333]/20";
    case "ERROR":
      return "bg-red-500/15 text-red-300 border border-red-500/20";
    default:
      return "bg-white/10 text-white/80 border border-white/10";
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-1 text-xs uppercase tracking-wide text-[#8f8f8f]">
        {label}
      </div>
      <div className="text-sm text-white">{value || "—"}</div>
    </div>
  );
}

export default async function FakturaDetailsPage({
  params,
}: FakturaDetailsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      email: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const buyerDisplay =
    invoice.buyerType === "COMPANY"
      ? invoice.companyName || invoice.buyerName || "Firma"
      : invoice.buyerName || invoice.invoiceEmail || "Osoba prywatna";

  return (
    <main className="min-h-screen bg-[#131313] px-6 py-10 text-[#d9d9d9]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/faktury"
                className="text-sm text-[#bdbdbd] transition hover:text-white"
              >
                ← Powrót do listy faktur
              </Link>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Szczegóły faktury
            </h1>
            <p className="mt-2 text-sm text-[#bdbdbd]">
              Podgląd pełnych danych dokumentu, statusu płatności i gotowości do KSeF.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/invoices/${invoice.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#7aa333] px-5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Otwórz PDF
            </a>
          </div>
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm text-[#8f8f8f]">Numer faktury</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {invoice.invoiceNumber || "—"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getInvoiceStatusBadgeClass(
                  invoice.status
                )}`}
              >
                {getInvoiceStatusLabel(invoice.status)}
              </span>

              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getBuyerTypeBadgeClass(
                  invoice.buyerType
                )}`}
              >
                {getBuyerTypeLabel(invoice.buyerType)}
              </span>

              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getKsefStatusBadgeClass(
                  invoice.ksefStatus
                )}`}
              >
                KSeF: {getKsefStatusLabel(invoice.ksefStatus)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailItem label="Typ dokumentu" value={getInvoiceTypeLabel(invoice.type)} />
            <DetailItem
              label="Kwota brutto"
              value={formatMoney(invoice.amountGross, invoice.currency)}
            />
            <DetailItem label="Waluta" value={invoice.currency} />
            <DetailItem label="Ilość" value={invoice.quantity} />

            <DetailItem label="Pozycja" value={invoice.itemName || "—"} />
            <DetailItem label="Źródło" value={invoice.source} />
            <DetailItem label="Data wystawienia" value={formatDate(invoice.issuedAt)} />
            <DetailItem label="Data opłacenia" value={formatDateTime(invoice.paidAt)} />
          </div>
        </section>

        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Dane nabywcy
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="Typ nabywcy" value={getBuyerTypeLabel(invoice.buyerType)} />
              <DetailItem label="Wyświetlana nazwa" value={buyerDisplay} />

              <DetailItem label="Imię / nazwa prywatna" value={invoice.buyerName || "—"} />
              <DetailItem label="Nazwa firmy" value={invoice.companyName || "—"} />

              <DetailItem label="NIP" value={invoice.nip || "—"} />
              <DetailItem label="Email faktury" value={invoice.invoiceEmail || "—"} />

              <DetailItem label="Adres 1" value={invoice.addressLine1 || "—"} />
              <DetailItem label="Adres 2" value={invoice.addressLine2 || "—"} />

              <DetailItem label="Kod pocztowy" value={invoice.postalCode || "—"} />
              <DetailItem label="Miasto" value={invoice.city || "—"} />

              <DetailItem label="Kraj" value={invoice.country || "—"} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Powiązanie z kontem i Stripe
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="User ID" value={invoice.userId} />
              <DetailItem label="Email konta" value={invoice.user?.email || "—"} />

              <DetailItem label="Imię konta" value={invoice.user?.name || "—"} />
              <DetailItem label="Stripe session ID" value={invoice.stripeSessionId || "—"} />

              <DetailItem
                label="Stripe payment intent ID"
                value={invoice.stripePaymentIntentId || "—"}
              />
              <DetailItem
                label="Stripe checkout URL"
                value={
                  invoice.stripeCheckoutUrl ? (
                    <a
                      href={invoice.stripeCheckoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-[#9fd14b] hover:underline"
                    >
                      {invoice.stripeCheckoutUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </section>
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xl font-semibold text-white">
              KSeF
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem
                label="Wymagana wysyłka do KSeF"
                value={invoice.ksefRequired ? "Tak" : "Nie"}
              />
              <DetailItem
                label="Status KSeF"
                value={getKsefStatusLabel(invoice.ksefStatus)}
              />

              <DetailItem
                label="Numer referencyjny KSeF"
                value={invoice.ksefReferenceNumber || "—"}
              />
              <DetailItem
                label="Numer faktury KSeF"
                value={invoice.ksefInvoiceNumber || "—"}
              />

              <DetailItem
                label="Data wysyłki do KSeF"
                value={formatDateTime(invoice.ksefSentAt)}
              />
              <DetailItem
                label="Data akceptacji KSeF"
                value={formatDateTime(invoice.ksefAcceptedAt)}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-[#8f8f8f]">
                Komunikat błędu KSeF
              </div>
              <div className="whitespace-pre-wrap break-words text-sm text-white">
                {invoice.ksefErrorMessage || "Brak"}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Plik PDF i techniczne
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="PDF path" value={invoice.pdfPath || "—"} />
              <DetailItem label="PDF file name" value={invoice.pdfFileName || "—"} />

              <DetailItem label="ID faktury" value={invoice.id} />
              <DetailItem label="Utworzono" value={formatDateTime(invoice.createdAt)} />

              <DetailItem label="Zaktualizowano" value={formatDateTime(invoice.updatedAt)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/api/invoices/${invoice.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-5 text-sm font-semibold text-white transition hover:border-[#7aa333] hover:bg-[#7aa333]/15"
              >
                Podgląd PDF
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}