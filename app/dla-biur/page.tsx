import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import AgencyCounter from '@/components/AgencyCounter';
import DlaBiurForm from '@/components/DlaBiurForm';
import ScrollFill from '@/components/ScrollFill';
import { OfficeLogo } from '@/components/OfficeLogo';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Dla biur nieruchomości: integracja z CRM i import ofert działek',
  description:
    'Łączymy tylkodzialki.pl z każdym systemem CRM. Automatyczny import i synchronizacja Twoich ofert działek na bieżąco, bez ręcznego przepisywania. Dołącz do biur, które już nam zaufały.',
  alternates: { canonical: '/dla-biur' },
  openGraph: {
    title: 'Dla biur nieruchomości | tylkodzialki.pl',
    description:
      'Integracja z każdym CRM, automatyczny import i synchronizacja ofert działek. Portal wyłącznie o działkach.',
    url: '/dla-biur',
    type: 'website',
    // Metadane strony nadpisują cały blok openGraph z layoutu, więc bez tej linii
    // link do /dla-biur wklejony na Facebooku czy w mailu szedł bez grafiki.
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'tylkodzialki.pl' }],
  },
};

const PAGE_BG = 'var(--bg)';

const FEATURES = [
  {
    title: 'Dowolny CRM',
    body: 'Pracujesz w dowolnym systemie do obsługi nieruchomości? Podłączymy się do niego. Nie zmieniasz swoich nawyków ani narzędzi.',
  },
  {
    title: 'Automatyczny import',
    body: 'Twoje działki trafiają na portal bez przepisywania. Raz skonfigurowane połączenie działa samo, także przy setkach ofert.',
  },
  {
    title: 'Synchronizacja na bieżąco',
    body: 'Portal odpytuje Twój system co dwie godziny. Ceny i statusy same się aktualizują, sprzedane znika, nowe się pojawia.',
  },
  {
    title: 'Wyłącznie działki',
    body: 'Portal w całości o działkach. Twoje grunty trafiają do ludzi, którzy szukają dokładnie tego, co sprzedajesz.',
  },
];

const LEAD_POINTS = [
  {
    title: 'Telefon do agenta',
    body: 'Przycisk „Zadzwoń" i SMS z gotową treścią prowadzą wprost na numer opiekuna oferty.',
  },
  {
    title: 'Bez pośrednika w kontakcie',
    body: 'Nie mamy skrzynki na zapytania i nie odsprzedajemy leadów. Rozmowa jest Twoja.',
  },
  {
    title: 'Twoja marka przy ofercie',
    body: 'Logo i nazwa biura widoczne na liście, na mapie i na stronie każdej działki.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Zgłoś się do nas',
    body: 'Wypełnij formularz poniżej. Odpowiadamy tego samego dnia roboczego, osobiście, nie automatem.',
  },
  {
    n: '02',
    title: 'Podłączamy Twój CRM',
    body: 'Konfigurujemy integrację po naszej stronie. Nie musisz nic instalować ani programować.',
  },
  {
    n: '03',
    title: 'Oferty zawsze aktualne',
    body: 'Działki importują się i synchronizują automatycznie. Ty zajmujesz się sprzedażą.',
  },
];

