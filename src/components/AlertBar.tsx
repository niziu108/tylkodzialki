'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { buildAlertLabel, criteriaIsEmpty, type AlertCriteria } from '@/lib/alertCriteria';

const PENDING_KEY = 'TD_PENDING_ALERT';

type AlertState = 'idle' | 'sending' | 'ok' | 'exists' | 'error';

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  // Dyskretna, jednolinijkowa kontrolka — nie konkuruje z ofertami.
  if (state === 'ok' || state === 'exists') {
    return (
      <div className="inline-flex items-center gap-1.5 text-[12px] text-[#9fd14b]">
        <BellIcon />
        <span>{msg}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[12px]">
      <button
        type="button"
        onClick={handleClick}
        disabled={empty || state === 'sending'}
        title={label ? `Alert: „${label}".` : undefined}
        className="group inline-flex items-center gap-1.5 text-white/45 transition hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-white/45"
      >
        <span className="text-[#7aa333] transition group-hover:text-[#9fd14b]">
          <BellIcon />
        </span>
        <span className="underline-offset-4 group-hover:underline">
          {state === 'sending' ? 'Zapisuję…' : 'Powiadom mnie o nowych ofertach'}
        </span>
      </button>

      {empty ? (
        <span className="text-[11px] text-white/25">— ustaw filtry</span>
      ) : null}
      {state === 'error' && msg ? (
        <span className="text-[11px] text-red-400/80">{msg}</span>
      ) : null}
    </div>
  );
}
