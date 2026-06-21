"use client";

import { useMemo, useState } from "react";

type DailyPoint = {
  date: string;
  views: number;
  detailViews: number;
  phoneClicks: number;
  messageClicks: number;
  leads: number;
};

type Counters = {
  views: number;
  detailViews: number;
  phoneClicks: number;
  messageClicks: number;
  leads: number;
};

type MetricKey = "leads" | "phoneClicks" | "messageClicks" | "detailViews" | "views";

type Props = {
  points: DailyPoint[];
  allTime: Counters;
  windowTotals: Counters;
  offers: number;
  snapshotDaysInWindow: number;
  windowDays: number;
};

const METRICS: { key: MetricKey; label: string; hint: string }[] = [
  { key: "leads", label: "Leady", hint: "telefon lub wiadomość" },
  { key: "phoneClicks", label: "Telefony", hint: "kliknięcia w numer" },
  { key: "messageClicks", label: "Wiadomości", hint: "otwarcia kontaktu" },
  { key: "detailViews", label: "Wejścia", hint: "otwarcia oferty" },
  { key: "views", label: "Wyświetlenia", hint: "lista i mapa" },
];

const HEADLINE: { key: MetricKey; label: string; hint: string; accent: boolean }[] = [
  { key: "leads", label: "Leady", hint: "telefon lub wiadomość", accent: true },
  { key: "phoneClicks", label: "Telefony", hint: "kliknięcia w numer", accent: false },
  { key: "messageClicks", label: "Wiadomości", hint: "otwarcia kontaktu", accent: false },
  { key: "detailViews", label: "Wejścia", hint: "otwarcia oferty", accent: false },
];

function formatIntPL(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value);
}

function formatDayShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function formatDayLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
  });
}

export default function PanelStatystyki({
  points,
  allTime,
  windowTotals,
  offers,
  snapshotDaysInWindow,
  windowDays,
}: Props) {
  const [metric, setMetric] = useState<MetricKey>("leads");

  const hasChart = points.length > 0;
  const activeMetric = METRICS.find((m) => m.key === metric)!;
  const windowSum = windowTotals[metric];

  const max = useMemo(
    () => Math.max(1, ...points.map((p) => p[metric])),
    [points, metric]
  );

  // Etykiety osi: pokaż maks. ~7, żeby nie zlewały się na wąskim ekranie.
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  if (offers === 0) {
    return (
      <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-fg">Brak danych</h2>
          <p className="mt-3 leading-7 text-fg/70">
            Statystyki pojawią się, gdy dodasz pierwszą działkę i zacznie ją
            ktoś oglądać.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Duże liczby — od początku, ze wszystkich ofert */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg/64">
            Łącznie ze wszystkich ofert
          </span>
          <span className="h-px flex-1 bg-fg/10" />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {HEADLINE.map((h) => (
            <div key={h.key} className="border-b border-fg/10 pb-2.5">
              <div
                className={`text-[30px] font-semibold leading-none tabular-nums md:text-[36px] ${
                  h.accent ? "text-brand-bright" : "text-fg"
                }`}
              >
                {formatIntPL(allTime[h.key])}
              </div>
              <div className="mt-2 text-[11px] font-medium leading-tight text-fg/80">
                {h.label}
              </div>
              <div className="text-[10px] leading-tight text-fg/55">{h.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wykres dzień po dniu */}
      <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[19px] font-medium text-fg">Dzień po dniu</div>
            <div className="mt-1 text-sm text-fg/60">
              Ostatnie {windowDays} dni
              {hasChart ? (
                <>
                  {" · "}
                  <span className="font-semibold text-brand-bright">
                    {formatIntPL(windowSum)}
                  </span>{" "}
                  {activeMetric.label.toLowerCase()} w tym okresie
                </>
              ) : null}
            </div>
          </div>

          {/* Przełącznik metryki — podkreślenia, nie pigułki */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            {METRICS.map((m) => {
              const active = m.key === metric;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className={`border-b-2 pb-1 transition ${
                    active
                      ? "border-brand text-fg"
                      : "border-transparent text-fg/55 hover:text-fg"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {hasChart ? (
          <div className="mt-7">
            <div className="flex h-44 items-end gap-[3px] sm:gap-1.5">
              {points.map((p) => {
                const value = p[metric];
                const heightPct = (value / max) * 100;
                return (
                  <div
                    key={p.date}
                    className="group relative flex h-full flex-1 items-end"
                  >
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-fg/10 bg-bg px-2.5 py-1.5 text-center opacity-0 shadow-lg transition group-hover:opacity-100">
                      <div className="text-[13px] font-semibold tabular-nums text-fg">
                        {formatIntPL(value)} {activeMetric.label.toLowerCase()}
                      </div>
                      <div className="text-[10px] text-fg/55">
                        {formatDayLong(p.date)}
                      </div>
                    </div>
                    <div
                      className="w-full rounded-t-[3px] bg-brand/80 transition group-hover:bg-brand"
                      style={{
                        height: value > 0 ? `max(${heightPct}%, 4px)` : "2px",
                        opacity: value > 0 ? 1 : 0.22,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Oś dat */}
            <div className="mt-2 flex gap-[3px] sm:gap-1.5">
              {points.map((p, i) => (
                <div
                  key={p.date}
                  className="flex-1 text-center text-[10px] tabular-nums text-fg/45"
                >
                  {i % labelEvery === 0 ? formatDayShort(p.date) : ""}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-brand/25 bg-brand/[0.06] px-5 py-6 text-sm leading-7 text-fg/80">
            Zbieramy dane dzień po dniu. Wykres pojawi się, gdy uzbieramy co
            najmniej dwa dni pomiarów
            {snapshotDaysInWindow >= 1 ? " (pierwszy już mamy)" : ""}. Liczby
            powyżej są aktualne od początku.
          </div>
        )}
      </div>
    </div>
  );
}
