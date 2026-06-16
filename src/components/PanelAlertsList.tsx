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
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-10">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-white">Brak alertów</h2>
          <p className="mt-3 leading-7 text-white/65">
            Włącz alert w wyszukiwarce, a wyślemy Ci e-mail, gdy pojawi się nowa działka pasująca do
            Twoich kryteriów. Nie musisz codziennie sprawdzać ofert.
          </p>
          <Link
            href="/kup"
            className="mt-6 inline-flex rounded-full bg-[#7aa333] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Szukaj działek
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  a.isActive ? 'bg-[#7aa333]/20 text-[#9fd14b]' : 'bg-white/10 text-white/55'
                }`}
              >
                {a.isActive ? 'Aktywny' : 'Wstrzymany'}
              </span>
            </div>
            <div className="mt-2 truncate text-[15px] font-medium text-white">{a.label}</div>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/45">
              <span>Utworzony: {formatDatePL(a.createdAt)}</span>
              <span>Ostatni mail: {formatDatePL(a.lastNotifiedAt)}</span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => toggle(a.id, !a.isActive)}
              disabled={busyId === a.id}
              className="rounded-xl border border-white/14 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              {a.isActive ? 'Wstrzymaj' : 'Wznów'}
            </button>
            <button
              type="button"
              onClick={() => remove(a.id)}
              disabled={busyId === a.id}
              className="rounded-xl border border-red-400/25 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300/85 transition hover:border-red-400/55 hover:text-red-300 disabled:opacity-50"
            >
              Usuń
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
