'use client';

import { useMemo, useState } from 'react';
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

function FacebookIconBlue() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path
        fill="#1877F2"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89H7.898V12h2.54V9.797c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.99 22 12c0-5.523-4.477-10-10-10z"
      />
      <path
        fill="#FFFFFF"
        d="M13.673 21.878V14.89h2.33l.443-2.89h-2.773v-1.676c0-.791.388-1.562 1.63-1.562h1.26v-2.46s-1.144-.195-2.238-.195c-2.285 0-3.777 1.383-3.777 3.89V12h-2.54v2.89h2.54v6.988c.508.08 1.03.122 1.562.122.532 0 1.054-.042 1.563-.122z"
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

export default function AuthPage() {
  const sp = useSearchParams();
  const callbackUrl = useMemo(() => sp.get('callbackUrl') || '/', [sp]);

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
          if (res.status === 409) setMode('login'); // konto istnieje -> przełącz na login
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
        setError(mode === 'login' ? 'Nieprawidłowy email lub hasło.' : 'Nie udało się zalogować po rejestracji.');
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
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
          {/* LEWA (50%) */}
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
                      border: mode === 'login' ? '1px solid rgba(255,255,255,0.55)' : '1px solid transparent',
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
                      border: mode === 'register' ? '1px solid rgba(255,255,255,0.55)' : '1px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    Rejestracja
                  </button>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={() => signIn('google', { callbackUrl })}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition px-4 py-4 flex items-center justify-center gap-3 font-semibold"
                  >
                    <GoogleIcon />
                    Kontynuuj z Google
                  </button>

                  <button
                    type="button"
                    onClick={() => signIn('facebook', { callbackUrl })}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition px-4 py-4 flex items-center justify-center gap-3 font-semibold"
                  >
                    <FacebookIconBlue />
                    Kontynuuj z Facebook
                  </button>
                </div>

                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <div className="text-[12px] text-white/45 tracking-[0.14em] uppercase">albo</div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* FORM */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <label className="block">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Email</div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="np. daniel@..."
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
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Hasło</div>
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

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-[12px] text-white/55 hover:text-white/85 transition underline underline-offset-4 decoration-white/25"
                      style={{ textTransform: 'none' }}
                      onClick={() => alert('Reset hasła zrobimy w kolejnym kroku.')}
                    >
                      zapomniałem hasła
                    </button>

                    <button
                      type="submit"
                      disabled={busy}
                      className={cx('text-[12px] font-semibold tracking-tight', busy && 'opacity-60 cursor-not-allowed')}
                      style={{ color: GREEN }}
                    >
                      {busy ? '...' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
                    </button>
                  </div>
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
                        className="underline underline-offset-4 decoration-white/25 hover:text-white/70 transition"
                        style={{ color: GREEN }}
                      >
                        Rejestracja
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
                        className="underline underline-offset-4 decoration-white/25 hover:text-white/70 transition"
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

          {/* PRAWA (50%) */}
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

            <div className="relative h-full w-full px-8 lg:px-12 flex items-start lg:items-center">
              <div className="w-full max-w-xl">
                <div className="text-white text-[40px] md:text-[52px] font-semibold tracking-tight leading-[1.05]">
                  Zaufaj Nam
                </div>

                <div className="mt-5 text-white/90 text-[16px] md:text-[18px] leading-relaxed">
                  Zaloguj się lub zarejestruj i wystaw swoją działkę w 3 minuty.
                  <span className="text-white/85"> Premium prezentacja.</span>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-[#7aa333]/20 bg-black/25 backdrop-blur-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-white/90 mt-0.5">
                        <BoltIcon />
                      </div>
                      <div>
                        <div className="text-white font-semibold">Błyskawiczne dodanie oferty</div>
                        <div className="text-white/85 text-[13px] mt-1">
                          Dodasz ofertę w kilka minut, bez zbędnych formularzy, tylko to, co naprawdę ważne dla działki.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#7aa333]/20 bg-black/25 backdrop-blur-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-white/90 mt-0.5">
                        <ShieldIcon />
                      </div>
                      <div>
                        <div className="text-white font-semibold">Kontakt</div>
                        <div className="text-white/85 text-[13px] mt-1">
                          Twój numer telefonu widoczny na górze ogłoszenia, kupujący kontaktują się od razu z Tobą.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#7aa333]/20 bg-black/25 backdrop-blur-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-white/90 mt-0.5">
                        <CameraIcon />
                      </div>
                      <div>
                        <div className="text-white font-semibold">Profesjonalna prezentacja działki</div>
                        <div className="text-white/85 text-[13px] mt-1">
                          Estetyczna, przejrzysta karta działki, Twoja oferta wygląda profesjonalnie i sprzedaje szybciej.
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