'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const BG = 'var(--bg)';
const FG = 'var(--fg)';
const GREEN = 'var(--brand)';

function ResetPageContent() {
  const sp = useSearchParams();
  const token = useMemo(() => sp.get('token') || '', [sp]);
  // Zaproszenie biura założonego przez admina (src/lib/biuroZaproszenie.ts): ta sama ścieżka
  // co reset, tylko pierwsze hasło zamiast „nowego".
  const powitanie = sp.get('powitanie') === '1';

  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError('');
    if (!token) {
      setError('Brak tokenu.');
      return;
    }
    if (pass.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pass }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = data?.code;
        if (code === 'EXPIRED_TOKEN')
          setError('Link wygasł. Na stronie logowania kliknij „Nie pamiętasz hasła?", wyślemy nowy.');
        else setError('Nieprawidłowy link resetu.');
        return;
      }

      setDone(true);
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: BG, color: FG }}
    >
      <div className="w-full max-w-md rounded-3xl border border-fg/10 p-7">
        <h1 className="text-fg text-[26px] font-semibold">
          {powitanie ? 'Ustaw hasło do konta' : 'Ustaw nowe hasło'}
        </h1>
        {powitanie && !done ? (
          <p className="mt-2 text-[14px] text-fg/70">
            Twoje działki są już na portalu. Ustaw hasło, żeby wejść do panelu biura.
          </p>
        ) : null}

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-[13px] text-fg">
              {powitanie ? 'Hasło ustawione. Zaloguj się, żeby wejść do panelu.' : 'Hasło zostało zmienione. Możesz się zalogować.'}
            </div>
            <a
              href="/logowanie"
              className="block w-full text-center rounded-2xl px-4 py-4 font-semibold border border-fg/15 bg-fg/[0.03] hover:bg-fg/[0.06] transition"
              style={{ color: GREEN }}
            >
              Przejdź do logowania
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <label className="block">
              <div className="text-[11px] uppercase tracking-[0.18em] text-fg/70">
                {powitanie ? 'Hasło' : 'Nowe hasło'}
              </div>
              <input
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="mt-2 w-full bg-transparent text-[18px] text-fg/90 field-line pb-2 placeholder:text-fg/62 outline-none"
              />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl px-4 py-4 font-semibold border border-fg/15 bg-fg/[0.03] hover:bg-fg/[0.06] transition"
              style={{ color: GREEN }}
            >
              {busy ? '...' : powitanie ? 'Ustaw hasło' : 'Zapisz nowe hasło'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function ResetPageFallback() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: BG, color: FG }}
    >
      <div className="text-fg/72">Ładowanie…</div>
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<ResetPageFallback />}>
      <ResetPageContent />
    </Suspense>
  );
}