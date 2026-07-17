import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

// Monitoring CRM (Sprint 3): widok TYLKO do odczytu. Czytamy statystyki,
// które silniki (domypl / asari / esticrm) i tak zapisują po każdym imporcie.
// Brak zapisów do bazy, brak wpływu na synchronizację.
export const dynamic = "force-dynamic";

// Cron auto-sync leci 2x dziennie (co 12 h). Brak udanego importu dłużej niż
// to oznacza pominięte przebiegi, więc traktujemy integrację jako nieświeżą.
const STALE_THRESHOLD_HOURS = 48;

type Health = "ERROR" | "STALE" | "OK" | "DISABLED";

const PROVIDER_LABELS: Record<string, string> = {
  GALACTICA: "Galactica",
  GENERIC: "Generic",
  ASARI: "Asari",
  ESTI_CRM: "EstiCRM",
  IMOX: "IMOX",
  PROPERTLY: "Propertly",
};

const HEALTH_META: Record<
  Health,
  { label: string; badge: string; dot: string; order: number }
> = {
  ERROR: {
    label: "Błąd",
    badge: "border-red-500/30 bg-red-500/15 text-red-300",
    dot: "bg-red-400",
    order: 0,
  },
  STALE: {
    label: "Nieświeże",
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400",
    order: 1,
  },
  OK: {
    label: "OK",
    badge: "border-brand/30 bg-brand/20 text-brand-bright",
    dot: "bg-brand-bright",
    order: 2,
  },
  DISABLED: {
    label: "Wyłączona",
    badge: "border-fg/15 bg-fg/10 text-fg/72",
    dot: "bg-fg/40",
    order: 3,
  },
};

function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider;
}

