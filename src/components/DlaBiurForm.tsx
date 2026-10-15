'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Status = 'idle' | 'sending' | 'ok' | 'error';

// Systemy, z których biura eksportują do nas oferty. Pytamy o to od razu w formularzu,
// bo konto FTP zakładamy ręcznie — znając system, odsyłamy dane bez rundy dopytywania.
const CRMS = [
  { value: 'galactica', label: 'Galactica Virgo' },
  { value: 'imo', label: 'IMO' },
  { value: 'asari', label: 'ASARI CRM' },
  { value: 'esti', label: 'EstiCRM' },
  { value: 'mediarent', label: 'mediaRent' },
  { value: 'domypl', label: 'DOMY.PL' },
  { value: 'ofertynet', label: 'oferty.net' },
  { value: 'propertly', label: 'Propertly' },
  { value: 'locumnet', label: 'Locumnet' },
  { value: 'inny', label: 'Inny / nie wiem' },
];

// Luksusowa „linia": pole bez ramki, samo podkreślenie, które na fokusie zielenieje.
// Jawna właściwość border-bottom — globalny reset `input{border:none}` w globals.css
// kasuje styl ramki, więc samo `border-b` Tailwinda renderowałoby się jako 0px.
const inputClass =
  'field-line w-full bg-transparent px-0 pb-2.5 text-[15px] text-fg outline-none placeholder:text-fg/25';

const labelClass =
  'mb-2 block text-[12px] uppercase tracking-[0.16em] text-fg/68';

const EMPTY = {
  agency: '',
  name: '',
  email: '',
  phone: '',
  goal: 'crm',
  crm: '',
  message: '',
  website: '', // honeypot
};

type DlaBiurFormProps = {
  // wstępne wypełnienie pól (np. e-mail zalogowanego biura w panelu)
  initialValues?: Partial<typeof EMPTY>;
  // wywoływane po udanym wysłaniu (panel używa tego, by przełączyć na ekran statusu)
  onSuccess?: () => void;
};

export default function DlaBiurForm({ initialValues, onSuccess }: DlaBiurFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({ ...EMPTY, ...initialValues });
  const { status: sesja } = useSession();

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
        // E-mail z formularza czeka na rejestrację w sessionStorage, nie w adresie strony
        // (adres trafia do historii, logów i statystyk).
        try {
          if (form.email) sessionStorage.setItem('td-rejestracja-email', form.email.trim());
        } catch {}
        setStatus('ok');
        setForm({ ...EMPTY, ...initialValues }); // czysty pod kolejne zapytanie (zachowuje wartości startowe)
        onSuccess?.();
      } else {
        setStatus('error');
        setErrorMsg(data?.message || 'Nie udało się wysłać. Spróbuj ponownie.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Brak połączenia. Spróbuj ponownie.');
    }
  }

  // Po wysłaniu, gdy biuro nie ma jeszcze konta: podziękowanie i zachęta do założenia konta.
  // Konto i tak jest potrzebne do danych eksportu (FTP), więc odpada jedna wymiana maili.
  // Lead jest już wysłany, kto nie kliknie, nic nie traci (15.10).
  if (status === 'ok' && sesja === 'unauthenticated') {
    return (
      <div className="py-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-brand-text">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10.5 8 14.5 16 6" />
          </svg>
        </div>
        <h3 className="mt-5 text-[22px] font-semibold tracking-tight text-fg">Dziękujemy, odezwiemy się tego samego dnia roboczego.</h3>
        <p className="mt-3 max-w-md text-[15px] leading-7 text-fg/72">
          Chcesz szybciej? Załóż konto biura. To minuta, a dane do eksportu z CRM wyślemy od razu
          po rozmowie, bez dodatkowych maili.
        </p>
        <Link
          href="/logowanie?tryb=rejestracja&callbackUrl=%2Fpanel%3Ftab%3Dcrm"
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-8 text-[15px] font-semibold text-ink transition hover:bg-brand-bright sm:w-auto"
        >
          Załóż konto biura
        </Link>
        <p className="mt-3 text-[13px] text-fg/62">Możesz też poczekać na naszą wiadomość.</p>
      </div>
    );
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

      {/* Cztery pola i wiadomość. Imię i „czego potrzebujesz" wypadły: agent i tak pisze
          w sprawie integracji (współpraca reklamowa ma osobny formularz na /partnerstwo),
          a każde dodatkowe pole przed „Wyślij" obniża liczbę zgłoszeń. */}
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
          <label className={labelClass} htmlFor="crm">
            System CRM
          </label>
          <div className="relative">
            <select
              id="crm"
              className={`${inputClass} appearance-none pr-7`}
              value={form.crm}
              onChange={set('crm')}
            >
              <option value="" className="bg-bg">
                Wybierz system
              </option>
              {CRMS.map((c) => (
                <option key={c.value} value={c.value} className="bg-bg">
                  {c.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-fg/64">
              ▾
            </span>
          </div>
        </div>
      </div>

      {form.crm === 'inny' ? (
        <p className="-mt-3 text-[12px] leading-relaxed text-fg/64">
          Napisz w wiadomości, jak nazywa się Wasz system. Dostosujemy się do formatu, w jakim
          generuje pliki.
        </p>
      ) : null}

      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="email">
            E-mail <span className="text-brand-text">*</span>
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
        <label className={labelClass} htmlFor="message">
          Wiadomość
        </label>
        <textarea
          id="message"
          rows={3}
          className={`${inputClass} resize-y leading-relaxed`}
          value={form.message}
          onChange={set('message')}
        />
      </div>

      {status === 'ok' ? (
        <p className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand-text">
          Wiadomość wysłana. Odezwiemy się na podany adres e-mail.
        </p>
      ) : null}

      {status === 'error' ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex h-13 items-center justify-center rounded-2xl bg-brand px-8 py-4 text-[15px] font-semibold text-ink transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? 'Wysyłanie…' : 'Wyślij zapytanie'}
        </button>

        <p className="text-[12px] leading-relaxed text-fg/64 sm:max-w-xs">
          Wysyłając formularz, zgadzasz się na kontakt w sprawie współpracy.
        </p>
      </div>
    </form>
  );
}
