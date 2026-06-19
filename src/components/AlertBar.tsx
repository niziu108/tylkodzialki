'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  buildAlertLabel,
  criteriaIsEmpty,
  criteriaFingerprint,
  type AlertCriteria,
} from '@/lib/alertCriteria';

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

  // Reset przy zmianie filtrów: nowa lokalizacja/filtry = nowy alert, więc przycisk wraca
  // (można mieć kilka alertów). Wzorzec „adjust state on prop change" (setState w renderze, guard).
  const fingerprint = criteriaFingerprint(criteria);
  const [lastFingerprint, setLastFingerprint] = useState(fingerprint);
  if (fingerprint !== lastFingerprint) {
    setLastFingerprint(fingerprint);
    if (state !== 'idle') setState('idle');
    if (msg !== null) setMsg(null);
    if (loginPromptOpen) setLoginPromptOpen(false);
  }

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
      setState(data?.alreadyExists ? 'exists' : 'ok');
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
    window.location.href = `/logowanie?callbackUrl=${encodeURIComponent(cb)}`;
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
      <div className="flex items-center gap-2 text-[13px] text-brand-bright">
        <BellIcon />
        <span>{state === 'exists' ? 'Masz już takie powiadomienie.' : 'Powiadomienia włączone.'}</span>
      </div>
    );
  }

  return (
    <>
      <div className="group flex flex-col items-start gap-0.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={state === 'sending'}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-fg/75 transition hover:text-fg disabled:opacity-60"
        >
          <span className="text-brand-bright">
            <BellIcon />
          </span>
          {state === 'sending' ? 'Włączam…' : 'Powiadom mnie o nowych ofertach'}
        </button>

        {/* Kontekst pod przyciskiem (w tym samym miejscu): na mobile zawsze, na desktopie na hover. */}
        <span className="block pl-6 text-[12px] leading-snug text-fg/45 sm:hidden sm:group-hover:block">
          {label}
        </span>

        {state === 'error' && msg ? (
          <span className="pl-6 text-[12px] text-red-400/85">{msg}</span>
        ) : null}
      </div>

      {loginPromptOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-fg/12 bg-bg p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand/35 bg-brand/12 text-brand-bright">
              <BellIcon className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-[22px] font-semibold leading-tight text-fg">
              Powiadomienia o nowych ofertach
            </h2>

            <p className="mt-3 text-sm leading-6 text-fg/65">
              Zaloguj się, aby otrzymywać e-mail, gdy pojawi się nowa działka pasująca do Twoich filtrów.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setLoginPromptOpen(false)}
                className="h-12 rounded-2xl border border-fg/14 bg-transparent px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-fg/75 transition hover:border-fg/30 hover:text-fg"
              >
                Może później
              </button>

              <button
                type="button"
                onClick={goToLogin}
                className="h-12 rounded-2xl border border-brand/60 bg-brand px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong"
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
