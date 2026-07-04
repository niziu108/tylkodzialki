import type { Metadata } from 'next';
import FaqSection from '@/components/FaqSection';
import type { FaqItem } from '@/lib/seoCategoryContent';
import SprawdzSearch from '@/components/sprawdz/SprawdzSearch';
import type { RaportData } from '@/components/sprawdz/Raport';
import { getParcelById } from '@/lib/uldk';
import { getPointValuation } from '@/lib/seoHub';
import { fetchElevation } from '@/lib/elevation';

// P24: narzędzie „Sprawdź działkę". Publiczny magnes na linki + fraza SEO „sprawdź działkę".
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sprawdź działkę: granice, powierzchnia i orientacyjna cena w jednym raporcie',
  description:
    'Wskaż działkę na mapie lub wpisz adres, a pokażemy jej granice, powierzchnię i numer ewidencyjny z rejestru GUGiK, media w okolicy oraz orientacyjną cenę. Za darmo.',
  alternates: { canonical: '/sprawdz-dzialke' },
  openGraph: {
    title: 'Sprawdź działkę | tylkodzialki.pl',
    description:
      'Granice, powierzchnia i numer ewidencyjny z GUGiK, media w okolicy i orientacyjna cena. Wskaż punkt na mapie i pobierz raport.',
    url: '/sprawdz-dzialke',
    type: 'website',
  },
};

// Stały, znany identyfikator do przykładowego raportu (centrum Warszawy). Realne dane z ULDK —
// jeśli usługa nie odpowie, przykład się nie renderuje (nie wywala strony).
const EXAMPLE_PARCEL_ID = '146510_8.0502.1/3';

const FAQ: FaqItem[] = [
  {
    question: 'Skąd bierzecie granice i powierzchnię działki?',
    answer:
      'Z publicznego rejestru ewidencji gruntów (usługa ULDK prowadzona przez GUGiK). Odpytujemy go dla punktu, który wskażesz na mapie lub który wynika z wpisanego adresu albo numeru ewidencyjnego, więc dane dotyczą konkretnej działki, a nie przybliżenia.',
  },
  {
    question: 'Czy orientacyjna cena to wycena działki?',
    answer:
      'Nie. To mediana i zakres cen z aktualnych ogłoszeń działek w okolicy wskazanego punktu. Pokazuje rząd wielkości, ale nie zastępuje operatu rzeczoznawcy. O realnej cenie decydują media, dojazd, kształt i przeznaczenie konkretnej działki.',
  },
  {
    question: 'Co oznacza „media w okolicy"?',
    answer:
      'To udział działek, które w naszych ogłoszeniach w pobliżu mają dane medium (prąd, wodociąg, gaz, kanalizację) fizycznie na działce. To realny sygnał, jak uzbrojona jest okolica, a nie odległość do konkretnej sieci, której nie da się rzetelnie policzyć dla całej Polski.',
  },
  {
    question: 'Czy pokazujecie plan miejscowy (MPZP) i klasę gruntu?',
    answer:
      'MPZP i klasę gruntu sprawdza się w gminie i w ewidencji, bo nie ma jednego ogólnopolskiego rejestru, z którego dałoby się je pobrać w pełni automatycznie. W raporcie prowadzimy Cię krok po kroku, gdzie i jak to zweryfikować, zamiast zgadywać.',
  },
  {
    question: 'Czy narzędzie jest darmowe?',
    answer:
      'Pierwszą działkę sprawdzisz bez konta. Kolejne raporty są też darmowe, wymagają tylko zalogowania.',
  },
];

async function loadExample(): Promise<RaportData | null> {
  try {
    const parcel = await getParcelById(EXAMPLE_PARCEL_ID);
    if (!parcel) return null;
    const [valuation, elevationM] = await Promise.all([
      getPointValuation(parcel.center.lat, parcel.center.lng),
      fetchElevation(parcel.center.lat, parcel.center.lng),
    ]);
    return { parcel, valuation, elevationM };
  } catch {
    return null;
  }
}

export default async function SprawdzDzialkePage() {
  const example = await loadExample();

  return (
    <main className="relative w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(122,163,51,0.14),transparent_45%)]" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-4 pt-14 text-center md:pt-20">
          <div className="text-[12px] uppercase tracking-[0.2em] text-fg/45">Sprawdź działkę</div>

          <h1 className="mt-4 text-[30px] font-semibold leading-[1.1] tracking-tight text-fg md:text-[46px]">
            Sprawdź działkę, zanim ją kupisz.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-fg/65 md:text-base">
            Wskaż działkę na mapie albo wpisz adres. Pokażemy jej granice, powierzchnię i numer
            ewidencyjny z rejestru GUGiK, media w okolicy oraz orientacyjną cenę. Pierwsza za darmo,
            bez konta.
          </p>
        </div>
      </section>

      {/* NARZĘDZIE (formularz + mapa + wynik/przykład) */}
      <section className="relative mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
        <SprawdzSearch example={example} />
      </section>

      {/* SEO / JAK TO DZIAŁA */}
      <section className="relative overflow-hidden border-t border-fg/10">
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-20">
          <h2 className="text-[22px] font-semibold tracking-tight text-fg md:text-[28px]">
            Co możesz sprawdzić i skąd to wiemy
          </h2>

          <div className="mt-6 space-y-5 text-[15px] leading-8 text-fg/72">
            <p>
              Kupno działki zaczyna się od prostego pytania: gdzie dokładnie leżą jej granice i ile
              ma metrów. Nasze narzędzie odpowiada na nie od razu. Klikasz działkę na mapie albo
              wpisujesz adres, a my odpytujemy publiczny rejestr ewidencji gruntów (ULDK, GUGiK) i
              rysujemy obrys działki wraz z powierzchnią, wymiarami i numerem ewidencyjnym.
            </p>
            <p>
              Do tego dokładamy orientacyjną cenę okolicy oraz media w okolicy, czyli udział
              pobliskich działek z prądem, wodociągiem, gazem i kanalizacją na działce. Wszystko z
              naszych aktualnych ogłoszeń, więc podajemy to uczciwie i pokazujemy, na ilu ofertach
              się opiera.
            </p>
            <p>
              Plan miejscowy, klasę gruntu i księgę wieczystą sprawdza się w gminie i źródłach
              urzędowych, bo nie ma jednego rejestru, z którego dałoby się je pobrać automatycznie
              dla całej Polski. Zamiast zgadywać, w raporcie prowadzimy Cię krok po kroku, gdzie i
              jak każdą z tych rzeczy zweryfikować.
            </p>
          </div>
        </div>
      </section>

      <FaqSection items={FAQ} />

      <div className="h-16" />
    </main>
  );
}
