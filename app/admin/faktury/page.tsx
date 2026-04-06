import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth-options";
import type {
  InvoiceBuyerType,
  InvoiceStatus,
  KsefStatus,
  SalesInvoiceType,
} from "@prisma/client";

type FakturyPageProps = {
  searchParams?: Promise<{
    q?: string;
    buyerType?: string;
    ksefStatus?: string;
    type?: string;
    status?: string;
  }>;
};

function formatMoney(amount: number, currency: string) {
  return `${(amount / 100).toFixed(2)} ${currency}`;
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

export default async function FakturyAdminPage({
  searchParams,
}: FakturyPageProps) {
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

  const params = await searchParams;
  const q = params?.q?.trim() || "";
  const buyerType = params?.buyerType?.trim() || "";
  const ksefStatus = params?.ksefStatus?.trim() || "";
  const type = params?.type?.trim() || "";
  const status = params?.status?.trim() || "";

  const invoices = await prisma.invoice.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                {
                  invoiceNumber: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  invoiceEmail: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  nip: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  companyName: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  buyerName: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
                {
                  user: {
                    email: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }
          : {},
        buyerType
          ? {
              buyerType: buyerType as InvoiceBuyerType,
            }
          : {},
        ksefStatus
          ? {
              ksefStatus: ksefStatus as KsefStatus,
            }
          : {},
        type
          ? {
              type: type as SalesInvoiceType,
            }
          : {},
        status
          ? {
              status: status as InvoiceStatus,
            }
          : {},
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#131313] px-6 py-10 text-[#d9d9d9]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2">
              <Link
                href="/admin"
                className="text-sm text-[#bdbdbd] transition hover:text-white"
              >
                ← Powrót do panelu admina
              </Link>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Faktury
            </h1>
            <p className="mt-2 text-sm text-[#bdbdbd]">
              Zarządzanie dokumentami sprzedażowymi, statusem KSeF i podglądem PDF.
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Numer, email, NIP, firma, nabywca..."
              className="h-12 rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60 xl:col-span-2"
            />

            <select
              name="buyerType"
              defaultValue={buyerType}
              className="h-12 rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition focus:border-[#7aa333]/60"
            >
              <option value="">Typ nabywcy: wszystkie</option>
              <option value="PRIVATE">Osoba prywatna</option>
              <option value="COMPANY">Firma</option>
            </select>

            <select
              name="ksefStatus"
              defaultValue={ksefStatus}
              className="h-12 rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition focus:border-[#7aa333]/60"
            >
              <option value="">KSeF: wszystkie</option>
              <option value="READY">READY</option>
              <option value="SENT">SENT</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="ERROR">ERROR</option>
            </select>

            <select
              name="status"
              defaultValue={status}
              className="h-12 rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition focus:border-[#7aa333]/60"
            >
              <option value="">Status płatności: wszystkie</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>

            <select
              name="type"
              defaultValue={type}
              className="h-12 rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition focus:border-[#7aa333]/60"
            >
              <option value="">Typ dokumentu: wszystkie</option>
              <option value="LISTING_PACKAGE">Pakiet publikacji</option>
              <option value="FEATURED_PACKAGE">Wyróżnienie</option>
            </select>

            <div className="flex gap-2 md:col-span-2 xl:col-span-5">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-[#7aa333] px-5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Filtruj
              </button>

              <Link
                href="/admin/faktury"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-medium transition hover:bg-white/10"
              >
                Wyczyść
              </Link>
            </div>
          </form>

          <div className="mt-4 text-sm text-[#bdbdbd]">
            Znaleziono: <span className="text-white">{invoices.length}</span> faktur
          </div>
        </section>

        <section className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
          {invoices.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[#9f9f9f]">
              Brak faktur pasujących do filtrów.
            </div>
          ) : (
            <table className="w-full min-w-[1500px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[#bdbdbd]">
                  <th className="px-4 py-4 font-medium">Numer</th>
                  <th className="px-4 py-4 font-medium">Typ</th>
                  <th className="px-4 py-4 font-medium">Kwota</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Typ nabywcy</th>
                  <th className="px-4 py-4 font-medium">Nabywca</th>
                  <th className="px-4 py-4 font-medium">NIP</th>
                  <th className="px-4 py-4 font-medium">Email faktury</th>
                  <th className="px-4 py-4 font-medium">Konto usera</th>
                  <th className="px-4 py-4 font-medium">KSeF</th>
                  <th className="px-4 py-4 font-medium">Ref. KSeF</th>
                  <th className="px-4 py-4 font-medium">Data</th>
                  <th className="px-4 py-4 font-medium text-right">Akcje</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => {
                  const buyerDisplay =
                    invoice.buyerType === "COMPANY"
                      ? invoice.companyName || invoice.buyerName || "Firma"
                      : invoice.buyerName ||
                        invoice.invoiceEmail ||
                        "Osoba prywatna";

                  return (
                    <tr
                      key={invoice.id}
                      className="border-b border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-4 font-medium text-white">
                        {invoice.invoiceNumber || "—"}
                      </td>

                      <td className="px-4 py-4 text-white/80">
                        {getInvoiceTypeLabel(invoice.type)}
                      </td>

                      <td className="px-4 py-4 text-white/80">
                        {formatMoney(invoice.amountGross, invoice.currency)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getInvoiceStatusBadgeClass(
                            invoice.status
                          )}`}
                        >
                          {getInvoiceStatusLabel(invoice.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getBuyerTypeBadgeClass(
                            invoice.buyerType
                          )}`}
                        >
                          {getBuyerTypeLabel(invoice.buyerType)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-white/80">
                        {buyerDisplay}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.nip || "—"}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.invoiceEmail || "—"}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.user?.email || "—"}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getKsefStatusBadgeClass(
                            invoice.ksefStatus
                          )}`}
                        >
                          {getKsefStatusLabel(invoice.ksefStatus)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.ksefReferenceNumber || "—"}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {formatDate(invoice.issuedAt || invoice.createdAt)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/faktury/${invoice.id}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                          >
                            Szczegóły
                          </Link>

                          <a
                            href={`/api/invoices/${invoice.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-3 py-2 text-xs font-medium text-white transition hover:border-[#7aa333] hover:bg-[#7aa333]/15"
                          >
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}