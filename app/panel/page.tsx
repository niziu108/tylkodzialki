import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import PanelDzialkiList from "@/components/PanelDzialkiList";
import AutoFeaturedAfterPurchase from "@/components/AutoFeaturedAfterPurchase";
import CrmIntegrationPanel from "@/components/CrmIntegrationPanel";
import PanelAlertsList from "@/components/PanelAlertsList";
import PanelStatystyki from "@/components/PanelStatystyki";
import { getBiuroDailySeries } from "@/lib/biuroStats";
import { getFavoriteOffers } from "@/lib/favorites";
import { alertDisplayLabel } from "@/lib/alertCriteria";
import UlubioneWidok from "../ulubione/UlubioneWidok";

type PanelPageProps = {
  searchParams?: Promise<{
    tab?: string;
    success?: string;
    session_id?: string;
  }>;
};

export default async function PanelPage({ searchParams }: PanelPageProps) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  const params = await searchParams;

  const zakladki = ["ogloszenia", "statystyki", "crm", "faktury", "ulubione", "alerty"] as const;
  type Zakladka = (typeof zakladki)[number];
  const zadanaZakladka: Zakladka | null = zakladki.includes(params?.tab as Zakladka)
    ? (params?.tab as Zakladka)
    : null;

  // Powrót ze Stripe po zakupie wyróżnienia (app/api/stripe/checkout-featured). Samo
  // session_id niczego nie przesądza: akcja sprawdza sesję u Stripe i jej właściciela.
  const zakupSessionId =
    params?.success === "featured" && typeof params?.session_id === "string"
      ? params.session_id.trim() || null
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

  // Ten sam panel mają biura i zwykli klienci. Kto ma ogłoszenia, startuje od części
  // „Sprzedaję", kto nie ma (kupujący), od „Kupuję": ulubionych i alertów.
  const liczbaOfert = await prisma.dzialka.count({ where: { ownerId: rawUser.id } });
  const activeTab: Zakladka = zadanaZakladka ?? (liczbaOfert > 0 ? "ogloszenia" : "ulubione");
  const czescKupuje = activeTab === "ulubione" || activeTab === "alerty";

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
    biuroWizytowkaOn: rawUser.biuroWizytowkaOn ?? false,
    biuroSlug: rawUser.biuroSlug ?? null,
  };

  const [rawItems, invoices, crmIntegration, alertsRaw, favoriteItems, statsSeries] = await Promise.all([
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
            adminGmina: true,
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
            sourceType: true,
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
            query: true,
            priceMin: true,
            priceMax: true,
            areaMin: true,
            areaMax: true,
            przeznaczenia: true,
            transakcja: true,
            lat: true,
            lng: true,
            radiusKm: true,
            isActive: true,
            createdAt: true,
            lastNotifiedAt: true,
          },
        })
      : Promise.resolve([]),
    activeTab === "ulubione"
      ? getFavoriteOffers(user.id)
      : Promise.resolve([]),
    // Ostatnie 30 dni także na zakładce ogłoszeń: tam stoją najważniejsze liczby panelu.
    activeTab === "statystyki" || (activeTab === "ogloszenia" && liczbaOfert > 0)
      ? getBiuroDailySeries(user.id, 30)
      : Promise.resolve(null),
  ]);

  const alerts =
    activeTab === "alerty"
      ? alertsRaw.map((a) => ({
          id: a.id,
          label: alertDisplayLabel(a),
          isActive: a.isActive,
          createdAt: a.createdAt.toISOString(),
          lastNotifiedAt: a.lastNotifiedAt ? a.lastNotifiedAt.toISOString() : null,
        }))
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

  return (
    <main className="min-h-screen bg-bg text-fg/85">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="mb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              {/* Jeden tytul zamiast dwoch: drobne „Panel klienta" nad wielkim „Panel
                  uzytkownika" bylo tym samym napisem dwa razy. Zostaje zielony naglowek,
                  a pod nim samo konto (nazwa, jesli jest, i mail). */}
              <div className="text-[15px] font-semibold uppercase tracking-[0.22em] text-brand-text md:text-[18px]">
                Panel klienta
              </div>
              <div className="mt-3 h-px w-12 bg-brand/55" />

              {user.name ? (
                <div className="mt-4 truncate text-[24px] font-semibold leading-tight text-fg md:text-[28px]">
                  {user.name}
                </div>
              ) : null}

              {user.email ? (
                <div className="mt-3 truncate text-[15px] text-fg/72 md:text-[16px]">
                  {user.email}
                </div>
              ) : null}
            </div>

            {/* Jedno główne działanie i spokojne linki obok, zamiast czterech równych przycisków. */}
            <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
              {liczbaOfert > 0 ? (
                <Link
                  href="/panel/wyroznienia"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-[14px] font-semibold text-ink transition hover:bg-brand-strong"
                >
                  Wyróżnij ogłoszenie
                </Link>
              ) : (
                <Link
                  href="/sprzedaj"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-[14px] font-semibold text-ink transition hover:bg-brand-strong"
                >
                  Sprzedaj działkę
                </Link>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
                {liczbaOfert > 0 && user.featuredCredits > 0 ? (
                  <span className="text-brand-text">
                    Masz {user.featuredCredits} {user.featuredCredits === 1 ? "wyróżnienie" : user.featuredCredits < 5 ? "wyróżnienia" : "wyróżnień"} do wykorzystania
                  </span>
                ) : null}
                {liczbaOfert > 0 ? (
                  <Link href="/sprzedaj" className="text-fg/75 underline decoration-fg/20 underline-offset-4 transition hover:text-fg">
                    Sprzedaj działkę
                  </Link>
                ) : null}
                {/* Tylko partnerzy z włączoną wizytówką. Reszta kont nawet nie wie, że coś takiego
                    istnieje — wizytówka jest przyznawana, nie dostępna z automatu. */}
                {user.biuroWizytowkaOn && user.biuroSlug ? (
                  <Link
                    href={`/biuro/${user.biuroSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg/75 underline decoration-fg/20 underline-offset-4 transition hover:text-fg"
                  >
                    Twoja wizytówka
                  </Link>
                ) : null}
                {paymentsEnabled ? (
                  <Link href="/panel/pakiety" className="text-fg/75 underline decoration-fg/20 underline-offset-4 transition hover:text-fg">
                    Kup pakiet
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {zakupSessionId ? (
          <AutoFeaturedAfterPurchase sessionId={zakupSessionId} />
        ) : null}

        {/* Przełącznik części panelu: „Sprzedaję" (ogłoszenia, wyniki, CRM, faktury) i „Kupuję"
            (ulubione, alerty). Biuro i kupujący widzą każdy swoją część, bez mieszania zakładek. */}
        <div className="mb-5 inline-flex rounded-full border border-fg/12 bg-fg/[0.03] p-1 text-[14px]">
          {(
            [
              ["Sprzedaję", "/panel?tab=ogloszenia", !czescKupuje],
              ["Kupuję", "/panel?tab=ulubione", czescKupuje],
            ] as const
          ).map(([label, href, on]) => (
            <Link
              key={label}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`rounded-full px-5 py-2 font-medium transition ${
                on ? "bg-surface text-fg shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "text-fg/65 hover:text-fg"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mb-8 border-b border-fg/12">
          <div className="flex flex-wrap gap-x-7 gap-y-2 text-[15px] md:text-[16px]">
            {(czescKupuje
              ? ([
                  ["ulubione", "Ulubione"],
                  ["alerty", "Alerty"],
                ] as const)
              : ([
                  ["ogloszenia", "Twoje ogłoszenia"],
                  ["statystyki", "Statystyki"],
                  ["crm", "Integracja CRM"],
                  ["faktury", "Faktury"],
                ] as const)
            ).map(([tab, label]) => (
              <Link
                key={tab}
                href={`/panel?tab=${tab}`}
                className={`-mb-px border-b-2 pb-4 transition ${
                  activeTab === tab ? "border-brand text-fg" : "border-transparent text-fg/65 hover:text-fg"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {activeTab === "ogloszenia" ? (
          <>
            {/* Najważniejsze liczby panelu: czy oferty pracują. Ostatnie 30 dni ze snapshotów,
                a dopóki snapshotów jest za mało, liczby od początku z żywych liczników. */}
            {(() => {
              const ma30 = !!statsSeries && statsSeries.snapshotDaysInWindow >= 2;
              const z = ma30 ? statsSeries!.windowTotals : statsSeries?.allTime ?? null;
              const dopisek = ma30 ? "ostatnie 30 dni" : "łącznie";
              const kafle: Array<[string, number | null, string, boolean]> = [
                ["Aktywne oferty", activeCount, `z ${items.length} ogłoszeń`, false],
                ["Wyświetlenia", z ? z.views : null, dopisek, false],
                ["Wejścia w ofertę", z ? z.detailViews : null, dopisek, false],
                ["Kontakty", z ? z.leads : null, `telefon i SMS, ${dopisek}`, true],
              ];
              return (
                <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {kafle.map(([label, value, hint, zielony]) => (
                    <div key={label} className="rounded-2xl border border-fg/10 bg-surface px-5 py-4">
                      <div className="text-[13px] text-fg/65">{label}</div>
                      <div className={`mt-1.5 text-[28px] font-semibold leading-none tabular-nums ${zielony ? "text-brand-text" : "text-fg"}`}>
                        {value == null ? "—" : value.toLocaleString("pl-PL")}
                      </div>
                      <div className="mt-1.5 text-[12px] text-fg/62">{hint}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-[19px] font-semibold tracking-tight text-fg">Twoje ogłoszenia</h2>
              {liczbaOfert > 0 ? (
                <Link
                  href="/panel?tab=statystyki"
                  className="text-[14px] text-brand-text underline decoration-brand/30 underline-offset-4 transition hover:decoration-brand"
                >
                  Pełne statystyki
                </Link>
              ) : null}
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
                                  ? "bg-brand/20 text-brand-text"
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
        ) : activeTab === "statystyki" ? (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Statystyki
            </div>

            {statsSeries ? (
              <PanelStatystyki
                points={statsSeries.points}
                allTime={statsSeries.allTime}
                windowTotals={statsSeries.windowTotals}
                offers={statsSeries.offers}
                snapshotDaysInWindow={statsSeries.snapshotDaysInWindow}
                windowDays={statsSeries.windowDays}
              />
            ) : null}
          </>
        ) : activeTab === "alerty" ? (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Moje alerty
            </div>

            <PanelAlertsList initialAlerts={alerts} />
          </>
        ) : activeTab === "ulubione" ? (
          <UlubioneWidok items={favoriteItems} />
        ) : (
          <>
            <div className="mb-5 text-[19px] font-medium text-fg">
              Integracje CRM{" "}
              <span className="text-[15px] font-normal text-fg/62">
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