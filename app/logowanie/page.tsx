'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import ScrollFill from '@/components/ScrollFill';

const BG = 'var(--bg)';
const FG = 'var(--fg)';
const GREEN = 'var(--brand)';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BENEFITS = [
  {
    title: 'Wystaw działkę w 3 minuty',
    body: 'Prosty kreator krok po kroku. Bez dzwonienia, ogłoszenie od razu online.',
  },
  {
    title: 'Dodawanie ogłoszeń jest darmowe',
    body: 'Wystawiasz grunt bez opłat i docierasz do kupujących z całej Polski.',
  },
  {
    title: 'Zapisuj działki do ulubionych',
    body: 'Odkładasz ciekawe oferty na konto i wracasz do nich, kiedy chcesz.',
  },
  {
    title: 'Zarządzaj ofertami z panelu',
    body: 'Edytujesz i aktualizujesz swoje ogłoszenia w każdej chwili.',
  },
];

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.2 0 6 .9 8.2 2.7l6.1-6.1C34.6 2.7 29.8 1 24 1 14.6 1 6.6 6.4 2.7 14.2l7.2 5.6C11.7 13.6 17.4 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-2.7-.4-4H24v7.7h12.6c-.5 3-2.4 5.6-5.3 7.3l6.5 5C42.8 36.9 46.1 31.3 46.1 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M9.9 28.2c-.5-1.4-.8-2.8-.8-4.2s.3-2.8.8-4.2l-7.2-5.6C1.6 16.5 1 20.2 1 24s.6 7.5 1.7 10.8l7.2-5.6z"
      />
      <path
        fill="#34A853"
        d="M24 47c5.8 0 10.6-1.9 14.1-5.2l-6.5-5c-1.8 1.2-4.2 2.1-7.6 2.1-6.6 0-12.3-4.1-14.1-9.7l-7.2 5.6C6.6 41.6 14.6 47 24 47z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 10.6l3.6 3.6L16 5.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AuthPageContent() {
  const sp = useSearchParams();
  const { status } = useSession();

  const callbackUrl = useMemo(() => {
    const url = sp.get('callbackUrl')?.trim();

    if (!url || url === '/' || url === '') {
      return '/panel';
    }

    return url;
  }, [sp]);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [rodo, setRodo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (status === 'authenticated') {
      window.location.replace(callbackUrl);
    }
  }, [status, callbackUrl]);

  const tabBtn = (active: boolean) =>
    cx(
      'px-4 py-2 rounded-full text-[13px] md:text-[14px] font-semibold tracking-tight transition',
      active ? 'text-fg' : 'text-fg/70 hover:text-fg'
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError('');
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !pass) {
      setError('Podaj email i hasło.');
      return;
    }

    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Podaj poprawny adres email.');
      return;
    }

    if (mode === 'register' && pass.length < 8) {
      setError('Hasło musi mieć minimum 8 znaków.');
      return;
    }

    if (mode === 'register' && !rodo) {
      setError('Zaakceptuj politykę prywatności, aby się zarejestrować.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass, name: name.trim() }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data?.message || 'Nie udało się zarejestrować.');
          if (res.status === 409) setMode('login');
          return;
        }
      }

      const result = await signIn('credentials', {
        email: cleanEmail,
        password: pass,
        redirect: false,
        callbackUrl,
      });

      if (!result) {
        setError('Błąd logowania.');
        return;
      }

      if (result.error) {
        setError(
          mode === 'login'
            ? 'Nieprawidłowy email lub hasło.'
            : 'Nie udało się zalogować po rejestracji.'
        );
        return;
      }

      window.location.replace(result.url || callbackUrl);
    } catch (err) {
      console.error(err);
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return (
      <main className="min-h-screen" style={{ background: BG, color: FG }}>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="text-fg/72">Ładowanie…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: BG, color: FG }}>
      <div className="min-h-screen w-full">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <div className="flex items-center justify-center px-6 py-10 lg:py-0">
            <div className="w-full max-w-md">
              <div className="rounded-3xl border border-fg/10 p-6 md:p-7">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    className={tabBtn(mode === 'login')}
                    style={{
                      border:
                        mode === 'login'
                          ? '1px solid var(--brand)'
                          : '1px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    Zaloguj się
                  </button>

                  <div className="text-fg/62">/</div>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError('');
                    }}
                    className={tabBtn(mode === 'register')}
                    style={{
                      border:
                        mode === 'register'
                          ? '1px solid var(--brand)'
                          : '1px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    Zarejestruj się
                  </button>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      signIn('google', {
                        callbackUrl,
                        prompt: 'select_account',
                      })
                    }
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-fg/15 bg-fg/[0.03] px-4 py-4 font-semibold transition hover:bg-fg/[0.06]"
                  >
                    <GoogleIcon />
                    Kontynuuj z Google
                  </button>
                </div>

                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-fg/10" />
                  <div className="text-[12px] uppercase tracking-[0.14em] text-fg/68">
                    albo
                  </div>
                  <div className="h-px flex-1 bg-fg/10" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === 'register' && (
                    <label className="block">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">
                        Imię
                      </div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        type="text"
                        autoComplete="name"
                        className={cx(
                          'mt-2 w-full bg-transparent text-[18px] text-fg/90',
                          'field-line pb-2',
                          'placeholder:text-fg/62 outline-none',
                          'selection:bg-fg/20 selection:text-fg'
                        )}
                      />
                    </label>
                  )}

                  <label className="block">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">
                      Email
                    </div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      className={cx(
                        'mt-2 w-full bg-transparent text-[18px] text-fg/90',
                        'field-line pb-2',
                        'placeholder:text-fg/62 outline-none',
                        'selection:bg-fg/20 selection:text-fg'
                      )}
                    />
                  </label>

                  <label className="block">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">
                      Hasło
                    </div>
                    <input
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      type="password"
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      placeholder="••••••••"
                      className={cx(
                        'mt-2 w-full bg-transparent text-[18px] text-fg/90',
                        'field-line pb-2',
                        'placeholder:text-fg/62 outline-none',
                        'selection:bg-fg/20 selection:text-fg'
                      )}
                    />
                  </label>

                  {mode === 'register' && (
                    <label className="flex items-start gap-3 text-[12px] leading-relaxed text-fg/70">
                      <input
                        type="checkbox"
                        checked={rodo}
                        onChange={(e) => setRodo(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                      />
                      <span>
                        Zapoznałem się i akceptuję{' '}
                        <a
                          href="/polityka-prywatnosci"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-white/25 underline-offset-4 transition hover:text-fg/85"
                          style={{ color: GREEN }}
                        >
                          politykę prywatności
                        </a>{' '}
                        oraz{' '}
                        <a
                          href="/regulamin"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-white/25 underline-offset-4 transition hover:text-fg/85"
                          style={{ color: GREEN }}
                        >
                          regulamin
                        </a>
                        .
                      </span>
                    </label>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                      {error}
                    </div>
                  )}

                  <div className="pt-1">
                    <a
                      href="/logowanie/forgot"
                      className="text-[12px] text-fg/70 underline decoration-white/25 underline-offset-4 transition hover:text-fg/85"
                      style={{ textTransform: 'none' }}
                    >
                      zapomniałem hasła
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className={cx(
                      'mt-2 w-full rounded-2xl bg-brand px-4 py-4 text-[14px] font-semibold text-ink transition hover:bg-brand-strong',
                      busy && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    {busy ? '...' : mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
                  </button>
                </form>

                <div className="mt-6 text-center text-[12px] text-fg/64">
                  {mode === 'login' ? (
                    <span>
                      Nie masz konta?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('register');
                          setError('');
                        }}
                        className="underline decoration-white/25 underline-offset-4 transition hover:text-fg/70"
                        style={{ color: GREEN }}
                      >
                        Zarejestruj się
                      </button>
                    </span>
                  ) : (
                    <span>
                      Masz konto?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError('');
                        }}
                        className="underline decoration-white/25 underline-offset-4 transition hover:text-fg/70"
                        style={{ color: GREEN }}
                      >
                        Zaloguj się
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={cx(
              'relative w-full overflow-hidden',
              'border-t border-fg/10 lg:border-l lg:border-t-0',
              'min-h-[480px]',
              'lg:min-h-0 lg:h-screen'
            )}
          >
            {/* tło marki: zielony wash + zielone poświaty + rozmyta plama */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(160deg, rgba(122,163,51,0.13), rgba(122,163,51,0.03) 52%, rgba(122,163,51,0.00) 100%)',
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(122,163,51,0.22),transparent_40%),radial-gradient(circle_at_88%_86%,rgba(122,163,51,0.10),transparent_36%)]" />
            <div className="pointer-events-none absolute right-[-130px] top-20 h-[440px] w-[440px] rounded-full bg-brand/15 blur-[120px]" />

            {/* zielony wjeżdża przy scrollu (telefon) */}
            <ScrollFill className="lg:hidden" />

            <div className="relative z-10 flex h-full w-full items-center px-8 py-14 lg:px-14 lg:py-0">
              <div className="w-full max-w-md">
                <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
                  Twoje konto
                </div>

                <p className="mt-4 text-[15px] leading-7 text-fg/68 md:text-base">
                  Załóż darmowe konto i korzystaj z portalu wyłącznie o działkach.
                </p>

                <ul className="mt-8">
                  {BENEFITS.map((b, i) => (
                    <li
                      key={b.title}
                      className={cx(
                        'flex items-start gap-4 py-4',
                        i > 0 && 'border-t border-fg/10'
                      )}
                    >
                      <span className="mt-0.5 shrink-0 text-brand-bright">
                        <CheckIcon />
                      </span>
                      <div>
                        <div className="text-[15px] font-semibold text-fg">
                          {b.title}
                        </div>
                        <div className="mt-1 text-[13.5px] leading-6 text-fg/64">
                          {b.body}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 h-px w-full bg-fg/10" />

                <p className="mt-5 text-[13px] leading-6 text-fg/60">
                  Jesteś biurem nieruchomości?{' '}
                  <a
                    href="/dla-biur"
                    className="font-medium text-brand-text underline decoration-brand/30 underline-offset-4 transition hover:opacity-80"
                  >
                    Zobacz integrację z CRM
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function AuthPageFallback() {
  return (
    <main className="min-h-screen" style={{ background: BG, color: FG }}>
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-fg/72">Ładowanie…</div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}