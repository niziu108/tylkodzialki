import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import PartnerForm from '@/components/PartnerForm';
import OffersCounter from '@/components/OffersCounter';
import DecisionChain from '@/components/DecisionChain';
import ScrollFill from '@/components/ScrollFill';

// Liczba ofert ma być zawsze aktualna (nie odświeżana co kilka minut).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Partnerstwo dla firm: docieraj do osób kupujących działki',
  description:
    'Współpraca partnerska na portalu wyłącznie o działkach. Docieraj do osób, które kupują ziemię: geodeci, domy modułowe, kredyty, fotowoltaika, ogrodzenia, przyłącza. Wycena indywidualna.',
  alternates: { canonical: '/partnerstwo' },
  openGraph: {
    title: 'Partnerstwo | tylkodzialki.pl',
    description:
      'Docieraj do ludzi w momencie, gdy kupują działkę. Reklama natywna i współpraca partnerska na portalu wyłącznie o działkach.',
    url: '/partnerstwo',
    type: 'website',
  },
};

const PAGE_BG = 'var(--bg)';

const AUDIENCE = [
  { name: 'Deweloperzy', why: 'Odbiorca gotowy na kolejny etap inwestycji.' },
  { name: 'Domy modułowe i prefabrykowane', why: 'Dopasowanie domu do metrażu konkretnej działki.' },
  { name: 'Geodeci', why: 'Wyłączność na region i precyzja lokalizacji.' },
  { name: 'Architekci', why: 'Projekt domu pod konkretną działkę.' },
  { name: 'Fotowoltaika', why: 'Dobór instalacji do powierzchni i orientacji gruntu.' },
  { name: 'Firmy budowlane', why: 'Lokalne zaufanie i treści eksperckie.' },
  { name: 'Brokerzy kredytowi', why: 'Obecność dokładnie przy decyzji o finansowaniu.' },
  { name: 'Producenci ogrodzeń', why: 'Klient, który właśnie kupił grunt do ogrodzenia.' },
  { name: 'Firmy od przyłączy', why: 'Kontekst mediów konkretnej działki.' },
];

const FORMATY = [
  {
    title: 'Partner kategorii',
    body: 'Tylko jedna firma w swojej branży. Główny partner kategorii, bez konkurencji obok.',
    featured: true,
  },
  {
    title: 'Partner regionu',
    body: 'Wyłączność na województwo lub powiat. Widoczność dokładnie tam, gdzie działasz.',
    featured: false,
  },
  {
    title: 'Sponsor wyszukiwarki',
    body: 'Twoja marka przy wyszukiwarce działek, w miejscu, którego używa każdy odwiedzający.',
    featured: false,
  },
  {
    title: 'Partner miesiąca',
    body: 'Wyróżniona obecność na stronie głównej przez cały miesiąc. Czysta budowa marki.',
    featured: false,
  },
  {
    title: 'Sponsor rejestracji',
    body: 'Twoja marka w momencie zakładania konta, gdy uwaga użytkownika jest największa.',
    featured: false,
  },
  {
    title: 'Reklama natywna przy ofertach',
    body: 'Twoja usługa polecana przy konkretnej działce, na przykład geodeta albo przyłącza. Dopasowana, nie nachalna.',
    featured: false,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Zgłoszenie',
    body: 'Wypełniasz formularz, podajesz branżę i zasięg, w jakim chcesz działać.',
  },
  {
    n: '02',
    title: 'Indywidualne dopasowanie',
    body: 'Projektujemy współpracę pod Twój cel i wyceniamy ją indywidualnie. Bez gotowych cenników.',
  },
  {
    n: '03',
    title: 'Start współpracy',
    body: 'Uruchamiamy obecność i raportujemy wyniki, żebyś widział realny efekt.',
  },
];

