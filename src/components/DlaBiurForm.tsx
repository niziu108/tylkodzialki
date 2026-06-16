'use client';

import { useState } from 'react';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const GOALS = [
  { value: 'crm', label: 'Integracja z CRM' },
  { value: 'import', label: 'Masowy import ofert' },
  { value: 'wspolpraca', label: 'Współpraca / partnerstwo' },
  { value: 'inne', label: 'Pytanie ogólne' },
];

const inputClass =
  'h-12 w-full rounded-2xl border border-white/12 bg-[#0d0d0d]/70 px-4 text-[15px] text-white outline-none transition placeholder:text-white/35 focus:border-[#7aa333]/60 focus:bg-[#0d0d0d]';

const labelClass =
  'mb-2 block text-[12px] uppercase tracking-[0.16em] text-white/45';

export default function DlaBiurForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    agency: '',
    name: '',
    email: '',
    phone: '',
    goal: 'crm',
    message: '',
    website: '', // honeypot
  });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/dla-biur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setStatus('ok');
      } else {
        setStatus('error');
        setErrorMsg(data?.message || 'Nie udało się wysłać. Spróbuj ponownie.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Brak połączenia. Spróbuj ponownie.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="rounded-[28px] border border-[#7aa333]/30 bg-[#7aa333]/10 p-8 text-center md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#7aa333]/40 bg-[#7aa333]/15 text-2xl text-[#9fd14b]">
          ✓
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-white">
          Wiadomość wysłana. Dziękujemy!
        </h3>
        <p className="mt-3 text-white/65">
          Odezwiemy się na podany adres e-mail i ustalimy szczegóły integracji.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {/* honeypot: ukryte przed ludźmi, łapie boty */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <label>
          Nie wypełniaj tego pola
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={set('website')}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="agency">
            Nazwa biura
          </label>
          <input
            id="agency"
            type="text"
            className={inputClass}
            placeholder="np. Biuro Nieruchomości Kowalski"
            value={form.agency}
            onChange={set('agency')}
            autoComplete="organization"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="name">
            Imię i nazwisko
          </label>
          <input
            id="name"
            type="text"
            className={inputClass}
            placeholder="Jan Kowalski"
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="email">
            E-mail <span className="text-[#9fd14b]">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            className={inputClass}
            placeholder="biuro@twojadomena.pl"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="phone">
            Telefon
          </label>
          <input
            id="phone"
            type="tel"
            className={inputClass}
            placeholder="+48 600 000 000"
            value={form.phone}
            onChange={set('phone')}
            autoComplete="tel"
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="goal">
          Czego potrzebujesz?
        </label>
        <select
          id="goal"
          className={`${inputClass} appearance-none`}
          value={form.goal}
          onChange={set('goal')}
        >
          {GOALS.map((g) => (
            <option key={g.value} value={g.value} className="bg-[#131313]">
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="message">
          Wiadomość
        </label>
        <textarea
          id="message"
          rows={4}
          className={`${inputClass} h-auto resize-y py-3 leading-relaxed`}
          placeholder="Napisz w skrócie, w jakim systemie pracujesz i ile masz ofert działek."
          value={form.message}
          onChange={set('message')}
        />
      </div>

      {status === 'error' ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex h-13 items-center justify-center rounded-2xl bg-[#7aa333] px-8 py-4 text-[15px] font-semibold text-[#0d0d0d] transition hover:bg-[#9fd14b] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? 'Wysyłanie…' : 'Wyślij zapytanie'}
        </button>

        <p className="text-[12px] leading-relaxed text-white/40 sm:max-w-xs sm:text-right">
          Wysyłając formularz, zgadzasz się na kontakt w sprawie współpracy.
        </p>
      </div>
    </form>
  );
}
