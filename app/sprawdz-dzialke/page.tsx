import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import FaqSection from '@/components/FaqSection';
import type { FaqItem } from '@/lib/seoCategoryContent';
import SprawdzSearch from '@/components/sprawdz/SprawdzSearch';
import Raport, { type RaportData } from '@/components/sprawdz/Raport';
import { getParcelById } from '@/lib/uldk';
import { getPointValuation } from '@/lib/seoHub';

// P24: narzędzie „Sprawdź działkę". Publiczny magnes na linki + fraza SEO „sprawdź działkę".
// Strona jest głównym, linkowalnym zasobem: wyszukiwarka + realny przykładowy raport + FAQ.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sprawdź działkę: granice, powierzchnia i orientacyjna cena w jednym raporcie',
  description:
    'Wskaż działkę na mapie lub wpisz adres, a pokażemy jej granice, powierzchnię i numer ewidencyjny z rejestru GUGiK oraz orientacyjną cenę okolicy z ofert w serwisie. Za darmo.',
  alternates: { canonical: '/sprawdz-dzialke' },
  openGraph: {
    title: 'Sprawdź działkę | tylkodzialki.pl',
    description:
      'Granice, powierzchnia i numer ewidencyjny z GUGiK plus orientacyjna cena okolicy. Wskaż punkt na mapie i pobierz raport.',
    url: '/sprawdz-dzialke',
    type: 'website',
  },
};

// Stały, znany identyfikator do przykładowego raportu (centrum Warszawy). Realne dane z ULDK —
// jeśli usługa akurat nie odpowie, sekcja przykładu po prostu się nie renderuje (nie wywala strony).
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
    question: 'Czy pokazujecie plan miejscowy (MPZP) i klasę gruntu?',
    answer:
      'MPZP i klasę gruntu sprawdza się w gminie i w ewidencji, bo nie ma jednego ogólnopolskiego rejestru, z którego dałoby się je pobrać w pełni automatycznie. W raporcie prowadzimy Cię krok po kroku, gdzie i jak to zweryfikować, zamiast zgadywać.',
  },
  {
    question: 'Czy narzędzie jest darmowe?',
    answer:
      'Tak. Sprawdzenie działki jest bezpłatne i nie wymaga logowania.',
  },
];

async function loadExample(): Promise<RaportData | null> {
  try {
    const parcel = await getParcelById(EXAMPLE_PARCEL_ID);
    if (!parcel) return null;
    const valuation = await getPointValuation(parcel.center.lat, parcel.center.lng);
    return { parcel, valuation };
  } catch {
    return null;
  }
}

export default async function SprawdzDzialkePage() {
  const example = await loadExample();

  return (
    <main className="relative w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-fg/10">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_12%,rgba(122,163,51,0.16),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(47,94,70,0.05),transparent_34%)]" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-10 md:px-10 md:pb-14 md:pt-14">
          <Breadcrumbs
            items={[
              { label: 'Start', href: '/' },
              { label: 'Sprawdź działkę' },
            ]}
          />

          <h1 className="mt-6 max-w-3xl text-[28px] font-semibold leading-[1.12] tracking-tight text-fg md:text-[42px]">
            Sprawdź działkę, zanim ją kupisz.
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/68 md:text-base">
            Wskaż działkę na mapie albo wpisz adres. Pokażemy jej granice, powierzchnię i numer
            ewidencyjny z rejestru GUGiK oraz orientacyjną cenę okolicy z ofert w serwisie.
            Za darmo, bez logowania.
          </p>
        </div>
      </section>

      {/* WYSZUKIWARKA + WYNIK */}
      <section className="relative mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
        <SprawdzSearch />
      </section>

      {/* PRZYKŁADOWY RAPORT */}
      {example ? (
        <section className="relative overflow-hidden border-t border-fg/10 bg-surface-2/40">
          <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 md:px-10 md:py-20">
            <div className="text-[12px] uppercase tracking-[0.22em] text-brand-bright">
              Przykładowy raport
            </div>
            <h2 className="mt-4 max-w-3xl text-[24px] font-semibold tracking-tight text-fg md:text-[32px]">
              Tak wygląda raport, który dostaniesz.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-fg/68">
              Poniżej realny przykład dla działki w centrum Warszawy. Twój raport powstanie po
              wskazaniu własnej działki wyżej.
            </p>

            <div className="mt-10">
              <Raport data={example} />
            </div>
          </div>
        </section>
      ) : null}

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
              rysujemy obrys działki na zdjęciu lotniczym wraz z powierzchnią i numerem
              ewidencyjnym.
            </p>
            <p>
              Do tego dokładamy orientacyjną cenę okolicy: medianę i zakres z aktualnych ogłoszeń
              działek w pobliżu wskazanego punktu. To rząd wielkości, a nie operat rzeczoznawcy, więc
              podajemy go uczciwie i pokazujemy, na ilu ofertach się opiera.
            </p>
            <p>
              Plan miejscowy, klasę gruntu, uzbrojenie i dojazd sprawdza się w gminie i źródłach
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
