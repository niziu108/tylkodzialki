'use client';

import { useState } from 'react';

const BG = '#131313';
const FG = '#F3EFF5';
const GREEN = '#7aa333';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError('');
    const clean = email.toLowerCase().trim();
    if (!clean) {
      setError('Podaj email.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      });

      if (!res.ok) throw new Error('ERR');
      setDone(true);
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: BG, color: FG }}>
      <div className="w-full max-w-md rounded-3xl border border-fg/10 p-7">
        <h1 className="text-fg text-[26px] font-semibold">Reset hasła</h1>

        <p className="text-fg/70 mt-2 text-[14px]">
          Podaj email. Jeśli konto istnieje, wyślemy link do ustawienia nowego hasła.
        </p>

        {done ? (
          <div className="mt-6 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-[13px] text-fg">
            Jeśli konto istnieje, link do resetu został wysłany na podany adres.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <label className="block">
              <div className="text-[11px] uppercase tracking-[0.18em] text-fg/55">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="mt-2 w-full bg-transparent text-[18px] text-fg/90 field-line pb-2 placeholder:text-fg/35 outline-none"
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
              {busy ? '...' : 'Wyślij link resetu'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}