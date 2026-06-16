'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { buildAlertLabel, criteriaIsEmpty, type AlertCriteria } from '@/lib/alertCriteria';

const PENDING_KEY = 'TD_PENDING_ALERT';

type AlertState = 'idle' | 'sending' | 'ok' | 'exists' | 'error';

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function AlertBar({ criteria }: { criteria: AlertCriteria }) {
  const { status } = useSession();
  const isLogged = status === 'authenticated';

  const [state, setState] = useState<AlertState>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const autoTriedRef = useRef(false);

  const empty = criteriaIsEmpty(criteria);
  const label = empty ? '' : buildAlertLabel(criteria);

  async function createAlert(c: AlertCriteria) {
    setState('sending');
    setMsg(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setState('error');
        setMsg(data?.message ?? 'Nie udało się włączyć alertu.');
        return;
      }
      if (data?.alreadyExists) {
        setState('exists');
        setMsg('Masz już taki alert.');
        return;
      }
      setState('ok');
      setMsg('Gotowe. Powiadomimy Cię mailem.');
    } catch {
      setState('error');
      setMsg('Nie udało się włączyć alertu.');
    }
  }

  // Po powrocie z logowania dokończ włączanie alertu (wzorzec jak /sprzedaj autopublish).
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (status !== 'authenticated') return;
    if (typeof window === 'undefined') return;

    const sp = new URLSearchParams(window.location.search);
    if (sp.get('autoalert') !== '1') return;

    let pending: AlertCriteria | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) pending = JSON.parse(raw) as AlertCriteria;
    } catch {}

    autoTriedRef.current = true;

    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}

    sp.delete('autoalert');
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);

    if (pending && !criteriaIsEmpty(pending)) {
      const c = pending;
      // Defer poza ciało efektu — unika synchronicznego setState w efekcie (kaskadowe rendery).
      queueMicrotask(() => createAlert(c));
    }
  }, [status]);

  function handleClick() {
    if (empty || state === 'sending') return;

    if (!isLogged) {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(criteria));
      } catch {}

      const sp = new URLSearchParams(window.location.search);
      sp.set('autoalert', '1');
      const cb = `${window.location.pathname}?${sp.toString()}`;
      window.location.href = `/auth?callbackUrl=${encodeURIComponent(cb)}`;
      return;
    }

    createAlert(criteria);
  }

  // Stonowana ramka, czytelna, zieleń tylko jako akcent. Bez długich myślników.
  if (state === 'ok' || state === 'exists') {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[#7aa333]/30 bg-[#7aa333]/[0.08] px-4 py-3 text-[13px] text-[#cfe3a6]">
        <span className="shrink-0 text-[#9fd14b]">
          <BellIcon />
        </span>
        <span>{msg}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7aa333]/15 text-[#9fd14b]">
            <BellIcon />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-medium leading-snug text-white">
              Powiadomienia o nowych ofertach
            </div>
            <div className="mt-0.5 truncate text-[12px] leading-snug text-white/60">
              {empty
                ? 'Ustaw filtry, a wyślemy e-mail o nowej pasującej ofercie.'
                : label
                  ? `Wyślemy e-mail, gdy pojawi się: „${label}".`
                  : 'Wyślemy e-mail, gdy pojawi się pasująca oferta.'}
            </div>
            {state === 'error' && msg ? (
              <div className="mt-1 text-[12px] text-red-400/85">{msg}</div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={empty || state === 'sending'}
          className="shrink-0 self-start rounded-lg border border-[#7aa333]/45 bg-[#7aa333]/15 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9fd14b] transition hover:border-[#7aa333] hover:bg-[#7aa333]/25 disabled:cursor-not-allowed disabled:opacity-45 sm:self-auto"
        >
          {state === 'sending' ? 'Zapisuję…' : 'Włącz'}
        </button>
      </div>
    </div>
  );
}
