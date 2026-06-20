import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import PartnerForm from '@/components/PartnerForm';
import OffersCounter from '@/components/OffersCounter';
import DecisionChain from '@/components/DecisionChain';

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
    tag: 'Wyłączność',
    title: 'Partner kategorii',
    body: 'Tylko jedna firma w swojej branży. Główny partner kategorii, bez konkurencji obok.',
    featured: true,
  },
  {
    tag: '',
    title: 'Partner regionu',
    body: 'Wyłączność na województwo lub powiat. Widoczność dokładnie tam, gdzie działasz.',
    featured: false,
  },
  {
    tag: '',
    title: 'Sponsor wyszukiwarki',
    body: 'Twoja marka przy wyszukiwarce działek, w miejscu, którego używa każdy odwiedzający.',
    featured: false,
  },
  {
    tag: '',
    title: 'Partner miesiąca',
    body: 'Wyróżniona obecność na stronie głównej przez cały miesiąc. Czysta budowa marki.',
    featured: false,
  },
  {
    tag: '',
    title: 'Treści eksperckie',
    body: 'Artykuły współtworzone z naszą redakcją. Budujesz autorytet i jesteś widoczny w Google.',
    featured: false,
  },
  {
    tag: '',
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

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 text-left md:px-10 md:py-20 lg:grid-cols-2 lg:gap-16">
          {hasCount ? (
            <div className="flex justify-start">
              <OffersCounter target={listingCount} />
            </div>
          ) : null}

          <div className={hasCount ? '' : 'lg:col-span-2'}>
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
              Partnerstwo
            </div>

            <h1 className="mt-4 text-[26px] font-semibold leading-[1.12] tracking-tight text-fg md:text-[40px] lg:text-[44px]">
              Docieraj do ludzi w momencie, gdy kupują działkę.
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-7 text-fg/68 md:text-base">
              Każdy odbiorca tylkodzialki.pl szuka działki. To jeden z najwyższych
              poziomów intencji zakupowej w całej branży nieruchomości. Twoja firma
              może być obecna dokładnie tam, zanim trafi tam konkurencja.
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
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
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

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
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
                <span className="tabular-nums text-sm font-medium text-brand-text/50">
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

      {/* PROFIL ODBIORCY */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
            Profil odbiorcy
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Dlaczego ten ruch jest inny.
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-[28px] border border-fg/12 bg-surface-2/60 p-7 backdrop-blur">
              <div className="text-[40px] font-bold leading-none text-brand">
                {hasCount ? listingCount.toLocaleString('pl-PL') : '—'}
              </div>
              <p className="mt-4 text-sm leading-7 text-fg/72">
                Ofert działek w bazie, aktualizowanych na bieżąco.
              </p>
            </div>

            <div className="rounded-[28px] border border-fg/12 bg-surface-2/60 p-7 backdrop-blur">
              <div className="text-[40px] font-bold leading-none text-brand">100%</div>
              <p className="mt-4 text-sm leading-7 text-fg/72">
                Odbiorców planuje zakup ziemi. Zero przypadkowego ruchu.
              </p>
            </div>

            <div className="rounded-[28px] border border-fg/12 bg-surface-2/60 p-7 backdrop-blur">
              <div className="text-[40px] font-bold leading-none text-brand">16</div>
              <p className="mt-4 text-sm leading-7 text-fg/72">
                Województw. Możesz celować w cały kraj albo w jeden region.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FORMATY WSPÓŁPRACY */}
      <section
        id="formaty"
        className="relative scroll-mt-24 overflow-hidden border-y border-fg/10 bg-surface-2"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(122,163,51,0.14),transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
            Formaty współpracy
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Reklama natywna, nie banery.
          </h2>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATY.map((f) => (
              <div
                key={f.title}
                className={`group rounded-[28px] border p-7 backdrop-blur transition ${
                  f.featured
                    ? 'border-brand/45 bg-brand/[0.06]'
                    : 'border-fg/12 bg-surface-2/60 hover:border-brand/35'
                }`}
              >
                {f.tag ? (
                  <div className="mb-4 inline-flex rounded-full border border-brand/30 bg-brand/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-bright">
                    {f.tag}
                  </div>
                ) : null}

                <h3 className="text-lg font-semibold text-fg">{f.title}</h3>
                <p className="mt-3 text-sm leading-7 text-fg/72">{f.body}</p>
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
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 text-center md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
            Nasza zasada
          </div>

          <h2 className="mx-auto mt-5 max-w-3xl text-[24px] font-semibold leading-[1.2] tracking-tight text-fg md:text-[34px]">
            Mniej partnerów, większy efekt.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-fg/70 md:text-lg">
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

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
            Jak zacząć
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Trzy kroki do współpracy.
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="group rounded-[28px] border border-fg/12 bg-surface-2/60 p-8 backdrop-blur transition duration-200 hover:border-brand/50 hover:bg-brand/[0.05]"
              >
                <div className="text-[40px] font-bold leading-none text-brand-text/40 transition-colors duration-200 group-hover:text-brand-bright">
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
              <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
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
                  className="text-brand-bright transition hover:opacity-80"
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