export default async function DlaBiurPage() {
  const [agencyCount, topOwnerzy] = await Promise.all([
    prisma.user.count({ where: { defaultBiuroLogoUrl: { not: null } } }),
    prisma.dzialka.groupBy({
      by: ['ownerId'],
      where: { status: 'AKTYWNE', ownerId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { ownerId: 'desc' } },
      take: 40,
    }),
  ]);

  // Pas logotypów: biura z największą liczbą ofert, bo to one najlepiej świadczą o portalu.
  const kolejnosc = topOwnerzy.map((g) => g.ownerId).filter((id): id is string => !!id);
  const biuraZLogo = kolejnosc.length
    ? await prisma.user.findMany({
        where: { id: { in: kolejnosc }, defaultBiuroLogoUrl: { not: null } },
        select: {
          id: true,
          defaultBiuroNazwa: true,
          defaultBiuroLogoUrl: true,
          defaultBiuroLogoBg: true,
        },
      })
    : [];

  const logotypy = kolejnosc
    .map((id) => biuraZLogo.find((b) => b.id === id))
    .filter((b): b is (typeof biuraZLogo)[number] => !!b?.defaultBiuroLogoUrl)
    .slice(0, 18);

  return (
    <main
      className="relative w-full overflow-hidden"
      style={{ background: PAGE_BG }}
    >
      {/* HERO — pełna wysokość; 2 kolumny na desktopie (lewo wielki licznik, prawo teksty), od lewej też na mobile */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden border-b border-fg/10">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_15%,rgba(122,163,51,0.18),transparent_36%),radial-gradient(circle_at_82%_78%,rgba(47,94,70,0.05),transparent_34%)]" />
        <div className="pointer-events-none absolute left-[-140px] top-24 z-0 h-[420px] w-[420px] rounded-full bg-brand/10 blur-[120px]" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 text-left md:px-10 md:py-20 lg:grid-cols-2 lg:gap-16">
          {agencyCount > 0 ? (
            <div className="flex justify-start">
              <AgencyCounter target={agencyCount} />
            </div>
          ) : null}

          <div className={agencyCount > 0 ? '' : 'lg:col-span-2'}>
            <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/12 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-text md:text-[12px]">
              Publikacja bezpłatna, bez wyłączności
            </span>

            <h1 className="mt-5 text-[26px] font-semibold leading-[1.12] tracking-tight text-fg md:text-[40px] lg:text-[44px]">
              Wystawiaj oferty działek automatycznie przez integrację z CRM.
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-7 text-fg/68 md:text-base">
              Łączymy się z Twoim systemem i na bieżąco synchronizujemy oferty.
              Zero ręcznego dodawania. Ty sprzedajesz, my dbamy o widoczność
              Twoich gruntów w całej Polsce.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row">
              <Link
                href="#kontakt"
                className="inline-flex h-13 w-full items-center justify-center rounded-2xl bg-brand px-8 py-4 text-[15px] font-semibold text-ink transition hover:bg-brand-bright sm:w-auto sm:min-w-[13.5rem]"
              >
                Połącz swoje CRM
              </Link>

              <Link
                href="#jak-to-dziala"
                className="inline-flex h-13 w-full items-center justify-center rounded-2xl border border-fg/15 px-8 py-4 text-[15px] font-medium text-fg/85 transition hover:border-fg/30 hover:text-fg sm:w-auto sm:min-w-[13.5rem]"
              >
                Jak to działa
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PAS LOGOTYPÓW: dowód zamiast deklaracji. Kolejność wg liczby ofert, więc
          na przodzie idą biura, które realnie na nas postawiły. */}
      {logotypy.length >= 6 ? (
        <section className="relative border-b border-fg/10 bg-surface-2/40">
          <div className="mx-auto max-w-7xl px-6 py-9 md:px-10 md:py-11">
            <p className="text-center text-[11px] uppercase tracking-[0.22em] text-fg/45">
              Publikują u nas między innymi
            </p>

            <div className="pas-logo mt-7">
              <div className="pas-logo-track">
                {[...logotypy, ...logotypy].map((b, i) => (
                  <span
                    key={`${b.id}-${i}`}
                    className="flex shrink-0 items-center px-7 opacity-75 transition hover:opacity-100 md:px-9"
                    aria-hidden={i >= logotypy.length}
                  >
                    <OfficeLogo
                      src={b.defaultBiuroLogoUrl as string}
                      alt={b.defaultBiuroNazwa ?? ''}
                      variant="preview"
                      bg={!!b.defaultBiuroLogoBg}
                      // Pas jedzie transformacją, a nie scrollem, więc leniwe ładowanie
                      // zostawiłoby dziury w miejscu logotypów, które dopiero wjeżdżają.
                      eager
                    />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* INTEGRACJE: łączymy się z każdym CRM */}
      <section className="relative overflow-hidden">
        <ScrollFill />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-3xl">
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
              Integracje
            </div>

            <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
              Łączymy się z każdym systemem CRM.
            </h2>

            <p className="mt-6 text-base leading-8 text-fg/70 md:text-lg">
              Nieważne, w jakim programie prowadzisz oferty. I tak się
              podłączymy. Import działa w tle: nowe działki pojawiają się na
              portalu same, zmiany cen i statusów aktualizują się
              automatycznie, a zakończone oferty znikają.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-[28px] border border-fg/12 bg-surface-2/60 p-7 backdrop-blur transition hover:border-brand/35"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-base font-semibold text-brand-bright">
                  {String(i + 1).padStart(2, '0')}
                </div>

                <h3 className="mt-5 text-lg font-semibold text-fg">
                  {f.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-fg/72">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JAK TO DZIAŁA */}
      <section
        id="jak-to-dziala"
        className="relative scroll-mt-24 overflow-hidden border-y border-fg/10 bg-surface-2"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.12),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.05),transparent_32%)]" />
        <ScrollFill className="md:hidden" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
            Jak to działa
          </div>

          <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
            Trzy kroki. Resztę robimy my.
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

                <h3 className="mt-5 text-xl font-semibold text-fg">
                  {s.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-fg/72">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEAD ZOSTAJE U BIURA. Pierwsza obawa pośrednika przy nowym portalu brzmi
          „czy wy mi przejmiecie klienta", więc odpowiadamy na nią wprost. */}
      <section className="relative overflow-hidden">
        <ScrollFill />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-3xl">
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
              Twój klient
            </div>

            <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-fg md:text-[34px] md:leading-[1.1]">
              Kupujący dzwoni prosto do Ciebie.
            </h2>

            <p className="mt-6 text-base leading-8 text-fg/70 md:text-lg">
              Nie wchodzimy między Ciebie a klienta. Przy każdej ofercie stoi
              Twoje logo, nazwa biura i numer opiekuna. Zapytanie idzie na ten
              numer, a nie do naszej skrzynki.
            </p>
          </div>

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LEAD_POINTS.map((p) => (
              <li
                key={p.title}
                className="group rounded-[28px] border border-fg/12 bg-surface-2/60 p-7 backdrop-blur transition hover:border-brand/35"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 text-brand-bright"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 10.5 8 14.5 16 6" />
                  </svg>
                </div>

                <h3 className="mt-5 text-lg font-semibold text-fg">{p.title}</h3>

                <p className="mt-3 text-sm leading-7 text-fg/72">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* KONTAKT — 2 kolumny na desktopie: lewo tekst, prawo formularz */}
      <section id="kontakt" className="relative scroll-mt-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(122,163,51,0.14),transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
            <div>
              <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
                Kontakt
              </div>

              <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-fg md:text-[30px] md:leading-[1.08] lg:whitespace-nowrap">
                Porozmawiajmy o integracji.
              </h2>

              <p className="mt-5 max-w-md text-base leading-8 text-fg/70">
                Podłączymy Twój system, skonfigurujemy import po naszej stronie
                i zadbamy, żeby Twoje działki były widoczne w całej Polsce. Bez
                instalacji, bez przepisywania, bez pracy po Twojej stronie.
              </p>

              <p className="mt-6 flex items-center gap-2.5 text-sm font-medium text-fg">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-brand"
                  aria-hidden="true"
                />
                Odpowiadamy tego samego dnia roboczego.
              </p>

              <p className="mt-4 text-sm text-fg/68">
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
              <DlaBiurForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
