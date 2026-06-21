import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { getBiuroLeadsReport, type LeadCounters } from "@/lib/biuroStats";

type StatystykiPageProps = {
  searchParams?: Promise<{ okno?: string }>;
};

function formatIntPL(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value);
}

const WINDOWS: { key: string; label: string; days: number | null }[] = [
  { key: "7", label: "7 dni", days: 7 },
  { key: "30", label: "30 dni", days: 30 },
  { key: "all", label: "Cały okres", days: null },
];

export default async function StatystykiPage({ searchParams }: StatystykiPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const oknoKey = params?.okno === "7" || params?.okno === "30" ? params.okno : "all";
  const windowDays = WINDOWS.find((w) => w.key === oknoKey)?.days ?? null;

  const report = await getBiuroLeadsReport(windowDays);

  // Czy realnie pokazujemy okno (mamy ≥2 dni snapshotów), czy spadamy na "od początku".
  const showingWindow = report.totalsWindow != null;
  const windowRequestedButEmpty = windowDays != null && !showingWindow;

  const summary: LeadCounters = report.totalsWindow ?? report.totalsAllTime;

  const summaryCards = [
    { label: "Leady (tel. + wiad.)", value: summary.leads, accent: true },
    { label: "Telefony", value: summary.phoneClicks, accent: true },
    { label: "Wiadomości", value: summary.messageClicks, accent: true },
    { label: "Wejścia w oferty", value: summary.detailViews, accent: false },
  ];

  const zakres = showingWindow
    ? `ostatnie ${windowDays} dni`
    : "od początku";

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-fg/85">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-bright">
              Raport leadów
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Statystyki biur
            </h1>
            <p className="mt-2 text-sm text-fg/70">
              Telefony, wiadomości i wejścia per biuro. Ranking i dowód wartości do
              rozmów z biurami.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-fg/10 bg-fg/5 px-5 text-sm font-semibold text-fg transition hover:bg-fg/10"
          >
            ← Panel admina
          </Link>
        </div>

        {/* Wybór okna czasu */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {WINDOWS.map((w) => {
            const active = w.key === oknoKey;
            const href = w.key === "all" ? "/admin/statystyki" : `/admin/statystyki?okno=${w.key}`;
            return (
              <Link
                key={w.key}
                href={href}
                className={`inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-semibold transition ${
                  active
                    ? "border-brand bg-brand/15 text-brand-bright"
                    : "border-fg/12 bg-fg/[0.03] text-fg/70 hover:border-fg/25 hover:text-fg"
                }`}
              >
                {w.label}
              </Link>
            );
          })}
          <span className="ml-1 text-xs text-fg/50">
            Dane: {zakres}
          </span>
        </div>

        {windowRequestedButEmpty ? (
          <div className="mb-6 rounded-2xl border border-brand/25 bg-brand/[0.06] px-5 py-4 text-sm text-fg/80">
            Dane dzienne zbieramy od dziś, więc okna 7/30 dni wypełnią się w kolejnych
            dniach (potrzebne min. 2 dni snapshotów). Poniżej pokazuję sumy{" "}
            <strong className="text-fg">od początku</strong>.
          </div>
        ) : null}

        {/* Duże liczby zbiorcze */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-fg/10 bg-fg/5 px-6 py-6"
            >
              <div
                className={`text-[34px] font-semibold leading-none md:text-[40px] ${
                  card.accent ? "text-brand-bright" : "text-fg"
                }`}
              >
                {formatIntPL(card.value)}
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/55">
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Ranking biur */}
        <div className="rounded-3xl border border-fg/10 bg-fg/5">
          <div className="border-b border-fg/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-fg">
              Ranking biur{" "}
              <span className="text-sm font-normal text-fg/50">
                ({report.rows.length})
              </span>
            </h2>
          </div>

          {report.rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-fg/60">
              Brak ofert z przypisanym właścicielem.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-fg/10 text-left text-fg/60">
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Biuro</th>
                    <th className="px-5 py-3 text-right font-medium">Oferty</th>
                    <th className="px-5 py-3 text-right font-medium">Wejścia</th>
                    <th className="px-5 py-3 text-right font-medium">Telefony</th>
                    <th className="px-5 py-3 text-right font-medium">Wiadomości</th>
                    <th className="px-5 py-3 text-right font-medium">Leady</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => {
                    const c = row.window ?? row.allTime;
                    return (
                      <tr
                        key={row.ownerId}
                        className="border-b border-fg/5 last:border-0 hover:bg-fg/[0.03]"
                      >
                        <td className="px-5 py-4 align-middle font-semibold text-fg/50">
                          {i + 1}
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-fg">{row.label}</span>
                            {row.isBiuro ? (
                              <span className="inline-flex shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-bright">
                                Biuro
                              </span>
                            ) : null}
                          </div>
                          {row.email ? (
                            <div className="mt-0.5 text-xs text-fg/45">{row.email}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-right align-middle text-fg/75">
                          {formatIntPL(row.offers)}
                        </td>
                        <td className="px-5 py-4 text-right align-middle text-fg/75">
                          {formatIntPL(c.detailViews)}
                        </td>
                        <td className="px-5 py-4 text-right align-middle font-semibold text-brand-bright">
                          {formatIntPL(c.phoneClicks)}
                        </td>
                        <td className="px-5 py-4 text-right align-middle font-semibold text-brand-bright">
                          {formatIntPL(c.messageClicks)}
                        </td>
                        <td className="px-5 py-4 text-right align-middle text-base font-bold text-fg">
                          {formatIntPL(c.leads)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-fg/45">
          Lead = telefon lub wiadomość (sygnał intencji zakupu). Sumy „od początku”
          liczone na żywo z liczników ofert; okna 7/30 dni z dziennych snapshotów
          (BiuroDailyStat). P16b doda biurom wykresy „dzień po dniu” w ich panelu.
        </p>
      </div>
    </main>
  );
}
