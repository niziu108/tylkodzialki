'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';

const BG = '#131313';
const FG = '#F3EFF5';
const GREEN = '#7aa333';

export default function ResetPage() {
  const sp = useSearchParams();
  const token = useMemo(() => sp.get('token') || '', [sp]);

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
        if (code === 'EXPIRED_TOKEN') setError('Link wygasł. Wygeneruj nowy reset hasła.');
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
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: BG, color: FG }}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 p-7">
        <h1 className="text-white text-[26px] font-semibold">Ustaw nowe hasło</h1>

        {done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-4 py-3 text-[13px] text-white">
              Hasło zostało zmienione. Możesz się zalogować.
            </div>
            <a
              href="/auth"
              className="block w-full text-center rounded-2xl px-4 py-4 font-semibold border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition"
              style={{ color: GREEN }}
            >
              Przejdź do logowania
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <label className="block">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Nowe hasło</div>
              <input
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                type="password"
                placeholder="••••••••"
                className="mt-2 w-full bg-transparent text-[18px] text-white/90 border-0 border-b border-white/25 pb-2 placeholder:text-white/35 outline-none focus:border-white/70"
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
              className="w-full rounded-2xl px-4 py-4 font-semibold border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition"
              style={{ color: GREEN }}
            >
              {busy ? '...' : 'Zapisz nowe hasło'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}