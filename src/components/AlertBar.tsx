'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { buildAlertLabel, criteriaIsEmpty, type AlertCriteria } from '@/lib/alertCriteria';

const PENDING_KEY = 'TD_PENDING_ALERT';

type AlertState = 'idle' | 'sending' | 'ok' | 'exists' | 'error';

function BellIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
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
        setMsg(data?.message ?? 'Nie udało się włączyć powiadomień.');
        return;
      }
      if (data?.alreadyExists) {
        setState('exists');
        setMsg('Masz już takie powiadomienie.');
        return;
      }
      setState('ok');
      setMsg('Gotowe. Powiadomimy Cię mailem, gdy pojawi się nowa działka wg tych filtrów.');
    } catch {
      setState('error');
      setMsg('Nie udało się włączyć powiadomień. Spróbuj ponownie.');
    }
  }

  function goToLogin() {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(criteria));
    } catch {}

    const sp = new URLSearchParams(window.location.search);
    sp.set('autoalert', '1');
    const cb = `${window.location.pathname}?${sp.toString()}`;
    window.location.href = `/auth?callbackUrl=${encodeURIComponent(cb)}`;
  }

  // Po powrocie z logowania dokończ włączanie powiadomień (wzorzec jak /sprzedaj autopublish).
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
      setLoginPromptOpen(true);
      return;
    }
    createAlert(criteria);
  }

  // Bez filtrów nie pokazujemy nic — alert dotyczy konkretnego wyszukiwania (decyzja właściciela).
  if (empty) return null;

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
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={state === 'sending'}
          className="inline-flex shrink-0 items-center gap-2 rounded-[10px] border border-[#7aa333]/50 bg-[#7aa333]/15 px-3.5 py-2.5 text-[13px] font-medium text-[#9fd14b] transition hover:border-[#7aa333] hover:bg-[#7aa333]/25 disabled:opacity-60"
        >
          <BellIcon />
          {state === 'sending' ? 'Włączam…' : 'Powiadom mnie o nowych ofertach'}
        </button>

        <span className="text-[12.5px] leading-snug text-white/60">
          wg Twoich filtrów: {label}
        </span>

        {state === 'error' && msg ? (
          <span className="text-[12px] text-red-400/85">{msg}</span>
        ) : null}
      </div>

      {loginPromptOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[#131313] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#7aa333]/35 bg-[#7aa333]/12 text-[#9fd14b]">
              <BellIcon className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-[22px] font-semibold leading-tight text-white">
              Powiadomienia o nowych ofertach
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/65">
              Zaloguj się, aby otrzymywać e-mail, gdy pojawi się nowa działka pasująca do Twoich filtrów.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="h-12 rounded-2xl border border-white/14 bg-transparent px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Może później
              </button>

              <button
                type="button"
                onClick={goToLogin}
                className="h-12 rounded-2xl border border-[#7aa333]/60 bg-[#7aa333] px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#131313] transition hover:bg-[#8dbb3a]"
              >
                Zaloguj się
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
