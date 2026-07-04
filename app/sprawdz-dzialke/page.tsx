import type { Metadata } from 'next';
import FaqSection from '@/components/FaqSection';
import type { FaqItem } from '@/lib/seoCategoryContent';
import SprawdzSearch from '@/components/sprawdz/SprawdzSearch';
import type { RaportData } from '@/components/sprawdz/Raport';
import { getParcelById } from '@/lib/uldk';
import { getPointValuation } from '@/lib/seoHub';
import { getMpzpAtPoint } from '@/lib/mpzp';

// P24: narzędzie „Sprawdź działkę". Publiczny magnes na linki + fraza SEO „sprawdź działkę".
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sprawdź działkę: granice, powierzchnia i orientacyjna cena w jednym raporcie',
  description:
    'Wpisz adres lub numer ewidencyjny, a pokażemy granice, powierzchnię i numer działki z rejestru GUGiK, przeznaczenie z planu miejscowego (MPZP) oraz orientacyjną cenę okolicy. Za darmo.',
  alternates: { canonical: '/sprawdz-dzialke' },
  openGraph: {
    title: 'Sprawdź działkę | tylkodzialki.pl',
    description:
      'Granice, powierzchnia i numer działki z GUGiK, przeznaczenie z planu miejscowego i orientacyjna cena. Wskaż działkę i pobierz raport.',
    url: '/sprawdz-dzialke',
    type: 'website',
  },
};

// Stały, znany identyfikator do przykładowego raportu (centrum Warszawy). Realne dane z ULDK —
// jeśli usługa nie odpowie, przykład się nie renderuje (nie wywala strony).
const EXAMPLE_PARCEL_ID = '146502_8.1103.110/4';

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
    question: 'Czy pokazujecie plan miejscowy (MPZP)?',
    answer:
      'Tak, tam gdzie gmina jest w Krajowej Integracji MPZP (GUGiK). Dla środka działki pokazujemy przeznaczenie, nazwę planu i maksymalną wysokość zabudowy, a cały plan możesz podejrzeć jako warstwę na mapie. Gdzie planu nie ma w integracji, mówimy o tym wprost i odsyłamy do gminy, zamiast zgadywać.',
  },
  {
    question: 'Co oznaczają wymiary i długości boków na mapie?',
    answer:
      'To orientacyjne długości granic działki policzone z jej obrysu w ewidencji. Pokazujemy je przy bokach na mapie oraz jako przybliżone „bok na bok" w danych. Pomagają szybko ocenić kształt i to, czy zmieści się na niej dom, ale przed zakupem warto potwierdzić je geodezyjnie.',
  },
  {
    question: 'Czym różni się plan miejscowy (MPZP) od warunków zabudowy (WZ)?',
    answer:
      'Plan miejscowy to prawo lokalne, które z góry określa, co i jak można zbudować na działce. Gdy planu nie ma, o zabudowie decyduje indywidualna decyzja o warunkach zabudowy (WZ). Jeśli dla wskazanej działki nie znajdziemy planu w krajowej integracji, mówimy o tym wprost, bo najczęściej znaczy to właśnie tryb WZ.',
  },
  {
    question: 'Czy mogę sprawdzić działkę po samym numerze ewidencyjnym?',
    answer:
      'Tak. Jeśli znasz pełny numer ewidencyjny (na przykład 146502_8.1103.110/4), wpisz go w pole numeru, a odpytamy ewidencję bezpośrednio po nim. Nie musisz wtedy wskazywać punktu na mapie.',
  },
  {
    question: 'Czy dane są aktualne i wiążące?',
    answer:
      'Granice, powierzchnia i plan pochodzą z publicznych rejestrów GUGiK i są tak aktualne, jak dane w tych rejestrach. Raport jest rzetelnym punktem startu, ale przy zakupie zawsze potwierdź kluczowe rzeczy w urzędzie gminy, ewidencji i księdze wieczystej.',
  },
  {
    question: 'Czy narzędzie jest darmowe?',
    answer:
      'Tak, w całości. Sprawdzisz dowolną liczbę działek za darmo i bez zakładania konta.',
  },
];

async function loadExample(): Promise<RaportData | null> {
  try {
    const parcel = await getParcelById(EXAMPLE_PARCEL_ID);
    if (!parcel) return null;
    const [valuation, mpzp] = await Promise.all([
      getPointValuation(parcel.center.lat, parcel.center.lng),
      getMpzpAtPoint(parcel.center.lat, parcel.center.lng),
    ]);
    return { parcel, valuation, mpzp };
  } catch {
    return null;
  }
}

export default async function SprawdzDzialkePage() {
  const example = await loadExample();

  return (
    <main className="relative w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* NARZĘDZIE (wyszukiwarka-hero + mapa + wynik/przykład) */}
      <section className="relative mx-auto max-w-6xl px-6 pb-14 pt-8 md:px-10 md:pt-12">
        <SprawdzSearch example={example} />
      </section>

      {/* FAQ najpierw */}
      <FaqSection items={FAQ} green wide />

      {/* SEO / JAK TO DZIAŁA — pod najczęstszymi pytaniami, od lewej */}
      <section className="relative overflow-hidden border-t border-fg/10">
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <h2 className="text-xl font-semibold tracking-tight text-brand-text md:text-2xl">
            Co możesz sprawdzić i skąd to wiemy
          </h2>

          <div className="mt-6 max-w-3xl space-y-5 text-[15px] leading-8 text-fg/72">
            <p>
              Kupno działki zaczyna się od prostego pytania: gdzie dokładnie leżą jej granice i ile
              ma metrów. Nasze narzędzie odpowiada na nie od razu. Klikasz działkę na mapie albo
              wpisujesz adres, a my odpytujemy publiczny rejestr ewidencji gruntów (ULDK, GUGiK) i
              rysujemy obrys działki wraz z powierzchnią i numerem ewidencyjnym.
            </p>
            <p>
              Odczytujemy też plan miejscowy z Krajowej Integracji MPZP i wyciągamy z niego
              najważniejsze: przeznaczenie działki, maksymalną wysokość zabudowy i intensywność.
              Gdzie planu w integracji nie ma, mówimy o tym wprost i odsyłamy do gminy, zamiast
              zgadywać.
            </p>
            <p>
              Do tego dokładamy orientacyjną cenę okolicy z naszych aktualnych ogłoszeń i pokazujemy,
              na ilu ofertach się opiera. Klasę gruntu i księgę wieczystą sprawdza się w źródłach
              urzędowych, więc w raporcie prowadzimy Cię krok po kroku, gdzie i jak to zweryfikować.
            </p>
          </div>
        </div>
      </section>

      <div className="h-16" />
    </main>
  );
}
