'use client';

import { useState } from 'react';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const GOALS = [
  { value: 'crm', label: 'Integracja z CRM' },
  { value: 'import', label: 'Masowy import ofert' },
  { value: 'wspolpraca', label: 'Współpraca / partnerstwo' },
  { value: 'inne', label: 'Pytanie ogólne' },
];

// Luksusowa „linia": pole bez ramki, samo podkreślenie, które na fokusie zielenieje.
// Jawna właściwość border-bottom — globalny reset `input{border:none}` w globals.css
// kasuje styl ramki, więc samo `border-b` Tailwinda renderowałoby się jako 0px.
const inputClass =
  'field-line w-full bg-transparent px-0 pb-2.5 text-[15px] text-white outline-none placeholder:text-white/25';

const labelClass =
  'mb-2 block text-[12px] uppercase tracking-[0.16em] text-white/45';

const EMPTY = {
  agency: '',
  name: '',
  email: '',
  phone: '',
  goal: 'crm',
  message: '',
  website: '', // honeypot
};

export default function DlaBiurForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({ ...EMPTY });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    // edycja po wysłaniu/błędzie chowa baner
    setStatus((s) => (s === 'ok' || s === 'error' ? 'idle' : s));
  };

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
        setForm({ ...EMPTY }); // formularz zostaje, ale czysty pod kolejne zapytanie
      } else {
        setStatus('error');
        setErrorMsg(data?.message || 'Nie udało się wysłać. Spróbuj ponownie.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Brak połączenia. Spróbuj ponownie.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-7">
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

      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="agency">
            Nazwa biura
          </label>
          <input
            id="agency"
            type="text"
            className={inputClass}
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
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
          />
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="email">
            E-mail <span className="text-[#9fd14b]">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            className={inputClass}
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
        <div className="relative">
          <select
            id="goal"
            className={`${inputClass} appearance-none pr-7`}
            value={form.goal}
            onChange={set('goal')}
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value} className="bg-[#131313]">
                {g.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/40">
            ▾
          </span>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="message">
          Wiadomość
        </label>
        <textarea
          id="message"
          rows={4}
          className={`${inputClass} resize-y leading-relaxed`}
          value={form.message}
          onChange={set('message')}
        />
      </div>

      {status === 'ok' ? (
        <p className="rounded-2xl border border-[#7aa333]/30 bg-[#7aa333]/10 px-4 py-3 text-sm text-[#9fd14b]">
          Wiadomość wysłana. Odezwiemy się na podany adres e-mail.
        </p>
      ) : null}

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
