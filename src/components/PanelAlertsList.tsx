'use client';

import { useState } from 'react';
import Link from 'next/link';

export type PanelAlert = {
  id: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  lastNotifiedAt: string | null;
};

function formatDatePL(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pl-PL');
}

// „Działki budowlane PUSZCZYKOWO + 5 km" -> „Działki budowlane Puszczykowo + 5 km".
// Tylko słowa z samych wielkich liter dłuższe niż 3 znaki (skróty typu „MPZP" i tak tu nie trafiają).
function ladnaEtykieta(label: string) {
  return label.replace(/\p{Lu}{4,}/gu, (w) => w[0] + w.slice(1).toLowerCase());
}

export default function PanelAlertsList({ initialAlerts }: { initialAlerts: PanelAlert[] }) {
  const [alerts, setAlerts] = useState<PanelAlert[]>(initialAlerts);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(id: string, next: boolean) {
    setBusyId(id);
    const prev = alerts;
    setAlerts((list) => list.map((a) => (a.id === id ? { ...a, isActive: next } : a)));
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error('fail');
    } catch {
      setAlerts(prev);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    const prev = alerts;
    setAlerts((list) => list.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('fail');
    } catch {
      setAlerts(prev);
    } finally {
      setBusyId(null);
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-[28px] border border-fg/10 bg-fg/[0.03] p-8 md:p-10">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-fg">Brak alertów</h2>
          <p className="mt-3 leading-7 text-fg/70">
            Włącz alert w wyszukiwarce, a wyślemy Ci e-mail, gdy pojawi się nowa działka pasująca do
            Twoich kryteriów. Nie musisz codziennie sprawdzać ofert.
          </p>
          <Link
            href="/kup"
            className="mt-6 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Szukaj działek
          </Link>
        </div>
      </div>
    );
  }

  // Wiersze z cienką linią zamiast kart w ramkach, akcje zwykłymi słowami zamiast
  // wersalików w przyciskach (blade „USUŃ" było słabo czytelne). Nazwy miejscowości
  // z feedów bywają wersalikami („PUSZCZYKOWO"), więc wyświetlamy je normalnie (13.10).
  return (
    <div className="divide-y divide-fg/10 border-y border-fg/10">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex flex-col gap-2.5 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-medium leading-snug text-fg">{ladnaEtykieta(a.label)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-fg/62">
              <span className={`inline-flex items-center gap-1.5 ${a.isActive ? 'text-brand-text' : ''}`}>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${a.isActive ? 'bg-brand' : 'bg-fg/30'}`}
                />
                {a.isActive ? 'Aktywny' : 'Wstrzymany'}
              </span>
              <span aria-hidden="true">·</span>
              <span>od {formatDatePL(a.createdAt)}</span>
              {a.lastNotifiedAt ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>ostatni e-mail {formatDatePL(a.lastNotifiedAt)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-5 text-[14px]">
            <button
              type="button"
              onClick={() => toggle(a.id, !a.isActive)}
              disabled={busyId === a.id}
              className="font-medium text-fg/75 underline decoration-fg/20 underline-offset-4 transition hover:text-fg disabled:opacity-50"
            >
              {a.isActive ? 'Wstrzymaj' : 'Wznów'}
            </button>
            <button
              type="button"
              onClick={() => remove(a.id)}
              disabled={busyId === a.id}
              className="font-medium text-red-700 underline decoration-red-700/25 underline-offset-4 transition hover:decoration-red-700 disabled:opacity-50"
            >
              Usuń
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
