import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import AgencyCounter from '@/components/AgencyCounter';
import DlaBiurForm from '@/components/DlaBiurForm';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Dla biur nieruchomości: integracja z CRM i import ofert działek',
  description:
    'Łączymy TylkoDziałki.pl z każdym systemem CRM. Automatyczny import i codzienna synchronizacja Twoich ofert działek bez ręcznego przepisywania. Dołącz do biur, które już nam zaufały.',
  alternates: { canonical: '/dla-biur' },
  openGraph: {
    title: 'Dla biur nieruchomości | TylkoDziałki.pl',
    description:
      'Integracja z każdym CRM, automatyczny import i synchronizacja ofert działek. Portal wyłącznie o działkach.',
    url: '/dla-biur',
    type: 'website',
  },
};

const PAGE_BG = '#131313';

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
    title: 'Codzienna synchronizacja',
    body: 'Ceny, opisy i statusy aktualizują się automatycznie. Sprzedane znika, nowe się pojawia. Dane zawsze aktualne.',
  },
  {
    title: 'Wyłącznie działki',
    body: 'Portal w całości o działkach. Twoje grunty trafiają do ludzi, którzy szukają dokładnie tego, co sprzedajesz.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Zgłoś się do nas',
    body: 'Wypełnij formularz poniżej. Dopytamy o Twój system CRM i liczbę ofert działek.',
  },
  {
    n: '02',
    title: 'Podłączamy Twój CRM',
    body: 'Konfigurujemy integrację po naszej stronie. Nie musisz nic instalować ani programować.',
  },
  {
    n: '03',
    title: 'Oferty żyją same',
    body: 'Działki importują się i synchronizują automatycznie. Ty zajmujesz się sprzedażą.',
  },
];

export default async function DlaBiurPage() {
  const agencyCount = await prisma.user.count({
    where: { defaultBiuroLogoUrl: { not: null } },
  });

  return (
    <main
      className="relative w-full overflow-hidden"
      style={{ background: PAGE_BG }}
    >
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_15%,rgba(122,163,51,0.18),transparent_36%),radial-gradient(circle_at_82%_78%,rgba(47,94,70,0.22),transparent_34%)]" />
        <div className="pointer-events-none absolute left-[-140px] top-24 z-0 h-[420px] w-[420px] rounded-full bg-[#7aa333]/10 blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-5xl px-6 py-24 text-center md:px-10 md:py-32">
          {agencyCount > 0 ? (
            <div className="mb-10">
              <AgencyCounter target={agencyCount} />
            </div>
          ) : null}

          <h1 className="mx-auto max-w-4xl text-[34px] font-semibold leading-[1.06] tracking-tight text-white md:text-[60px]">
            Wystawiaj oferty działek automatycznie przez integrację z CRM.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-white/68 md:text-lg">
            Łączymy się z Twoim systemem i codziennie synchronizujemy oferty.
            Zero ręcznego dodawania. Ty sprzedajesz, my dbamy o widoczność
            Twoich gruntów w całej Polsce.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="#kontakt"
              className="inline-flex h-13 items-center justify-center rounded-2xl bg-[#7aa333] px-8 py-4 text-[15px] font-semibold text-[#0d0d0d] transition hover:bg-[#9fd14b]"
            >
              Połącz swoje CRM
            </Link>

            <Link
              href="#jak-to-dziala"
              className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/15 px-8 py-4 text-[15px] font-medium text-white/85 transition hover:border-white/30 hover:text-white"
            >
              Jak to działa
            </Link>
          </div>
        </div>
      </section>

      {/* INTEGRACJE: łączymy się z każdym CRM */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-3xl">
            <div className="text-[12px] uppercase tracking-[0.22em] text-[#9fd14b]">
              Integracje
            </div>

            <h2 className="mt-5 text-[30px] font-semibold tracking-tight text-white md:text-[46px] md:leading-[1.05]">
              Łączymy się z każdym systemem CRM.
            </h2>

            <p className="mt-6 text-base leading-8 text-white/65 md:text-lg">
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
                className="group rounded-[28px] border border-white/12 bg-[#0d0d0d]/60 p-7 backdrop-blur transition hover:border-[#7aa333]/35"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#7aa333]/25 bg-[#7aa333]/10 text-base font-semibold text-[#9fd14b]">
                  {String(i + 1).padStart(2, '0')}
                </div>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  {f.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/60">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JAK TO DZIAŁA */}
      <section
        id="jak-to-dziala"
        className="relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#0b0b0b]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.12),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.18),transparent_32%)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-[12px] uppercase tracking-[0.22em] text-[#9fd14b]">
            Jak to działa
          </div>

          <h2 className="mt-5 max-w-3xl text-[30px] font-semibold tracking-tight text-white md:text-[46px] md:leading-[1.05]">
            Trzy kroki. Resztę robimy my.
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="group rounded-[28px] border border-white/12 bg-[#0d0d0d]/60 p-8 backdrop-blur transition duration-200 hover:border-[#7aa333]/50 hover:bg-[#7aa333]/[0.05]"
              >
                <div className="text-[40px] font-bold leading-none text-[#7aa333]/40 transition-colors duration-200 group-hover:text-[#9fd14b]">
                  {s.n}
                </div>

                <h3 className="mt-5 text-xl font-semibold text-white">
                  {s.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section
        id="kontakt"
        className="relative scroll-mt-24 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(122,163,51,0.14),transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 md:px-10 md:py-28">
          <div className="text-center">
            <div className="text-[12px] uppercase tracking-[0.22em] text-[#9fd14b]">
              Kontakt
            </div>

            <h2 className="mt-5 text-[30px] font-semibold tracking-tight text-white md:text-[44px] md:leading-[1.05]">
              Porozmawiajmy o integracji.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/65">
              Zostaw kontakt i napisz, czego potrzebujesz. Odezwiemy się na
              podany adres e-mail.
            </p>
          </div>

          <div className="mt-12 rounded-[32px] border border-white/12 bg-[#0d0d0d]/60 p-6 backdrop-blur md:p-10">
            <DlaBiurForm />
          </div>

          <p className="mt-6 text-center text-sm text-white/45">
            Wolisz e-mail? Napisz na{' '}
            <a
              href="mailto:biuro@tylkodzialki.pl"
              className="text-[#9fd14b] transition hover:opacity-80"
            >
              biuro@tylkodzialki.pl
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
