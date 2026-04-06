'use client';

import { Suspense, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const BG = '#131313';
const FG = '#F3EFF5';
const GREEN = '#7aa333';

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

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path
        fill="currentColor"
        d="M9 4.5 7.8 6H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-1.8L15 4.5H9zm3 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path fill="currentColor" d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm0 18.3C8.7 19 6 15.5 6 11.4V6.4l6-2.2 6 2.2v5c0 4.1-2.7 7.6-6 8.9z"
      />
    </svg>
  );
}

function AuthPageContent() {
  const sp = useSearchParams();
  const callbackUrl = useMemo(() => {
    const url = sp.get('callbackUrl');
    return url && url.trim() ? url : '/panel';
  }, [sp]);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const tabBtn = (active: boolean) =>
    cx(
      'px-4 py-2 rounded-full text-[13px] md:text-[14px] font-semibold tracking-tight transition',
      active ? 'text-white' : 'text-white/70 hover:text-white'
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

    if (mode === 'register' && pass.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass }),
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

      window.location.href = result.url || callbackUrl;
    } catch (err) {
      console.error(err);
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: BG, color: FG }}>
      <div className="min-h-screen w-full">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <div className="flex items-center justify-center px-6 py-10 lg:py-0">
            <div className="w-full max-w-md">
              <div className="rounded-3xl border border-white/10 p-6 md:p-7">
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
                          ? '1px solid rgba(255,255,255,0.55)'
                          : '1px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    Zaloguj się
                  </button>

                  <div className="text-white/35">/</div>

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
                          ? '1px solid rgba(255,255,255,0.55)'
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
                    onClick={() => signIn('google', { callbackUrl })}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-4 font-semibold transition hover:bg-white/[0.06]"
                  >
                    <GoogleIcon />
                    Kontynuuj z Google
                  </button>
                </div>

                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">
                    albo
                  </div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <label className="block">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                      Email
                    </div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="np. adres@email.pl"
                      className={cx(
                        'mt-2 w-full bg-transparent text-[18px] text-white/90',
                        'border-0 border-b border-white/25 pb-2',
                        'placeholder:text-white/35 outline-none',
                        'focus:border-white/70',
                        'selection:bg-white/20 selection:text-white'
                      )}
                    />
                  </label>

                  <label className="block">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                      Hasło
                    </div>
                    <input
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      type="password"
                      placeholder="••••••••"
                      className={cx(
                        'mt-2 w-full bg-transparent text-[18px] text-white/90',
                        'border-0 border-b border-white/25 pb-2',
                        'placeholder:text-white/35 outline-none',
                        'focus:border-white/70',
                        'selection:bg-white/20 selection:text-white'
                      )}
                    />
                  </label>

                  {error && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                      {error}
                    </div>
                  )}

                  <div className="pt-1">
                    <a
                      href="/auth/forgot"
                      className="text-[12px] text-white/55 underline decoration-white/25 underline-offset-4 transition hover:text-white/85"
                      style={{ textTransform: 'none' }}
                    >
                      zapomniałem hasła
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className={cx(
                      'mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-4 text-[14px] font-semibold transition hover:bg-white/[0.08]',
                      busy && 'cursor-not-allowed opacity-60'
                    )}
                    style={{ color: GREEN }}
                  >
                    {busy ? '...' : mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
                  </button>
                </form>

                <div className="mt-6 text-center text-[12px] text-white/40">
                  {mode === 'login' ? (
                    <span>
                      Nie masz konta?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('register');
                          setError('');
                        }}
                        className="underline decoration-white/25 underline-offset-4 transition hover:text-white/70"
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
                        className="underline decoration-white/25 underline-offset-4 transition hover:text-white/70"
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
              'min-h-[520px] py-10',
              'lg:min-h-0 lg:h-screen lg:py-0'
            )}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(/logowanie.webp)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="absolute inset-0 bg-black/75" />

            <div className="relative flex h-full w-full items-start px-8 lg:items-center lg:px-12">
              <div className="w-full max-w-xl">
                <div className="text-[40px] font-semibold leading-[1.05] tracking-tight text-white md:text-[52px]">
                  Zaufaj Nam
                </div>

                <div className="mt-5 text-[16px] leading-relaxed text-white/90 md:text-[18px]">
                  Zaloguj się lub zarejestruj i wystaw swoją działkę w 3 minuty.
                  <span className="text-white/85"> Premium prezentacja.</span>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-[#7aa333]/20 bg-black/25 p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-white/90">
                        <BoltIcon />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Błyskawiczne dodanie oferty
                        </div>
                        <div className="mt-1 text-[13px] text-white/85">
                          Dodasz ofertę w kilka minut, bez zbędnych formularzy,
                          tylko to, co naprawdę ważne dla działki.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#7aa333]/20 bg-black/25 p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-white/90">
                        <ShieldIcon />
                      </div>
                      <div>
                        <div className="font-semibold text-white">Kontakt</div>
                        <div className="mt-1 text-[13px] text-white/85">
                          Twój numer telefonu widoczny na górze ogłoszenia,
                          kupujący kontaktują się od razu z Tobą.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#7aa333]/20 bg-black/25 p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-white/90">
                        <CameraIcon />
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          Profesjonalna prezentacja działki
                        </div>
                        <div className="mt-1 text-[13px] text-white/85">
                          Estetyczna, przejrzysta karta działki, Twoja oferta
                          wygląda profesjonalnie i sprzedaje szybciej.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-6 lg:hidden" />
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
        <div className="text-white/60">Ładowanie…</div>
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