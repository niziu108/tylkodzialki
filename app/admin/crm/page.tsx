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
    badge: "border-[#7aa333]/30 bg-[#7aa333]/20 text-[#9fd14b]",
    dot: "bg-[#9fd14b]",
    order: 2,
  },
  DISABLED: {
    label: "Wyłączona",
    badge: "border-white/15 bg-white/10 text-white/60",
    dot: "bg-white/40",
    order: 3,
  },
};

function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider;
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

export default async function AdminCrmMonitoringPage() {
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
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const now = new Date().getTime();

  const rows = (integrations as IntegrationRow[])
    .map((it) => ({ ...it, health: computeHealth(it, now) }))
    .sort((a, b) => {
      const byHealth = HEALTH_META[a.health].order - HEALTH_META[b.health].order;
      if (byHealth !== 0) return byHealth;

      const aSync = a.lastSyncAt ? new Date(a.lastSyncAt).getTime() : 0;
      const bSync = b.lastSyncAt ? new Date(b.lastSyncAt).getTime() : 0;
      return bSync - aSync;
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
    <main className="min-h-screen bg-[#131313] px-6 py-10 text-[#d9d9d9]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-white/55">
              <Link href="/admin" className="transition hover:text-white">
                Panel admina
              </Link>
              <span className="mx-2">/</span>
              <span>Monitoring CRM</span>
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Monitoring synchronizacji CRM
            </h1>

            <p className="mt-2 text-sm text-[#bdbdbd]">
              Stan wszystkich integracji w jednym miejscu. Auto-sync uruchamia się
              o 06:00 i 18:00 UTC. Integracje z problemem są na górze.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Wróć do admina
          </Link>
        </div>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              Integracje
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{total}</div>
            <div className="mt-1 text-xs text-white/50">{activeCount} aktywnych</div>
          </div>

          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_META[card.health].dot}`}
                />
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  {card.label}
                </div>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {card.value}
              </div>
            </div>
          ))}
        </section>

        {providerStats.length > 0 ? (
          <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">
              Według systemu CRM
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providerStats.map((stat) => (
                <div
                  key={stat.provider}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white">
                      {providerLabel(stat.provider)}
                    </div>
                    <div className="text-sm text-white/55">
                      {stat.total}{" "}
                      {stat.total === 1 ? "integracja" : "integracji"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-red-300">Błąd {stat.ERROR}</span>
                    <span className="text-amber-300">Nieświeże {stat.STALE}</span>
                    <span className="text-[#9fd14b]">OK {stat.OK}</span>
                    {stat.DISABLED > 0 ? (
                      <span className="text-white/45">Wył. {stat.DISABLED}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-white/5">
          <div className="max-h-[68vh] overflow-auto overscroll-contain rounded-3xl">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="sticky top-0 z-20 bg-[#1b1b1b] shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                <tr className="border-b border-white/10 text-left text-[#bdbdbd]">
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Biuro / integracja</th>
                  <th className="px-4 py-4 font-medium">System</th>
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
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-[#9f9f9f]"
                    >
                      Brak skonfigurowanych integracji CRM.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const meta = HEALTH_META[row.health];
                    const relative = formatRelative(row.lastSyncAt, now);
                    const showSuccessHint =
                      !!row.lastSuccessAt &&
                      (!row.lastSyncAt ||
                        new Date(row.lastSuccessAt).getTime() !==
                          new Date(row.lastSyncAt).getTime());

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-white/5 hover:bg-white/[0.03]"
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
                            className="font-medium text-[#f3f3f3] transition hover:text-[#9fd14b]"
                          >
                            {row.user.email || row.user.name || "Brak emaila"}
                          </Link>
                          <div className="mt-0.5 text-xs text-white/45">
                            {row.name}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-white/80">
                          {providerLabel(row.provider)}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="text-white/85">
                            {formatDate(row.lastSyncAt)}
                          </div>
                          {relative ? (
                            <div className="mt-0.5 text-xs text-white/45">
                              {relative}
                            </div>
                          ) : null}
                          {showSuccessHint ? (
                            <div className="mt-0.5 text-xs text-white/40">
                              sukces: {formatDate(row.lastSuccessAt)}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 align-top text-right font-semibold text-white">
                          {row.lastImportedOffers}
                        </td>

                        <td className="px-4 py-4 align-top text-right text-[#9fd14b]">
                          {row.lastCreatedCount}
                        </td>

                        <td className="px-4 py-4 align-top text-right text-white/80">
                          {row.lastUpdatedCount}
                        </td>

                        <td className="px-4 py-4 align-top text-right">
                          <span
                            className={`font-semibold ${
                              row.lastErrorCount > 0
                                ? "text-red-300"
                                : "text-white/70"
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