export default async function PartnerstwoPage() {
  const now = new Date();

  const listingCount = await prisma.dzialka.count({
    where: {
      status: 'AKTYWNE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  const hasCount = listingCount > 0;

  return (
    <main className="relative w-full overflow-hidden" style={{ background: PAGE_BG }}>
      {/* HERO */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden border-b border-fg/10">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_15%,rgba(122,163,51,0.18),transparent_36%),radial-gradient(circle_at_82%_78%,rgba(47,94,70,0.05),transparent_34%)]" />
        <div className="pointer-events-none absolute left-[-140px] top-24 z-0 h-[420px] w-[420px] rounded-full bg-brand/10 blur-[120px]" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 text-left md:px-10 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {hasCount ? (
            <div className="flex justify-start">
              <OffersCounter target={listingCount} />
            </div>
          ) : null}

          <div className={hasCount ? '' : 'lg:col-span-2'}>
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
              Partnerstwo
            </div>

            <h1 className="mt-4 text-balance text-[26px] font-semibold leading-[1.15] tracking-tight text-fg md:text-[34px] lg:text-[34px]">
              Docieraj do klientów w momencie, gdy kupują działkę.
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-7 text-fg/68 md:text-base">
              Każdy klient tylkodzialki.pl szuka działki. To jeden z najwyższych
              poziomów intencji zakupowej w całej branży nieruchomości. Twoja firma
              może być przy nim wcześniej niż konkurencja.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row">
              <Link
                href="#kontakt"
                className="inline-flex h-13 items-center justify-center rounded-2xl bg-brand px-8 py-4 text-[15px] font-semibold text-ink transition hover:bg-brand-bright"
              >
                Zostań partnerem
              </Link>

              <Link
                href="#formaty"
                className="inline-flex h-13 items-center justify-center rounded-2xl border border-fg/15 px-8 py-4 text-[15px] font-medium text-fg/85 transition hover:border-fg/30 hover:text-fg"
              >
                Zobacz możliwości
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ŁAŃCUCH DECYZJI */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-3xl">
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
              Łańcuch decyzji
            </div>

            <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
              Zakup działki to nie koniec, to początek.
            </h2>

            <p className="mt-6 text-base leading-8 text-fg/70 md:text-lg">
              Po działce przychodzi projekt, kredyt, przyłącza, dom, ogrodzenie i
              fotowoltaika. Jeden zakup uruchamia kilkanaście kolejnych decyzji.
              Jesteśmy przy pierwszej z nich, więc możesz być pierwszy w kolejce.
            </p>
          </div>

          <div className="mt-16">
            <DecisionChain />
          </div>
        </div>
      </section>

      {/* DLA KOGO */}
      <section className="relative overflow-hidden border-y border-fg/10 bg-surface-2">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.12),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.05),transparent_32%)]" />
        <ScrollFill />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
            Dla kogo
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Branże, które docierają tu do właściwych ludzi.
          </h2>

          <div className="mt-10">
            {AUDIENCE.map((a, i) => (
              <div
                key={a.name}
                className={`grid grid-cols-[2rem_1fr] items-baseline gap-x-4 gap-y-1 py-5 md:grid-cols-[3rem_18rem_1fr] md:gap-x-8 ${
                  i < AUDIENCE.length - 1 ? 'border-b border-fg/10' : ''
                }`}
              >
                <span className="tabular-nums text-[15px] font-semibold text-brand-text">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[16px] font-medium text-fg md:text-lg">
                  {a.name}
                </span>
                <span className="col-start-2 text-sm text-fg/68 md:col-start-3 md:text-[15px]">
                  {a.why}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMATY WSPÓŁPRACY */}
      <section
        id="formaty"
        className="relative scroll-mt-24 overflow-hidden border-y border-fg/10 bg-surface-2"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(122,163,51,0.14),transparent_34%)]" />
        <ScrollFill />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
            Formaty współpracy
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Reklama natywna, nie banery.
          </h2>

          {/* PODGLĄD: reklamodawca kupuje miejsce, które widzi. Zamiast opisu formatu pokazujemy,
              jak polecenie partnera stoi pod ofertą działki. Firma jest celowo „Twoja firma",
              żeby podgląd nie udawał prawdziwego klienta. */}
          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <h3 className="text-[20px] font-semibold tracking-tight text-fg md:text-[24px]">
                Tak wygląda polecenie przy ofercie.
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-7 text-fg/72">
                Kupujący ogląda konkretną działkę, z konkretną gminą i metrażem. Pod nią widzi jedną
                firmę, która pomoże mu w następnym kroku. Bez migających banerów i bez kilku
                konkurentów obok.
              </p>
              <ul className="mt-6 space-y-2.5 text-[14px] text-fg/80">
                {[
                  'Dopasowane do gminy albo powiatu oferty',
                  'Telefon prosto do Twojej firmy',
                  'Jedna firma z branży na raz',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 10.5 8 14.5 16 6" />
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div aria-label="Przykład polecenia partnera pod ofertą działki" className="relative">
              <div className="absolute -top-3 left-5 z-10 rounded-full bg-fg px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-bg">
                Przykład
              </div>
              <div className="rounded-[28px] border border-fg/12 bg-surface p-5 shadow-[0_30px_80px_-40px_rgba(35,58,14,0.45)] md:p-6">
                {/* Skrót oferty działki */}
                <div className="flex gap-4">
                  <div className="h-20 w-28 shrink-0 rounded-xl bg-[linear-gradient(135deg,#9fbf6a,#5f7d2a)] opacity-80" />
                  <div className="min-w-0">
                    <div className="text-[20px] font-semibold leading-none text-fg">189 000 zł</div>
                    <div className="mt-2 text-[14px] font-medium text-fg/85">Działka budowlana 1 200 m²</div>
                    <div className="mt-1 text-[13px] text-fg/62">Nowa Wieś, gm. Pasłęk</div>
                  </div>
                </div>

                {/* Polecenie partnera */}
                <div className="mt-5 rounded-2xl border border-brand/30 bg-brand/[0.07] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-text">
                    Polecane w gminie Pasłęk
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-fg/12 bg-surface text-[13px] font-bold text-fg/75">
                      TF
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-fg">Twoja firma</div>
                      <div className="text-[13px] text-fg/65">Geodeta: wytyczenie granic i podział działki</div>
                    </div>
                    <span className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-ink">
                      Zadzwoń
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 text-right text-[11px] text-fg/55">Partner tylkodzialki.pl</div>
              </div>
            </div>
          </div>

          <div className="mt-20 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {FORMATY.map((f) => (
              <div key={f.title} className="group border-t border-fg/15 pt-6">
                {f.featured ? (
                  <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-text">
                    Wyłączność
                  </div>
                ) : null}

                <h3 className="relative inline-block text-lg font-semibold text-fg transition-colors duration-200">
                  {f.title}
                  <span
                    className="absolute -bottom-1 left-0 h-px w-0 bg-brand transition-all duration-300 group-hover:w-full"
                    aria-hidden="true"
                  />
                </h3>

                <p className="mt-3 max-w-md text-sm leading-7 text-fg/72">{f.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-fg/64">
            Wycena indywidualna. Bez gotowych cenników i bez sieci reklamowych.
          </p>
        </div>
      </section>

      {/* MANIFEST JAKOŚCI */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
            Nasza zasada
          </div>

          <h2 className="mt-5 max-w-3xl text-[24px] font-semibold leading-[1.2] tracking-tight text-fg md:text-[34px]">
            Mniej partnerów, większy efekt.
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-8 text-fg/70 md:text-lg">
            Nie sprzedajemy powierzchni każdemu, kto zapłaci. Dobieramy firmy, które
            realnie pomagają osobom budującym dom. Bez wyskakujących reklam, bez
            migających banerów, bez sieci reklamowych. Dzięki temu obecność tutaj coś
            znaczy, a Twoja marka jest w dobrym towarzystwie.
          </p>
        </div>
      </section>

      {/* JAK ZACZĄĆ */}
      <section className="relative overflow-hidden border-y border-fg/10 bg-surface-2">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.12),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.05),transparent_32%)]" />
        <ScrollFill />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
            Jak zacząć
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Trzy kroki do współpracy.
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="group rounded-[28px] border border-fg/12 bg-surface-2/60 p-8 backdrop-blur"
              >
                <div className="text-[40px] font-bold leading-none text-brand-strong transition-colors duration-200 group-hover:text-brand-text">
                  {s.n}
                </div>

                <h3 className="mt-5 text-xl font-semibold text-fg">{s.title}</h3>
                <p className="mt-3 text-sm leading-7 text-fg/72">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" className="relative scroll-mt-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(122,163,51,0.14),transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
            <div>
              <div className="text-[12px] uppercase tracking-[0.22em] text-brand-text">
                Kontakt
              </div>

              <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-fg md:text-[30px] md:leading-[1.08]">
                Porozmawiajmy o współpracy.
              </h2>

              <p className="mt-5 max-w-md text-base leading-8 text-fg/70">
                Napisz, jaką firmę reprezentujesz i do kogo chcesz dotrzeć.
                Przygotujemy indywidualną propozycję dopasowaną do Twojego celu i
                budżetu. Bez zobowiązań.
              </p>

              <p className="mt-6 text-sm text-fg/68">
                Wolisz e-mail? Napisz na{' '}
                <a
                  href="mailto:biuro@tylkodzialki.pl"
                  className="text-brand-text transition hover:opacity-80"
                >
                  biuro@tylkodzialki.pl
                </a>
              </p>
            </div>

            <div className="rounded-[32px] border border-fg/12 bg-surface-2/60 p-6 backdrop-blur md:p-8">
              <PartnerForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
