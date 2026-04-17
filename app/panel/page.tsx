import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import PanelDzialkiList from "@/components/PanelDzialkiList";
import AutoFeaturedAfterPurchase from "@/components/AutoFeaturedAfterPurchase";
import CrmIntegrationPanel from "@/components/CrmIntegrationPanel";

type PanelPageProps = {
  searchParams?: Promise<{
    tab?: string;
    success?: string;
    autoFeatured?: string;
    dzialkaId?: string;
  }>;
};

function formatDatePL(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pl-PL");
}

export default async function PanelPage({ searchParams }: PanelPageProps) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  const params = await searchParams;
  const activeTab =
    params?.tab === "faktury"
      ? "faktury"
      : params?.tab === "crm"
      ? "crm"
      : "ogloszenia";

  const shouldAutoFeature =
    params?.success === "featured" &&
    params?.autoFeatured === "1" &&
    typeof params?.dzialkaId === "string" &&
    params.dzialkaId.trim().length > 0;

  const autoFeaturedDzialkaId = shouldAutoFeature
    ? params!.dzialkaId!.trim()
    : null;

  if (!email) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#131313] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center">
          <div className="text-xl font-semibold text-white">Brak dostępu</div>
          <div className="mt-2 text-white/70">
            Zaloguj się, aby przejść do panelu klienta.
          </div>
          <Link
            href="/auth"
            className="mt-6 inline-flex rounded-full bg-[#7aa333] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Przejdź do logowania
          </Link>
        </div>
      </main>
    );
  }

  const [rawUser, config] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
    }),
    prisma.appConfig.findFirst(),
  ]);

  if (!rawUser?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#131313] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center text-white/80">
          Nie znaleziono użytkownika w bazie.
        </div>
      </main>
    );
  }

  const paymentsEnabled = config?.paymentsEnabled ?? false;

  const user = {
    id: rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    listingCredits: rawUser.listingCredits ?? 0,
    featuredCredits:
      typeof (rawUser as any).featuredCredits === "number"
        ? (rawUser as any).featuredCredits
        : 0,
    createdAt: rawUser.createdAt,
  };

  const [rawItems, invoices, crmIntegration] = await Promise.all([
    activeTab === "ogloszenia"
      ? prisma.dzialka.findMany({
          where: { ownerId: user.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            tytul: true,
            cenaPln: true,
            powierzchniaM2: true,
            locationLabel: true,
            przeznaczenia: true,
            status: true,
            publishedAt: true,
            expiresAt: true,
            endedAt: true,
            isFeatured: true,
            featuredUntil: true,
            viewsCount: true,
            detailViewsCount: true,
            zdjecia: {
              select: { url: true, publicId: true, kolejnosc: true },
              orderBy: { kolejnosc: "asc" },
            },
          },
        })
      : Promise.resolve([]),
    activeTab === "faktury"
      ? prisma.invoice.findMany({
          where: { userId: user.id },
          orderBy: [{ createdAt: "desc" }],
        })
      : Promise.resolve([]),
    activeTab === "crm"
      ? prisma.crmIntegration.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            provider: true,
            isActive: true,
            transportType: true,
            feedFormat: true,
            ftpHost: true,
            ftpPort: true,
            ftpUsername: true,
            ftpRemotePath: true,
            ftpPassive: true,
            expectedFilePattern: true,
            fullImportMode: true,
            lastUsedAt: true,
            lastSyncAt: true,
            lastSuccessAt: true,
            lastErrorAt: true,
            lastErrorMessage: true,
            lastImportedOffers: true,
            lastCreatedCount: true,
            lastUpdatedCount: true,
            lastDeactivatedCount: true,
            lastSkippedCount: true,
            lastErrorCount: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const now = Date.now();

  const items =
    activeTab === "ogloszenia"
      ? [...rawItems].sort((a, b) => {
          const aFeatured =
            !!a.isFeatured &&
            !!a.featuredUntil &&
            new Date(a.featuredUntil).getTime() > now;

          const bFeatured =
            !!b.isFeatured &&
            !!b.featuredUntil &&
            new Date(b.featuredUntil).getTime() > now;

          if (aFeatured !== bFeatured) {
            return aFeatured ? -1 : 1;
          }

          const aUpdated = a.publishedAt
            ? new Date(a.publishedAt).getTime()
            : 0;
          const bUpdated = b.publishedAt
            ? new Date(b.publishedAt).getTime()
            : 0;

          return bUpdated - aUpdated;
        })
      : [];

  const activeCount =
    activeTab === "ogloszenia"
      ? items.filter((item) => {
          if (item.status === "ZAKONCZONE") return false;
          if (
            item.expiresAt &&
            new Date(item.expiresAt).getTime() < Date.now()
          ) {
            return false;
          }
          return true;
        }).length
      : 0;

  const endedCount =
    activeTab === "ogloszenia" ? items.length - activeCount : 0;

  const totalViews =
    activeTab === "ogloszenia"
      ? items.reduce((sum, item) => sum + (item.viewsCount ?? 0), 0)
      : 0;

  const totalDetailViews =
    activeTab === "ogloszenia"
      ? items.reduce((sum, item) => sum + (item.detailViewsCount ?? 0), 0)
      : 0;

  return (
    <main className="min-h-screen bg-[#131313] text-[#d9d9d9]">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="mb-8 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 md:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex rounded-full border border-[#7aa333]/25 bg-[#7aa333]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9fd14b]">
                    Panel klienta
                  </div>

                  <div className="mt-4 text-[28px] font-semibold leading-tight text-white md:text-[34px]">
                    {user.name || "Panel użytkownika"}
                  </div>

                  <div className="mt-2 text-sm text-white/55">
                    {user.email ? (
                      <span className="truncate text-white/60">{user.email}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link
                    href="/sprzedaj"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-full px-6 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-black transition hover:scale-[1.01] hover:opacity-90"
                    style={{ background: "#7aa333" }}
                  >
                    Dodaj działkę
                  </Link>

                  {paymentsEnabled ? (
                    <Link
                      href="/panel/pakiety"
                      className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/14 bg-white/[0.03] px-6 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition hover:border-white/28 hover:bg-white/[0.05]"
                    >
                      Kup pakiet
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                    Ogłoszenia
                  </div>
                  <div className="mt-2 text-[28px] font-semibold leading-none text-white">
                    {items.length}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                    Aktywne
                  </div>
                  <div className="mt-2 text-[28px] font-semibold leading-none text-[#9fd14b]">
                    {activeCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                    Wyświetlenia
                  </div>
                  <div className="mt-2 text-[28px] font-semibold leading-none text-white">
                    {totalViews}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                    Wejścia
                  </div>
                  <div className="mt-2 text-[28px] font-semibold leading-none text-white">
                    {totalDetailViews}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/8 pt-4 text-[13px] text-white/50">
                <div>
                  Konto od:{" "}
                  <span className="text-white/75">
                    {formatDatePL(user.createdAt)}
                  </span>
                </div>
                <div>
                  Zakończone:{" "}
                  <span className="text-red-300">{endedCount}</span>
                </div>
                <div>
                  Wyróżnienia:{" "}
                  <span className="text-white/75">{user.featuredCredits}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#7aa333]/18 bg-[linear-gradient(180deg,rgba(122,163,51,0.08),rgba(255,255,255,0.03))] p-5 md:p-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#9fd14b]">
              Dostępne zasoby
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Publikacje
                </div>
                <div className="mt-2 text-[30px] font-semibold leading-none text-white">
                  {paymentsEnabled ? user.listingCredits : "∞"}
                </div>
                {!paymentsEnabled ? (
                  <div className="mt-2 text-xs text-[#9fd14b]">
                    Nieograniczone
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Wyróżnienia
                </div>
                <div className="mt-2 text-[30px] font-semibold leading-none text-white">
                  {user.featuredCredits}
                </div>
              </div>
            </div>

            {!paymentsEnabled ? (
              <div className="mt-4 rounded-2xl border border-[#7aa333]/25 bg-[#7aa333]/10 px-4 py-3 text-sm leading-6 text-[#dce9bf]">
                Publikacja ogłoszeń jest obecnie darmowa.
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              {paymentsEnabled ? (
                <Link
                  href="/panel/pakiety"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#7aa333] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Kup pakiet
                </Link>
              ) : null}

              <Link
                href="/panel/wyroznienia"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#7aa333]/35 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:border-[#7aa333]/60 hover:bg-white/[0.05]"
              >
                Kup wyróżnienie
              </Link>
            </div>
          </div>
        </div>

        {autoFeaturedDzialkaId ? (
          <AutoFeaturedAfterPurchase dzialkaId={autoFeaturedDzialkaId} />
        ) : null}

        <div className="mb-8 border-b border-white/12">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap gap-7 text-[15px] md:text-[16px]">
              <Link
                href="/panel"
                className={`pb-4 transition ${
                  activeTab === "ogloszenia"
                    ? "border-b-2 border-[#7aa333] text-white"
                    : "text-white/68 hover:text-white"
                }`}
              >
                Twoje ogłoszenia
              </Link>

              <Link
                href="/panel?tab=faktury"
                className={`pb-4 transition ${
                  activeTab === "faktury"
                    ? "border-b-2 border-[#7aa333] text-white"
                    : "text-white/68 hover:text-white"
                }`}
              >
                Faktury
              </Link>

              <Link
                href="/panel?tab=crm"
                className={`pb-4 transition ${
                  activeTab === "crm"
                    ? "border-b-2 border-[#7aa333] text-white"
                    : "text-white/68 hover:text-white"
                }`}
              >
                Integracje CRM
              </Link>
            </div>

            {activeTab === "ogloszenia" ? (
              <div className="flex flex-wrap gap-4 pb-4 text-sm text-white/50">
                <div>
                  Ogłoszenia: <span className="text-white">{items.length}</span>
                </div>
                <div>
                  Aktywne: <span className="text-[#7aa333]">{activeCount}</span>
                </div>
                <div>
                  Zakończone: <span className="text-red-300">{endedCount}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {activeTab === "ogloszenia" ? (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="text-[19px] font-medium text-white">
                Twoje ogłoszenia
              </div>
            </div>

            <PanelDzialkiList items={items as any} />
          </>
        ) : activeTab === "faktury" ? (
          <>
            <div className="mb-5 text-[19px] font-medium text-white">
              Faktury
            </div>

            {invoices.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-white">
                    Brak faktur
                  </h2>
                  <p className="mt-3 leading-7 text-white/65">
                    Nie masz jeszcze żadnych dokumentów. Gdy kupisz pakiet lub
                    wyróżnienie, pojawią się właśnie tutaj.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {paymentsEnabled ? (
                      <Link
                        href="/panel/pakiety"
                        className="inline-flex rounded-full border border-[#7aa333]/50 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#7aa333]"
                      >
                        Zobacz pakiety
                      </Link>
                    ) : null}

                    <Link
                      href="/panel/wyroznienia"
                      className="inline-flex rounded-full border border-[#7aa333]/50 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#7aa333]"
                    >
                      Zobacz wyróżnienia
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-white/50">
                        <th className="px-5 py-4 font-medium">Numer</th>
                        <th className="px-5 py-4 font-medium">Typ</th>
                        <th className="px-5 py-4 font-medium">Kwota</th>
                        <th className="px-5 py-4 font-medium">Status</th>
                        <th className="px-5 py-4 font-medium">Data</th>
                        <th className="px-5 py-4 font-medium">Nabywca</th>
                        <th className="px-5 py-4 font-medium">PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b border-white/5 hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-4 font-medium text-white">
                            {invoice.invoiceNumber || "—"}
                          </td>
                          <td className="px-5 py-4 text-white/80">
                            {invoice.type === "FEATURED_PACKAGE"
                              ? "Wyróżnienie"
                              : "Pakiet publikacji"}
                          </td>
                          <td className="px-5 py-4 text-white/80">
                            {(invoice.amountGross / 100).toFixed(2)}{" "}
                            {invoice.currency}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                invoice.status === "PAID"
                                  ? "bg-[#7aa333]/20 text-[#9fd14b]"
                                  : invoice.status === "PENDING"
                                  ? "bg-white/10 text-white/70"
                                  : "bg-red-500/15 text-red-300"
                              }`}
                            >
                              {invoice.status === "PAID"
                                ? "Zapłacono"
                                : invoice.status === "PENDING"
                                ? "Oczekuje"
                                : "Błąd"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-white/70">
                            {new Date(
                              invoice.issuedAt || invoice.createdAt
                            ).toLocaleDateString("pl-PL")}
                          </td>
                          <td className="px-5 py-4 text-white/70">
                            {invoice.buyerType === "COMPANY"
                              ? invoice.companyName || "Faktura firmowa"
                              : "Osoba prywatna"}
                          </td>
                          <td className="px-5 py-4 text-white/70">
                            <a
                              href={`/api/invoices/${invoice.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-full border border-[#7aa333]/35 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[#7aa333] hover:bg-white/[0.04]"
                            >
                              Pobierz PDF
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-5 text-[19px] font-medium text-white">
              Integracje CRM
            </div>

            <CrmIntegrationPanel
              integration={crmIntegration}
              paymentsEnabled={paymentsEnabled}
            />
          </>
        )}
      </div>
    </main>
  );
}