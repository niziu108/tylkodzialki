'use client';

import { useEffect, useState } from 'react';
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

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function AlertBar({ criteria }: { criteria: AlertCriteria }) {
  const { status } = useSession();
  const isLogged = status === 'authenticated';

  const [state, setState] = useState<AlertState>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
    if (modalOpen) setModalOpen(false);
    if (email) setEmail('');
  }

  // Blokada scrolla tła, gdy modal otwarty — bez tego strona „ucieka" pod nakładką
  // (na mobile podskok przy pojawieniu klawiatury). Zamknięcie przywraca scroll.
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [modalOpen]);

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
    } catch {
      setState('error');
      setMsg('Nie udało się włączyć powiadomień. Spróbuj ponownie.');
    }
  }

  // Zalogowany → jedno kliknięcie (automat na e-mail z konta). Niezalogowany → modal z polem e-mail.
  function handleClick() {
    if (empty || state === 'sending') return;
    if (isLogged) {
      createAlert();
      return;
    }
    setState('idle');
    setMsg(null);
    setModalOpen(true);
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

  // Zalogowany dostaje potwierdzenie inline (klik = od razu włączone, bez modala).
  const inlineConfirm = isLogged && (state === 'ok' || state === 'exists' || state === 'pending');

  if (inlineConfirm) {
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
      <div className="flex items-center gap-2 text-[13px] text-brand-bright">
        <BellIcon />
        <span>{state === 'exists' ? 'Masz już takie powiadomienie.' : 'Powiadomienia włączone.'}</span>
      </div>
    );
  }

  const done = state === 'ok' || state === 'exists' || state === 'pending';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'sending'}
        className="group inline-flex items-center gap-2 text-[13px] font-medium text-fg/75 transition hover:text-fg disabled:opacity-60"
      >
        <span className="text-brand-bright">
          <BellIcon />
        </span>
        <span className="flex flex-col items-start">
          <span>{state === 'sending' ? 'Włączam…' : 'Powiadom mnie o nowych ofertach'}</span>
          {label ? (
            <span className="text-[12px] font-normal leading-snug text-fg/68">{label}</span>
          ) : null}
        </span>
      </button>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-fg/12 bg-bg p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand/12 text-brand-text">
              {done ? <CheckIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
            </div>

            {done ? (
              <>
                <h2 className="mt-4 font-display text-[22px] uppercase tracking-[0.08em] text-fg/55">
                  {state === 'exists' ? 'Już to masz' : state === 'pending' ? 'Sprawdź skrzynkę' : 'Gotowe'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-fg/70">
                  {state === 'pending'
                    ? <>Wysłaliśmy link potwierdzający na <span className="font-medium text-fg">{email}</span>. Kliknij go, aby włączyć powiadomienia.</>
                    : state === 'exists'
                    ? 'Masz już powiadomienie o takim wyszukiwaniu.'
                    : 'Powiadomienia włączone. Napiszemy, gdy pojawią się nowe oferty.'}
                </p>

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="mt-6 h-12 w-full rounded-2xl border border-brand/60 bg-brand px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong"
                >
                  Zamknij
                </button>
              </>
            ) : (
              <>
                <h2 className="mt-4 font-display text-[22px] uppercase tracking-[0.08em] text-fg/55">
                  Powiadomienia o ofertach
                </h2>

                {label ? (
                  <p className="mt-3 inline-flex max-w-full items-center rounded-full border border-fg/12 bg-fg/[0.04] px-3 py-1.5 text-[12px] leading-snug text-fg/72">
                    <span className="truncate">{label}</span>
                  </p>
                ) : null}

                <div className="mt-6 flex flex-col gap-3">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
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
                    placeholder="Wpisz swój e-mail"
                    className={`field-line ${state === 'error' ? 'field-line-error' : ''} h-11 w-full bg-transparent px-1 text-center text-[16px] text-fg outline-none placeholder:text-fg/40`}
                  />

                  {state === 'error' && msg ? (
                    <p className="text-[12px] text-red-400/85">{msg}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={submitEmail}
                    disabled={state === 'sending'}
                    className="h-12 w-full rounded-2xl border border-brand/60 bg-brand px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong disabled:opacity-60"
                  >
                    {state === 'sending' ? 'Wysyłam…' : 'Włącz powiadomienia'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-11 w-full rounded-2xl border border-fg/14 bg-transparent px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-fg/75 transition hover:border-fg/30 hover:text-fg"
                  >
                    Może później
                  </button>
                </div>

                <p className="mt-4 text-[11px] leading-snug text-fg/50">
                  Bez spamu. Wypiszesz się jednym kliknięciem.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
