'use client';

import { useState } from 'react';

type Status = 'idle' | 'sending' | 'ok' | 'error';

// Wartości muszą zgadzać się z BRANZA_LABELS w app/api/partnerstwo/route.ts
const BRANZE = [
  { value: 'deweloper', label: 'Deweloper' },
  { value: 'domy', label: 'Domy modułowe / prefabrykowane' },
  { value: 'geodezja', label: 'Geodezja' },
  { value: 'architektura', label: 'Architektura i projekty' },
  { value: 'fotowoltaika', label: 'Fotowoltaika' },
  { value: 'budowlana', label: 'Firma budowlana' },
  { value: 'finansowanie', label: 'Kredyty i finansowanie' },
  { value: 'ogrodzenia', label: 'Ogrodzenia' },
  { value: 'przylacza', label: 'Przyłącza i media' },
  { value: 'inne', label: 'Inne' },
];

const ZASIEGI = [
  { value: 'polska', label: 'Cała Polska' },
  { value: 'wojewodztwo', label: 'Wybrane województwo' },
  { value: 'powiat', label: 'Powiat / region' },
];

const BUDZETY = [
  { value: 'doustalenia', label: 'Do ustalenia' },
  { value: 's1', label: 'do 3 000 zł miesięcznie' },
  { value: 's2', label: '3 000 do 10 000 zł miesięcznie' },
  { value: 's3', label: 'powyżej 10 000 zł miesięcznie' },
];

// Luksusowa „linia": pole bez ramki, samo podkreślenie, które na fokusie zielenieje.
const inputClass =
  'field-line w-full bg-transparent px-0 pb-2.5 text-[15px] text-fg outline-none placeholder:text-fg/25';

const labelClass =
  'mb-2 block text-[12px] uppercase tracking-[0.16em] text-fg/68';

const EMPTY = {
  company: '',
  name: '',
  email: '',
  phone: '',
  branza: 'deweloper',
  zasieg: 'polska',
  budzet: 'doustalenia',
  message: '',
  website: '', // honeypot
};

export default function PartnerForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({ ...EMPTY });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setStatus((s) => (s === 'ok' || s === 'error' ? 'idle' : s));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/partnerstwo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setStatus('ok');
        setForm({ ...EMPTY });
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
          <label className={labelClass} htmlFor="company">
            Nazwa firmy
          </label>
          <input
            id="company"
            type="text"
            className={inputClass}
            value={form.company}
            onChange={set('company')}
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
            E-mail <span className="text-brand-bright">*</span>
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

      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="branza">
            Branża
          </label>
          <div className="relative">
            <select
              id="branza"
              className={`${inputClass} appearance-none pr-7`}
              value={form.branza}
              onChange={set('branza')}
            >
              {BRANZE.map((b) => (
                <option key={b.value} value={b.value} className="bg-bg">
                  {b.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-fg/64">
              ▾
            </span>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="zasieg">
            Zasięg działania
          </label>
          <div className="relative">
            <select
              id="zasieg"
              className={`${inputClass} appearance-none pr-7`}
              value={form.zasieg}
              onChange={set('zasieg')}
            >
              {ZASIEGI.map((z) => (
                <option key={z.value} value={z.value} className="bg-bg">
                  {z.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-fg/64">
              ▾
            </span>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="budzet">
          Orientacyjny budżet (opcjonalnie)
        </label>
        <div className="relative">
          <select
            id="budzet"
            className={`${inputClass} appearance-none pr-7`}
            value={form.budzet}
            onChange={set('budzet')}
          >
            {BUDZETY.map((b) => (
              <option key={b.value} value={b.value} className="bg-bg">
                {b.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-fg/64">
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
          placeholder="Napisz, co chcesz osiągnąć i do kogo chcesz dotrzeć."
        />
      </div>

      {status === 'ok' ? (
        <p className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand-bright">
          Zgłoszenie wysłane. Odezwiemy się na podany adres e-mail z indywidualną propozycją.
        </p>
      ) : null}

      {status === 'error' ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex h-13 items-center justify-center rounded-2xl bg-brand px-8 py-4 text-[15px] font-semibold text-ink transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>

        <p className="text-[12px] leading-relaxed text-fg/64 sm:max-w-xs">
          Wysyłając formularz, zgadzasz się na kontakt w sprawie współpracy.
        </p>
      </div>
    </form>
  );
}
