'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  buildAlertLabel,
  criteriaIsEmpty,
  criteriaFingerprint,
  type AlertCriteria,
} from '@/lib/alertCriteria';

type AlertState = 'idle' | 'sending' | 'ok' | 'exists' | 'pending' | 'error';

function BellIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function AlertBar({
  criteria,
  onCreated,
}: {
  criteria: AlertCriteria;
  // Wołane po udanym włączeniu/istnieniu alertu (ok, pending, exists). Strona oferty
  // korzysta z tego, żeby zapamiętać okolicę i nie proponować jej ponownie.
  onCreated?: () => void;
}) {
  const { status } = useSession();
  const isLogged = status === 'authenticated';

  const [state, setState] = useState<AlertState>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');

  const empty = criteriaIsEmpty(criteria);
  const label = empty ? '' : buildAlertLabel(criteria);

  // Reset przy zmianie filtrów: nowa lokalizacja/filtry = nowy alert, więc przycisk wraca.
  const fingerprint = criteriaFingerprint(criteria);
  const [lastFingerprint, setLastFingerprint] = useState(fingerprint);
  if (fingerprint !== lastFingerprint) {
    setLastFingerprint(fingerprint);
    if (state !== 'idle') setState('idle');
    if (msg !== null) setMsg(null);
    if (emailOpen) setEmailOpen(false);
    if (email) setEmail('');
  }

  async function createAlert(emailArg?: string) {
    setState('sending');
    setMsg(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailArg ? { ...criteria, email: emailArg } : criteria),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setState('error');
        setMsg(data?.message ?? 'Nie udało się włączyć powiadomień.');
        return;
      }

      if (data?.pending) setState('pending');
      else if (data?.alreadyExists) setState('exists');
      else setState('ok');

      onCreated?.();
    } catch {
      setState('error');
      setMsg('Nie udało się włączyć powiadomień. Spróbuj ponownie.');
    }
  }

  // Zalogowany → jedno kliknięcie (automat na e-mail z konta). Niezalogowany → pole e-mail.
  function handleClick() {
    if (empty || state === 'sending') return;
    if (isLogged) {
      createAlert();
      return;
    }
    setEmailOpen(true);
  }

  function submitEmail() {
    if (state === 'sending') return;
    if (!isValidEmail(email)) {
      setState('error');
      setMsg('Podaj poprawny adres e-mail.');
      return;
    }
    createAlert(email.trim().toLowerCase());
  }

  // Bez filtrów nie pokazujemy nic — alert dotyczy konkretnego wyszukiwania.
  if (empty) return null;

  if (state === 'ok' || state === 'exists') {
    return (
      <div className="flex items-center gap-2 text-[13px] text-brand-bright">
        <BellIcon />
        <span>{state === 'exists' ? 'Masz już takie powiadomienie.' : 'Powiadomienia włączone.'}</span>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="flex items-start gap-2 text-[13px] text-brand-bright">
        <BellIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="leading-snug text-fg/80">
          Sprawdź skrzynkę i potwierdź adres, żeby włączyć powiadomienia.
        </span>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-start gap-0.5">
      {!emailOpen ? (
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
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-[13px] font-medium text-fg/75">
              <span className="text-brand-bright">
                <BellIcon />
              </span>
              Podaj e-mail, wyślemy Ci powiadomienia o nowych ofertach
            </div>
            <span className="pl-6 text-[12px] leading-snug text-fg/68">
              {label ? `Dotyczy: ${label}` : 'Dotyczy tej okolicy i wybranych filtrów'}
            </span>
          </div>

          <div className="flex items-stretch gap-2">
            <input
              type="email"
              value={email}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === 'error') {
                  setState('idle');
                  setMsg(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEmail();
              }}
              placeholder="twoj@email.pl"
              // text-[16px]: mniejsza czcionka (<16px) wymusza na iOS/Androidzie auto-zoom
              // przy fokusie pola — 16px trzyma widok w miejscu (bez „przybliżania").
              className="h-10 min-w-0 flex-1 rounded-xl border border-fg/25 bg-transparent px-3 text-[16px] text-fg outline-none transition placeholder:text-fg/40 focus:border-brand"
            />
            <button
              type="button"
              onClick={submitEmail}
              disabled={state === 'sending'}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-[13px] font-semibold text-ink transition hover:bg-brand-bright disabled:opacity-60"
            >
              {state === 'sending' ? 'Wysyłam…' : 'Włącz'}
            </button>
          </div>
        </div>
      )}

      {/* Kontekst pod przyciskiem: zawsze widoczny, żeby było jasne, jakiej okolicy/filtrów dotyczy. */}
      {!emailOpen ? (
        <span className="block pl-6 text-[12px] leading-snug text-fg/68">
          {label}
        </span>
      ) : null}

      {state === 'error' && msg ? (
        <span className="pl-1 text-[12px] text-red-400/85">{msg}</span>
      ) : null}
    </div>
  );
}
