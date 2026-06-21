import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import PanelDzialkiList from "@/components/PanelDzialkiList";
import AutoFeaturedAfterPurchase from "@/components/AutoFeaturedAfterPurchase";
import CrmIntegrationPanel from "@/components/CrmIntegrationPanel";
import PanelAlertsList from "@/components/PanelAlertsList";
import KupList from "../kup/KupList";

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
      : params?.tab === "alerty"
      ? "alerty"
      : params?.tab === "ulubione"
      ? "ulubione"
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
      <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-fg">
        <div className="rounded-3xl border border-fg/10 bg-fg/5 px-8 py-10 text-center">
          <div className="text-xl font-semibold text-fg">Brak dostępu</div>
          <div className="mt-2 text-fg/70">
            Zaloguj się, aby przejść do panelu klienta.
          </div>
          <Link
            href="/logowanie"
            className="mt-6 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
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
      <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-fg">
        <div className="rounded-3xl border border-fg/10 bg-fg/5 px-8 py-10 text-center text-fg/80">
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

  const [rawItems, invoices, crmIntegration, alertsRaw, favoritesRaw] = await Promise.all([
    activeTab === "ogloszenia"
      ? prisma.dzialka.findMany({
          where: { ownerId: user.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            tytul: true,
            cenaPln: true,
            powierzchniaM2: true,
            transakcja: true,
            locationLabel: true,
            przeznaczenia: true,
            prad: true,
            woda: true,
            kanalizacja: true,
            gaz: true,
            status: true,
            publishedAt: true,
            expiresAt: true,
            endedAt: true,
            isFeatured: true,
            featuredUntil: true,
            viewsCount: true,
            detailViewsCount: true,
            phoneClicksCount: true,
            messageClicksCount: true,
            _count: {
              select: { favoritedBy: true },
            },
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
    activeTab === "alerty"
      ? prisma.offerAlert.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            label: true,
            isActive: true,
            createdAt: true,
            lastNotifiedAt: true,
          },
        })
      : Promise.resolve([]),
    activeTab === "ulubione"
      ? prisma.favoriteDzialka.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: {
            dzialka: {
              include: {
                zdjecia: { orderBy: { kolejnosc: "asc" } },
                owner: {
                  select: {
                    defaultBiuroLogoUrl: true,
                    defaultBiuroNazwa: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const alerts =
    activeTab === "alerty"
      ? alertsRaw.map((a) => ({
          id: a.id,
          label: a.label,
          isActive: a.isActive,
          createdAt: a.createdAt.toISOString(),
          lastNotifiedAt: a.lastNotifiedAt ? a.lastNotifiedAt.toISOString() : null,
        }))
      : [];

  const favoriteItems =
    activeTab === "ulubione"
      ? (favoritesRaw as any[])
          .map((f) => f.dzialka)
          .filter((d) => d && d.status === "AKTYWNE")
      : [];

  const now = Date.now();

  const items =
  activeTab === "ogloszenia"
    ? [...rawItems]
        .map((item) => ({
          ...item,
          favoritesCount: item._count?.favoritedBy ?? 0,
        }))
        .sort((a, b) => {
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

  const totalFavorites =
    activeTab === "ogloszenia"
      ? items.reduce((sum, item) => sum + ((item as any)._count?.favoritedBy ?? 0), 0)
      : 0;

  const totalPhoneClicks =
    activeTab === "ogloszenia"
      ? items.reduce((sum, item) => sum + ((item as any).phoneClicksCount ?? 0), 0)
      : 0;

  const totalMessageClicks =
    activeTab === "ogloszenia"
      ? items.reduce((sum, item) => sum + ((item as any).messageClicksCount ?? 0), 0)
      : 0;

  return (
    <main className="min-h-screen bg-bg text-fg/85">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="mb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-bright">
                Panel klienta
              </div>
              <div className="mt-2 h-px w-12 bg-brand/55" />

              <div className="mt-4 text-[28px] font-semibold leading-tight text-fg md:text-[34px]">
                {user.name || "Panel użytkownika"}
              </div>

              <div className="mt-2 text-sm text-fg/70">
                {user.email ? (
                  <span className="truncate text-fg/72">{user.email}</span>
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
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-fg/14 bg-fg/[0.03] px-6 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-fg transition hover:border-fg/28 hover:bg-fg/[0.05]"
                >
                  Kup pakiet
                </Link>
              ) : null}

              <Link
                href="/panel/wyroznienia"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-brand/35 bg-fg/[0.03] px-6 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-fg transition hover:border-brand/60 hover:bg-fg/[0.05]"
              >
                Kup wyróżnienie
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-fg/10 pt-6 sm:grid-cols-4">
            <div>
              <div className="flex min-h-[34px] items-end">
                <span className="text-[28px] font-semibold leading-none text-brand-bright">
                  {activeCount}
                </span>
              </div>
              <div className="mt-3 inline-block whitespace-nowrap border-b border-brand/55 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-bright/80">
                Aktywne oferty
              </div>
            </div>

            <div>
              <div className="flex min-h-[34px] items-end gap-2">
                <span className="text-[28px] font-semibold leading-none text-fg">
                  {paymentsEnabled ? user.listingCredits : "∞"}
                </span>
                {!paymentsEnabled ? (
                  <span className="text-[11px] leading-none text-brand-bright">bez limitu</span>
                ) : null}
              </div>
              <div className="mt-3 inline-block border-b border-fg/15 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/68">
                Publikacje
              </div>
            </div>

            <div>
              <div className="flex min-h-[34px] items-end">
                <span className="text-[28px] font-semibold leading-none text-fg">
                  {user.featuredCredits}
                </span>
              </div>
              <div className="mt-3 inline-block border-b border-fg/15 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/68">
                Wyróżnienia
              </div>
            </div>

            <div>
              <div className="flex min-h-[34px] items-end">
                <span className="text-[19px] font-medium leading-none text-fg/90 md:text-[21px]">
                  {formatDatePL(user.createdAt)}
                </span>
              </div>
              <div className="mt-3 inline-block border-b border-fg/15 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/68">
                Konto od
              </div>
            </div>
          </div>
        </div>

        {autoFeaturedDzialkaId ? (
          <AutoFeaturedAfterPurchase dzialkaId={autoFeaturedDzialkaId} />
        ) : null}

        <div className="mb-8 border-b border-fg/12">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap gap-7 text-[15px] md:text-[16px]">
              <Link
                href="/panel"
                className={`pb-4 transition ${
                  activeTab === "ogloszenia"
                    ? "border-b-2 border-brand text-fg"
                    : "text-fg/68 hover:text-fg"
                }`}
              >
                Twoje ogłoszenia
              </Link>

              <Link
                href="/panel?tab=faktury"
                className={`pb-4 transition ${
                  activeTab === "faktury"
                    ? "border-b-2 border-brand text-fg"
                    : "text-fg/68 hover:text-fg"
                }`}
              >
                Faktury
              </Link>

              <Link
                href="/panel?tab=alerty"
                className={`pb-4 transition ${
                  activeTab === "alerty"
                    ? "border-b-2 border-brand text-fg"
                    : "text-fg/68 hover:text-fg"
                }`}
              >
                Alerty
              </Link>

              <Link
                href="/panel?tab=ulubione"
                className={`pb-4 transition ${
                  activeTab === "ulubione"
                    ? "border-b-2 border-brand text-fg"
                    : "text-fg/68 hover:text-fg"
                }`}
              >
                Ulubione
              </Link>

              <Link
                href="/panel?tab=crm"
                className={`pb-4 transition ${
                  activeTab === "crm"
                    ? "border-b-2 border-brand text-fg"
                    : "text-fg/68 hover:text-fg"
                }`}
              >
                Integracje CRM{" "}
                <span className="text-[12px] font-normal text-fg/45">
                  (dla biur)
                </span>
              </Link>
            </div>

            {activeTab === "ogloszenia" ? (
              <div className="flex flex-wrap gap-4 pb-4 text-sm text-fg/70">
                <div>
                  Ogłoszenia: <span className="text-fg">{items.length}</span>
                </div>
                <div>
                  Aktywne: <span className="text-brand-text">{activeCount}</span>
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
              <div className="text-[19px] font-medium text-fg">
                Twoje ogłoszenia
              </div>
            </div>

            <PanelDzialkiList items={items as any} />
          </>
        ) : activeTab === "faktury" ? (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Faktury
            </div>

            {invoices.length === 0 ? (
              <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-fg">
                    Brak faktur
                  </h2>
                  <p className="mt-3 leading-7 text-fg/70">
                    Nie masz jeszcze żadnych dokumentów. Gdy kupisz pakiet lub
                    wyróżnienie, pojawią się właśnie tutaj.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {paymentsEnabled ? (
                      <Link
                        href="/panel/pakiety"
                        className="inline-flex rounded-full border border-brand/50 px-5 py-3 text-sm font-semibold text-fg transition hover:border-brand"
                      >
                        Zobacz pakiety
                      </Link>
                    ) : null}

                    <Link
                      href="/panel/wyroznienia"
                      className="inline-flex rounded-full border border-brand/50 px-5 py-3 text-sm font-semibold text-fg transition hover:border-brand"
                    >
                      Zobacz wyróżnienia
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-fg/10 bg-fg/[0.03]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="border-b border-fg/10 text-left text-fg/70">
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
                          className="border-b border-fg/5 hover:bg-fg/[0.03]"
                        >
                          <td className="px-5 py-4 font-medium text-fg">
                            {invoice.invoiceNumber || "—"}
                          </td>
                          <td className="px-5 py-4 text-fg/80">
                            {invoice.type === "FEATURED_PACKAGE"
                              ? "Wyróżnienie"
                              : "Pakiet publikacji"}
                          </td>
                          <td className="px-5 py-4 text-fg/80">
                            {(invoice.amountGross / 100).toFixed(2)}{" "}
                            {invoice.currency}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                invoice.status === "PAID"
                                  ? "bg-brand/20 text-brand-bright"
                                  : invoice.status === "PENDING"
                                  ? "bg-fg/10 text-fg/70"
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
                          <td className="px-5 py-4 text-fg/70">
                            {new Date(
                              invoice.issuedAt || invoice.createdAt
                            ).toLocaleDateString("pl-PL")}
                          </td>
                          <td className="px-5 py-4 text-fg/70">
                            {invoice.buyerType === "COMPANY"
                              ? invoice.companyName || "Faktura firmowa"
                              : "Osoba prywatna"}
                          </td>
                          <td className="px-5 py-4 text-fg/70">
                            <a
                              href={`/api/invoices/${invoice.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-full border border-brand/35 px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-brand hover:bg-fg/[0.04]"
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
        ) : activeTab === "alerty" ? (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Moje alerty
            </div>

            <PanelAlertsList initialAlerts={alerts} />
          </>
        ) : activeTab === "ulubione" ? (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Ulubione działki
            </div>

            {favoriteItems.length === 0 ? (
              <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-fg">
                    Brak zapisanych ofert
                  </h2>
                  <p className="mt-3 leading-7 text-fg/70">
                    Zapisuj działki, do których chcesz wrócić, pojawią się tutaj,
                    zsynchronizowane z zakładką Ulubione.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/kup"
                      className="inline-flex rounded-full border border-brand/50 px-5 py-3 text-sm font-semibold text-fg transition hover:border-brand"
                    >
                      Przeglądaj działki
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <KupList
                items={favoriteItems as any}
                loading={false}
                error={null}
              />
            )}
          </>
        ) : (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Integracje CRM{" "}
              <span className="text-[15px] font-normal text-fg/45">
                (dla biur)
              </span>
            </div>

            <CrmIntegrationPanel
              integration={crmIntegration}
              paymentsEnabled={paymentsEnabled}
              userId={user.id}
              userEmail={user.email}
            />
          </>
        )}
      </div>
    </main>
  );
}