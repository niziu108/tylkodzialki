// /admin/powiadomienia — wgląd we wszystkie alerty kupujących (OfferAlert).
//
// Trzy rzeczy na jednym ekranie:
//   1. kto ma powiadomienie (adres e-mail, konto czy sama subskrypcja),
//   2. na co dokładnie czeka (obszar + rozpisane wytyczne: cena, metraż, przeznaczenie),
//   3. gdzie siedzi popyt (rozkład po miastach) — to argument do rozmowy z biurami.
// Plus kasowanie pojedynczego alertu.

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import {
  ALERT_STATUS_LABEL,
  getAlertsAdminReport,
  NO_CITY_KEY,
  type AlertStatus,
} from "@/lib/alertsAdmin";
import { deleteOfferAlertAction } from "./actions";
import CopyEmailsButton from "./CopyEmailsButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Powiadomienia",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<{ status?: string; miasto?: string; q?: string }>;
};

const STATUS_FILTERS: { key: AlertStatus | "all"; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "aktywny", label: "Aktywne" },
  { key: "oczekuje", label: "Czekają na potwierdzenie" },
  { key: "wstrzymany", label: "Wstrzymane" },
];

function formatIntPL(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value);
}

function formatDatePL(value: Date | null) {
  if (!value) return "brak";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function parseStatus(value: string | undefined): AlertStatus | null {
  if (value === "aktywny" || value === "oczekuje" || value === "wstrzymany") return value;
  return null;
}

function buildHref(params: { status?: AlertStatus | null; miasto?: string | null; q?: string | null }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.miasto) sp.set("miasto", params.miasto);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/admin/powiadomienia?${qs}` : "/admin/powiadomienia";
}

const STATUS_STYLE: Record<AlertStatus, string> = {
  aktywny: "bg-brand/20 text-brand-bright",
  oczekuje: "bg-amber-400/15 text-amber-300",
  wstrzymany: "bg-fg/10 text-fg/60",
};

export default async function PowiadomieniaPage({ searchParams }: PageProps) {
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
  const status = parseStatus(params?.status);
  const miasto = params?.miasto?.trim() || null;
  const q = params?.q?.trim() || null;

  const report = await getAlertsAdminReport({ status, cityKey: miasto, q });

  const activeCity = miasto ? report.cities.find((c) => c.key === miasto) ?? null : null;
  const hasFilters = Boolean(status || miasto || q);

  const summaryCards = [
    { label: "Aktywne alerty", value: report.summary.aktywne, accent: true },
    { label: "Osoby (unikalne adresy)", value: report.summary.osoby, accent: true },
    { label: "Czekają na potwierdzenie", value: report.summary.oczekujace, accent: false },
    { label: "Nowe (30 dni)", value: report.summary.nowe30d, accent: false },
  ];

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-fg/85">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-bright">
              Popyt
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Powiadomienia
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-fg/70">
              Kto czeka na nowe oferty, na jaki adres i wg jakich wytycznych. Rozkład po
              miastach pokazuje, gdzie mamy realnych kupujących.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-fg/10 bg-fg/5 px-5 text-sm font-semibold text-fg transition hover:bg-fg/10"
          >
            ← Panel admina
          </Link>
        </div>

        {/* Liczby zbiorcze — zawsze z całej bazy, filtry ich nie ruszają. */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-3xl border border-fg/10 bg-fg/5 px-6 py-6">
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

        {/* Rozkład po miastach */}
        <div className="mb-8 rounded-3xl border border-fg/10 bg-fg/5">
          <div className="border-b border-fg/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-fg">
              Kupujący wg miast{" "}
              <span className="text-sm font-normal text-fg/50">({report.cities.length})</span>
            </h2>
            <p className="mt-1 text-xs text-fg/55">
              Miasto = najbliższy punkt alertu z naszej listy miast (do 60 km). Kliknij wiersz,
              żeby zawęzić listę poniżej.
            </p>
          </div>

          {report.cities.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-fg/60">
              Nikt jeszcze nie włączył powiadomień.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-fg/10 text-left text-fg/60">
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Miasto</th>
                    <th className="px-5 py-3 text-right font-medium">Osoby</th>
                    <th className="px-5 py-3 text-right font-medium">Aktywne</th>
                    <th className="px-5 py-3 text-right font-medium">Wszystkie</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cities.map((city, i) => {
                    const selected = city.key === miasto;
                    return (
                      <tr
                        key={city.key}
                        className={`border-b border-fg/5 last:border-0 ${
                          selected ? "bg-brand/[0.08]" : "hover:bg-fg/[0.03]"
                        }`}
                      >
                        <td className="px-5 py-3 text-fg/45">{i + 1}</td>
                        <td className="px-5 py-3">
                          <Link
                            href={buildHref({
                              status,
                              q,
                              miasto: selected ? null : city.key,
                            })}
                            className={`font-medium underline-offset-4 hover:underline ${
                              selected ? "text-brand-bright" : "text-fg"
                            }`}
                          >
                            {city.label}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-fg">
                          {formatIntPL(city.osoby)}
                        </td>
                        <td className="px-5 py-3 text-right text-brand-bright">
                          {formatIntPL(city.aktywne)}
                        </td>
                        <td className="px-5 py-3 text-right text-fg/60">
                          {formatIntPL(city.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Filtry */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => {
            const isActive = f.key === "all" ? status === null : status === f.key;
            return (
              <Link
                key={f.key}
                href={buildHref({ status: f.key === "all" ? null : f.key, miasto, q })}
                className={`inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-semibold transition ${
                  isActive
                    ? "border-brand bg-brand/15 text-brand-bright"
                    : "border-fg/12 bg-fg/[0.03] text-fg/70 hover:border-fg/25 hover:text-fg"
                }`}
              >
                {f.label}
              </Link>
            );
          })}

          <form method="get" action="/admin/powiadomienia" className="flex items-center gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {miasto ? <input type="hidden" name="miasto" value={miasto} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Szukaj po mailu lub obszarze"
              className="h-10 w-64 rounded-full border border-fg/12 bg-fg/[0.03] px-4 text-base text-fg placeholder:text-fg/40 focus:border-fg/30 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full border border-fg/12 bg-fg/[0.03] px-5 text-sm font-semibold text-fg/75 transition hover:border-fg/25 hover:text-fg"
            >
              Szukaj
            </button>
          </form>

          <CopyEmailsButton emails={report.rows.map((r) => r.email)} />

          {hasFilters ? (
            <Link
              href="/admin/powiadomienia"
              className="text-sm text-fg/55 underline-offset-4 hover:text-fg hover:underline"
            >
              Wyczyść filtry
            </Link>
          ) : null}
        </div>

        {/* Lista alertów */}
        <div className="rounded-3xl border border-fg/10 bg-fg/5">
          <div className="border-b border-fg/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-fg">
              Alerty{" "}
              <span className="text-sm font-normal text-fg/50">
                ({formatIntPL(report.rows.length)}
                {report.rows.length !== report.summary.total
                  ? ` z ${formatIntPL(report.summary.total)}`
                  : ""}
                )
              </span>
            </h2>
            {activeCity ? (
              <p className="mt-1 text-xs text-fg/55">
                Filtr miasta: <strong className="text-fg/80">{activeCity.label}</strong>
                {activeCity.key === NO_CITY_KEY
                  ? " (alerty bez współrzędnych, np. same widełki ceny)"
                  : ""}
              </p>
            ) : null}
          </div>

          {report.rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-fg/60">
              {hasFilters
                ? "Brak alertów dla tych filtrów."
                : "Nikt jeszcze nie włączył powiadomień."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-fg/10 text-left text-fg/60">
                    <th className="px-5 py-3 font-medium">Odbiorca</th>
                    <th className="px-5 py-3 font-medium">Czego szuka</th>
                    <th className="px-5 py-3 font-medium">Miasto</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Utworzony</th>
                    <th className="px-5 py-3 font-medium">Ostatni mail</th>
                    <th className="px-5 py-3 text-right font-medium">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-fg/5 align-top last:border-0 hover:bg-fg/[0.03]"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-fg">{row.email}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-fg/45">
                          {row.source}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-fg">{row.label}</div>
                        {row.queryText ? (
                          <div className="mt-1 text-xs text-fg/60">
                            Wpisany obszar: {row.queryText}
                          </div>
                        ) : null}
                        {row.criteriaLines.length ? (
                          <ul className="mt-2 space-y-0.5 text-xs text-fg/60">
                            {row.criteriaLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-fg/80">{row.cityLabel}</div>
                        {row.cityDistanceKm !== null ? (
                          <div className="mt-1 text-xs text-fg/45">
                            {row.cityDistanceKm} km od centrum
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            STATUS_STYLE[row.status]
                          }`}
                        >
                          {ALERT_STATUS_LABEL[row.status]}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-fg/70">{formatDatePL(row.createdAt)}</td>
                      <td className="px-5 py-4 text-fg/70">{formatDatePL(row.lastNotifiedAt)}</td>

                      <td className="px-5 py-4 text-right">
                        <form action={deleteOfferAlertAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="rounded-xl border border-red-400/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400/85 transition hover:border-red-400/55 hover:text-red-400"
                          >
                            Usuń
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