const SORTS = [
  { key: "status", label: "Problemy najpierw", hint: "błędy i nieświeże na górze" },
  { key: "nowe", label: "Najnowsze biura", hint: "ostatnio podłączone integracje" },
  { key: "sync", label: "Ostatnia synchronizacja", hint: "kto synchronizował się ostatnio" },
  { key: "oferty", label: "Najwięcej ofert", hint: "wg ofert z ostatniego importu" },
  { key: "biuro", label: "Biuro A–Z", hint: "alfabetycznie po adresie e-mail" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function parseSort(value: string | undefined): SortKey {
  const match = SORTS.find((s) => s.key === value);
  return match ? match.key : "status";
}

function time(value: Date | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("pl-PL");
  } catch {
    return "—";
  }
}

function formatRelative(value: Date | null | undefined, now: number) {
  if (!value) return "";

  const diffMs = now - new Date(value).getTime();
  if (diffMs < 0) return "";

  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;

  const h = Math.floor(min / 60);
  if (h < 48) return `${h} godz. temu`;

  const d = Math.floor(h / 24);
  return `${d} dni temu`;
}

type IntegrationRow = {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  lastImportedOffers: number;
  lastCreatedCount: number;
  lastUpdatedCount: number;
  lastErrorCount: number;
  createdAt: Date;
  user: { id: string; email: string | null; name: string | null };
};

function computeHealth(it: IntegrationRow, now: number): Health {
  if (!it.isActive) return "DISABLED";

  // Cały ostatni przebieg padł: silnik ustawił lastErrorAt nowszy od sukcesu
  // (albo sukcesu nie było wcale). Błędy cząstkowe -> lastErrorCount > 0.
  const runFailed =
    !!it.lastErrorAt &&
    (!it.lastSuccessAt ||
      new Date(it.lastErrorAt).getTime() > new Date(it.lastSuccessAt).getTime());

  if (it.lastErrorCount > 0 || runFailed) return "ERROR";

  const staleMs = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
  const fresh =
    !!it.lastSuccessAt && now - new Date(it.lastSuccessAt).getTime() <= staleMs;

  if (!fresh) return "STALE";
  return "OK";
}

type AdminCrmPageProps = {
  searchParams?: Promise<{ sort?: string }>;
};

export default async function AdminCrmMonitoringPage({
  searchParams,
}: AdminCrmPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const integrations = await prisma.crmIntegration.findMany({
    select: {
      id: true,
      name: true,
      provider: true,
      isActive: true,
      lastSyncAt: true,
      lastSuccessAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
      lastImportedOffers: true,
      lastCreatedCount: true,
      lastUpdatedCount: true,
      lastErrorCount: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const params = await searchParams;
  const sort = parseSort(params?.sort);

  const now = new Date().getTime();

  const rows = (integrations as IntegrationRow[])
    .map((it) => ({ ...it, health: computeHealth(it, now) }))
    .sort((a, b) => {
      if (sort === "nowe") return time(b.createdAt) - time(a.createdAt);
      if (sort === "sync") return time(b.lastSyncAt) - time(a.lastSyncAt);
      if (sort === "oferty") {
        const byOffers = b.lastImportedOffers - a.lastImportedOffers;
        if (byOffers !== 0) return byOffers;
        return time(b.lastSyncAt) - time(a.lastSyncAt);
      }
      if (sort === "biuro") {
        const aName = (a.user.email || a.user.name || a.name).toLowerCase();
        const bName = (b.user.email || b.user.name || b.name).toLowerCase();
        return aName.localeCompare(bName, "pl");
      }

      const byHealth = HEALTH_META[a.health].order - HEALTH_META[b.health].order;
      if (byHealth !== 0) return byHealth;

      return time(b.lastSyncAt) - time(a.lastSyncAt);
    });

  const counts: Record<Health, number> = {
    ERROR: 0,
    STALE: 0,
    OK: 0,
    DISABLED: 0,
  };
  for (const row of rows) counts[row.health] += 1;

  const total = rows.length;
  const activeCount = total - counts.DISABLED;

  type ProviderStat = {
    provider: string;
    total: number;
    ERROR: number;
    STALE: number;
    OK: number;
    DISABLED: number;
  };

  const providerMap = new Map<string, ProviderStat>();
  for (const row of rows) {
    const stat =
      providerMap.get(row.provider) ??
      {
        provider: row.provider,
        total: 0,
        ERROR: 0,
        STALE: 0,
        OK: 0,
        DISABLED: 0,
      };
    stat.total += 1;
    stat[row.health] += 1;
    providerMap.set(row.provider, stat);
  }

  const providerStats = Array.from(providerMap.values()).sort((a, b) => {
    if (b.ERROR !== a.ERROR) return b.ERROR - a.ERROR;
    if (b.STALE !== a.STALE) return b.STALE - a.STALE;
    return b.total - a.total;
  });

  const summaryCards: { label: string; value: number; health: Health }[] = [
    { label: "Błędy", value: counts.ERROR, health: "ERROR" },
    { label: "Nieświeże", value: counts.STALE, health: "STALE" },
    { label: "OK", value: counts.OK, health: "OK" },
    { label: "Wyłączone", value: counts.DISABLED, health: "DISABLED" },
  ];

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-fg/85">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-fg/70">
              <Link href="/admin" className="transition hover:text-fg">
                Panel admina
              </Link>
              <span className="mx-2">/</span>
              <span>Monitoring CRM</span>
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              Monitoring synchronizacji CRM
            </h1>

            <p className="mt-2 text-sm text-fg/70">
              Stan wszystkich integracji w jednym miejscu. Auto-sync uruchamia się
              o 06:00 i 18:00 UTC. Kolejność listy ustawisz sortowaniem niżej.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-fg/10 bg-fg/5 px-5 text-sm font-semibold text-fg transition hover:bg-fg/10"
          >
            Wróć do admina
          </Link>
        </div>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-2xl border border-fg/10 bg-fg/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-fg/68">
              Integracje
            </div>
            <div className="mt-2 text-2xl font-semibold text-fg">{total}</div>
            <div className="mt-1 text-xs text-fg/70">{activeCount} aktywnych</div>
          </div>

          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-fg/10 bg-fg/5 p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_META[card.health].dot}`}
                />
                <div className="text-[11px] uppercase tracking-[0.14em] text-fg/68">
                  {card.label}
                </div>
              </div>
              <div className="mt-2 text-2xl font-semibold text-fg">
                {card.value}
              </div>
            </div>
          ))}
        </section>

        {providerStats.length > 0 ? (
          <section className="mb-6 rounded-3xl border border-fg/10 bg-fg/5 p-4 md:p-5">
            <h2 className="mb-4 text-sm font-semibold text-fg">
              Według systemu CRM
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providerStats.map((stat) => (
                <div
                  key={stat.provider}
                  className="rounded-2xl border border-fg/10 bg-surface p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-fg">
                      {providerLabel(stat.provider)}
                    </div>
                    <div className="text-sm text-fg/70">
                      {stat.total}{" "}
                      {stat.total === 1 ? "integracja" : "integracji"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-red-300">Błąd {stat.ERROR}</span>
                    <span className="text-amber-300">Nieświeże {stat.STALE}</span>
                    <span className="text-brand-bright">OK {stat.OK}</span>
                    {stat.DISABLED > 0 ? (
                      <span className="text-fg/68">Wył. {stat.DISABLED}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-[0.14em] text-fg/60">
            Sortuj
          </span>

          {SORTS.map((option) => {
            const active = option.key === sort;
            const href =
              option.key === "status" ? "/admin/crm" : `/admin/crm?sort=${option.key}`;

            return (
              <Link
                key={option.key}
                href={href}
                title={option.hint}
                className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                  active
                    ? "border-brand bg-brand/15 text-brand-bright"
                    : "border-fg/12 bg-fg/[0.03] text-fg/70 hover:border-fg/25 hover:text-fg"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        <div className="rounded-3xl border border-fg/10 bg-fg/5">
          <div className="max-h-[68vh] overflow-auto overscroll-contain rounded-3xl">
            <table className="w-full min-w-[1320px] text-sm">
              <thead className="sticky top-0 z-20 bg-surface shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                <tr className="border-b border-fg/10 text-left text-fg/70">
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Biuro / integracja</th>
                  <th className="px-4 py-4 font-medium">System</th>
                  <th className="px-4 py-4 font-medium">Podłączone</th>
                  <th className="px-4 py-4 font-medium">Ostatnia synchronizacja</th>
                  <th className="px-4 py-4 font-medium text-right">Oferty</th>
                  <th className="px-4 py-4 font-medium text-right">Nowe</th>
                  <th className="px-4 py-4 font-medium text-right">Zaktualizowane</th>
                  <th className="px-4 py-4 font-medium text-right">Błędy</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-fg/70"
                    >
                      Brak skonfigurowanych integracji CRM.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const meta = HEALTH_META[row.health];
                    const relative = formatRelative(row.lastSyncAt, now);
                    const addedRelative = formatRelative(row.createdAt, now);
                    const showSuccessHint =
                      !!row.lastSuccessAt &&
                      (!row.lastSyncAt ||
                        new Date(row.lastSuccessAt).getTime() !==
                          new Date(row.lastSyncAt).getTime());

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-fg/5 hover:bg-fg/[0.03]"
                      >
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.badge}`}
                          >
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${meta.dot}`}
                            />
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <Link
                            href={`/admin/crm/${row.user.id}`}
                            className="font-medium text-fg transition hover:text-brand-bright"
                          >
                            {row.user.email || row.user.name || "Brak emaila"}
                          </Link>
                          <div className="mt-0.5 text-xs text-fg/68">
                            {row.name}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-fg/80">
                          {providerLabel(row.provider)}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-fg/85">
                            {formatDate(row.createdAt)}
                          </div>
                          {addedRelative ? (
                            <div className="mt-0.5 text-xs text-fg/68">
                              {addedRelative}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-fg/85">
                            {formatDate(row.lastSyncAt)}
                          </div>
                          {relative ? (
                            <div className="mt-0.5 text-xs text-fg/68">
                              {relative}
                            </div>
                          ) : null}
                          {showSuccessHint ? (
                            <div className="mt-0.5 text-xs text-fg/64">
                              sukces: {formatDate(row.lastSuccessAt)}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 align-top text-right font-semibold text-fg">
                          {row.lastImportedOffers}
                        </td>

                        <td className="px-4 py-4 align-top text-right text-brand-bright">
                          {row.lastCreatedCount}
                        </td>

                        <td className="px-4 py-4 align-top text-right text-fg/80">
                          {row.lastUpdatedCount}
                        </td>

                        <td className="px-4 py-4 align-top text-right">
                          <span
                            className={`font-semibold ${
                              row.lastErrorCount > 0
                                ? "text-red-300"
                                : "text-fg/70"
                            }`}
                          >
                            {row.lastErrorCount}
                          </span>
                          {row.lastErrorMessage ? (
                            <div className="mt-1 max-w-[280px] text-left text-xs text-red-300/80">
                              {row.lastErrorMessage}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
