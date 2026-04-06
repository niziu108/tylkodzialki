import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import {
  deleteUserAction,
  togglePaymentsAction,
  toggleUserRoleAction,
} from "./actions";
import AdminMailComposer from "./AdminMailComposer";

type AdminPageProps = {
  searchParams?: Promise<{
    q?: string;
    mailSent?: string;
    sent?: string;
    failed?: string;
    mailError?: string;
  }>;
};

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
      },
    });
  }

  return config;
}

function decodeMailError(code: string) {
  switch (code) {
    case "Brak-maila-admina":
      return "Admin nie ma przypisanego adresu e-mail.";
    case "Uzupelnij-temat-i-tresc":
      return "Uzupełnij temat i treść wiadomości.";
    case "Nieprawidlowa-grupa":
      return "Wybrano nieprawidłową grupę odbiorców.";
    case "Brak-odbiorcow":
      return "Brak odbiorców dla wybranej grupy.";
    default:
      return code || "";
  }
}

function getInvoiceTypeLabel(type: string) {
  switch (type) {
    case "FEATURED_PACKAGE":
      return "Wyróżnienie";
    case "LISTING_PACKAGE":
      return "Pakiet publikacji";
    default:
      return type;
  }
}

function getInvoiceStatusLabel(status: string) {
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

function getInvoiceStatusBadgeClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-[#7aa333]/20 text-[#9fd14b]";
    case "PENDING":
      return "bg-white/10 text-white/70";
    case "FAILED":
      return "bg-red-500/15 text-red-300";
    case "REFUNDED":
      return "bg-orange-500/15 text-orange-300";
    default:
      return "bg-white/10 text-white/70";
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const q = params?.q?.trim() || "";
  const mailSent = params?.mailSent || "";
  const sentCount = Number(params?.sent || 0);
  const failedCount = Number(params?.failed || 0);
  const mailError = decodeMailError(params?.mailError || "");

  const [users, config, invoices, articles] = await Promise.all([
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              {
                email: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: {
            dzialki: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    getAppConfig(),
    prisma.invoice.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.article.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 6,
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#131313] px-6 py-10 text-[#d9d9d9]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Panel admina
            </h1>
            <p className="mt-2 text-sm text-[#bdbdbd]">
              Zarządzanie użytkownikami, sprzedażą i treściami TylkoDziałki
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/faktury"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Faktury
            </Link>

            <Link
              href="/admin/artykuly"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#7aa333] px-5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Zarządzaj artykułami
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Monetyzacja</h2>
              <p className="mt-1 text-sm text-[#bdbdbd]">
                Globalne sterowanie systemem płatnych ogłoszeń.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  config.paymentsEnabled
                    ? "bg-[#7aa333]/20 text-[#9fd14b]"
                    : "bg-white/10 text-[#d9d9d9]"
                }`}
              >
                {config.paymentsEnabled
                  ? "Płatności włączone"
                  : "Płatności wyłączone"}
              </span>

              <form action={togglePaymentsAction}>
                <button
                  type="submit"
                  className={`h-11 rounded-2xl px-5 text-sm font-semibold transition ${
                    config.paymentsEnabled
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-[#7aa333] text-black hover:opacity-90"
                  }`}
                >
                  {config.paymentsEnabled
                    ? "Wyłącz płatności"
                    : "Włącz płatności"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">
              Maile / komunikacja
            </h2>
            <p className="mt-1 text-sm text-[#bdbdbd]">
              Napisz własną wiadomość, wybierz odbiorców, sprawdź podgląd i wyślij ręcznie.
            </p>
          </div>

          {mailSent === "test" && (
            <div className="mb-4 rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-4 py-3 text-sm text-[#dff2b2]">
              Testowy mail został wysłany poprawnie.
            </div>
          )}

          {mailSent === "all" && (
            <div className="mb-4 rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-4 py-3 text-sm text-[#dff2b2]">
              Wysyłka zakończona. Wysłano: <strong>{sentCount}</strong>, błędy:{" "}
              <strong>{failedCount}</strong>.
            </div>
          )}

          {!!mailError && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {mailError}
            </div>
          )}

          <AdminMailComposer />
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Artykuły / blog
              </h2>
              <p className="mt-1 text-sm text-[#bdbdbd]">
                Treści pod SEO, ekspercki blog i ruch z Google.
              </p>
            </div>

            <Link
              href="/admin/artykuly"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-5 text-sm font-semibold text-white transition hover:border-[#7aa333] hover:bg-[#7aa333]/15"
            >
              Przejdź do artykułów
            </Link>
          </div>

          {articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-sm text-[#9f9f9f]">
              Nie masz jeszcze żadnych artykułów. Dodaj pierwszy wpis i zacznij
              budować SEO portalu.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-2 text-base font-semibold text-white">
                        {article.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#8f8f8f]">
                        /blog/{article.slug}
                      </p>
                    </div>

                    <span
                      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                        article.isPublished
                          ? "bg-[#7aa333]/20 text-[#9fd14b]"
                          : "bg-white/10 text-[#d9d9d9]"
                      }`}
                    >
                      {article.isPublished ? "Opublikowany" : "Szkic"}
                    </span>
                  </div>

                  <p className="line-clamp-3 text-sm text-[#bdbdbd]">
                    {article.excerpt || "Brak zajawki artykułu."}
                  </p>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#8f8f8f]">
                    <span>
                      {new Date(article.createdAt).toLocaleDateString("pl-PL")}
                    </span>

                    <Link
                      href="/admin/artykuly"
                      className="font-semibold text-white transition hover:text-[#9fd14b]"
                    >
                      Zarządzaj →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Szukaj po mailu lub imieniu..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#1b1b1b] px-4 text-sm text-white outline-none transition placeholder:text-[#8f8f8f] focus:border-[#7aa333]/60"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-[#7aa333] px-5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Szukaj
              </button>

              <a
                href="/admin"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-medium transition hover:bg-white/10"
              >
                Wyczyść
              </a>
            </div>
          </form>

          <div className="mt-3 text-sm text-[#bdbdbd]">
            {q ? (
              <>
                Wyniki dla: <span className="text-white">„{q}”</span> —
                znaleziono <span className="text-white">{users.length}</span>
              </>
            ) : (
              <>
                Wszystkich użytkowników:{" "}
                <span className="text-white">{users.length}</span>
              </>
            )}
          </div>
        </div>

        <div className="mb-8 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[#bdbdbd]">
                <th className="px-4 py-4 font-medium">Email</th>
                <th className="px-4 py-4 font-medium">Imię</th>
                <th className="px-4 py-4 font-medium">Rola</th>
                <th className="px-4 py-4 font-medium">Zweryfikowany</th>
                <th className="px-4 py-4 font-medium">Ogłoszenia</th>
                <th className="px-4 py-4 font-medium">Kredyty</th>
                <th className="px-4 py-4 font-medium">Data rejestracji</th>
                <th className="px-4 py-4 font-medium text-right">Akcje</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-[#9f9f9f]"
                  >
                    Brak użytkowników pasujących do wyszukiwania.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-4 align-middle">
                      <div className="font-medium text-[#f3f3f3]">
                        {user.email || "Brak emaila"}
                      </div>
                    </td>

                    <td className="px-4 py-4 align-middle">
                      {user.name || "—"}
                    </td>

                    <td className="px-4 py-4 align-middle">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          user.role === "ADMIN"
                            ? "bg-[#7aa333]/20 text-[#9fd14b]"
                            : "bg-white/10 text-[#d9d9d9]"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-middle">
                      {user.emailVerified ? (
                        <span className="text-[#9fd14b]">TAK</span>
                      ) : (
                        <span className="text-[#ff8a8a]">NIE</span>
                      )}
                    </td>

                    <td className="px-4 py-4 align-middle">
                      {user._count.dzialki}
                    </td>

                    <td className="px-4 py-4 align-middle">
                      {user.listingCredits}
                    </td>

                    <td className="px-4 py-4 align-middle">
                      {new Date(user.createdAt).toLocaleDateString("pl-PL")}
                    </td>

                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <form action={toggleUserRoleAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                          >
                            {user.role === "ADMIN"
                              ? "Ustaw jako USER"
                              : "Ustaw jako ADMIN"}
                          </button>
                        </form>

                        <form action={deleteUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                          >
                            Usuń konto
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Faktury i sprzedaż
              </h2>
              <p className="mt-1 text-sm text-[#bdbdbd]">
                Ostatnie dokumenty sprzedażowe wygenerowane w systemie.
              </p>
            </div>

            <Link
              href="/admin/faktury"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-5 text-sm font-semibold text-white transition hover:border-[#7aa333] hover:bg-[#7aa333]/15"
            >
              Zobacz wszystkie faktury
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-10 text-center text-sm text-[#9f9f9f]">
              Brak faktur w systemie.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full min-w-[1360px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[#bdbdbd]">
                    <th className="px-4 py-4 font-medium">Numer</th>
                    <th className="px-4 py-4 font-medium">Typ</th>
                    <th className="px-4 py-4 font-medium">Kwota</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Nabywca</th>
                    <th className="px-4 py-4 font-medium">Email klienta</th>
                    <th className="px-4 py-4 font-medium">
                      Konto użytkownika
                    </th>
                    <th className="px-4 py-4 font-medium">Data</th>
                    <th className="px-4 py-4 font-medium">Źródło</th>
                    <th className="px-4 py-4 font-medium">PDF</th>
                    <th className="px-4 py-4 font-medium text-right">
                      Szczegóły
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice) => (
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
                        {(invoice.amountGross / 100).toFixed(2)}{" "}
                        {invoice.currency}
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

                      <td className="px-4 py-4 text-white/80">
                        {invoice.buyerType === "COMPANY"
                          ? invoice.companyName || "Faktura firmowa"
                          : invoice.buyerName ||
                            invoice.invoiceEmail ||
                            "Osoba prywatna"}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.invoiceEmail || "—"}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.user?.email || "—"}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {new Date(
                          invoice.issuedAt || invoice.createdAt
                        ).toLocaleDateString("pl-PL")}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        {invoice.source}
                      </td>

                      <td className="px-4 py-4 text-white/70">
                        <a
                          href={`/api/invoices/${invoice.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-[#7aa333]/35 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#7aa333] hover:bg-white/[0.04]"
                        >
                          PDF
                        </a>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/faktury/${invoice.id}`}
                          className="inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.04]"
                        >
                          Szczegóły
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}