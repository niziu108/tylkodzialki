import type { Metadata } from 'next';
import FaqSection from '@/components/FaqSection';
import type { FaqItem } from '@/lib/seoCategoryContent';
import SprawdzSearch from '@/components/sprawdz/SprawdzSearch';
import CheckIcon from '@/components/CheckIcon';
import type { RaportData } from '@/components/sprawdz/Raport';
import { DEMO_MPZP, DEMO_PARCEL, DEMO_POG, DEMO_ZEBRANO } from '@/components/sprawdz/demoRaport';
import { getNearbyOffers, getPointValuation } from '@/lib/seoHub';
import { getAreaPriceTrend } from '@/lib/dzialkaPriceHistory';

// P24: narzędzie „Sprawdź działkę". Publiczny magnes na linki + fraza SEO „sprawdź działkę".
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sprawdź działkę: granice, powierzchnia i orientacyjna cena w jednym raporcie',
  description:
    'Wpisz adres albo wskaż działkę na mapie, a pokażemy granice, powierzchnię i numer działki z rejestru GUGiK, przeznaczenie z planu miejscowego (MPZP) oraz orientacyjną cenę okolicy. Za darmo.',
  alternates: { canonical: '/sprawdz-dzialke' },
  openGraph: {
    title: 'Sprawdź działkę | tylkodzialki.pl',
    description:
      'Granice, powierzchnia i numer działki z GUGiK, przeznaczenie z planu miejscowego i orientacyjna cena. Wpisz adres albo wskaż działkę na mapie.',
    url: '/sprawdz-dzialke',
    type: 'website',
  },
};

// Nie lista funkcji, tylko pytania, które kupujący ma w głowie stojąc na działce.
// Każde z nich raport naprawdę zamyka danymi, które zwracamy (ULDK, MPZP z KIMPZP,
// plan ogólny gminy, wycena z naszych ofert, oferty w promieniu, checklista).
// Zero obietnic bez pokrycia ([[feedback-filtry-twarde]]).
const CO_DOSTANIESZ: { title: string; sub: string }[] = [
  {
    title: 'Czy postawisz tu dom?',
    sub: 'Najdroższy błąd przy działce to kupić ziemię, na której nic nie wolno zbudować. Czytamy dla niej plan miejscowy (przeznaczenie, maksymalna wysokość, intensywność zabudowy), a gdy planu nie ma, plan ogólny gminy i to, czy działka leży w obszarze uzupełnienia zabudowy. Bez tego obszaru gmina co do zasady nie wyda warunków zabudowy.',
  },
  {
    title: 'Ile ta ziemia jest naprawdę warta?',
    sub: 'Cena za metr z aktualnych ogłoszeń w okolicy, liczona na działkach podobnej wielkości i tego samego typu. Zanim zadzwonisz, wiesz, czy cena z ogłoszenia trzyma się rynku, czy jest o jedną trzecią za wysoka. Gdy okoliczne ceny rozjeżdżają się za mocno, pokazujemy widełki zamiast udawać jedną liczbę.',
  },
  {
    title: 'Gdzie dokładnie kończy się ta działka?',
    sub: 'Obrys prosto z ewidencji gruntów, na mapie z granicami sąsiednich działek, z metrażem i długościami boków. Widzisz kształt, bo wąska rynna 15 na 90 metrów to zupełnie inna działka niż kwadrat, i sprawdzasz, czy sprzedający podał prawdziwą powierzchnię.',
  },
  {
    title: 'Jakim numerem posługiwać się w urzędzie?',
    sub: 'Numer działki, obręb, identyfikator, gmina, powiat i województwo. Dokładnie tych danych żąda wniosek o warunki zabudowy, zamówienie wypisu z ewidencji i wyszukiwarka ksiąg wieczystych. Masz je od razu, bez proszenia sprzedającego.',
  },
  {
    title: 'Co jeszcze jest tu na sprzedaż?',
    sub: 'Pod raportem pokazujemy działki na sprzedaż w tym samym promieniu, na którym liczyliśmy cenę. Czasem kilometr dalej stoi tańsza i lepsza od tej, którą właśnie sprawdzasz.',
  },
  {
    title: 'Czego mapa i tak nie powie?',
    sub: 'Klasy gruntu, prądu i wody przy granicy, drogi dojazdowej i stanu księgi wieczystej nie wyczyta z rejestru nikt, ani my, ani sprzedający. Dlatego raport kończy się listą tych rzeczy i instrukcją krok po kroku, gdzie każdą z nich sprawdzić samemu.',
  },
];

const FAQ: FaqItem[] = [
  {
    question: 'Skąd bierzecie granice i powierzchnię działki?',
    answer:
      'Z publicznego rejestru ewidencji gruntów (usługa ULDK prowadzona przez GUGiK). Odpytujemy go dla punktu, który wskażesz na mapie lub który wynika z wpisanego adresu, więc dane dotyczą konkretnej działki, a nie przybliżenia.',
  },
  {
    question: 'Czy orientacyjna cena to wycena działki?',
    answer:
      'Nie. To przeciętna cena i zakres z aktualnych ogłoszeń działek w okolicy wskazanego punktu, liczone dla tego samego typu działki i z możliwie najbliższego otoczenia. Gdy ceny w okolicy rozjeżdżają się za mocno, pokazujemy widełki zamiast jednej liczby. To rząd wielkości, a nie operat rzeczoznawcy: o realnej cenie decydują media, dojazd, kształt i przeznaczenie konkretnej działki.',
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
      'Na razie nie. Działkę wskazujesz adresem albo klikając ją na mapie, bo tak szuka większość osób. Numer ewidencyjny, obręb i identyfikator dostajesz w raporcie, więc możesz stąd wziąć je do urzędu czy księgi wieczystej.',
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

// Przykładowy raport pokazywany pod narzędziem, dopóki user nie sprawdzi własnej działki (P38 B2).
// Podział jest celowy: dane rejestrowe (ewidencja, plan miejscowy, plan ogólny) są ZAMROŻONE w
// `demoRaport.ts`, bo usługi GUGiK bywają niedostępne i demo znikałoby razem z nimi. Cenę okolicy,
// trend i oferty liczymy tu i teraz z NASZEJ bazy, więc przykład nigdy nie pokazuje nieaktualnych
// kwot ani działek, które już się sprzedały. Strona i tak odświeża się co godzinę (revalidate).
async function zbudujDemo(): Promise<RaportData | undefined> {
  try {
    const { lat, lng } = DEMO_PARCEL.center;
    const valuation = await getPointValuation(lat, lng, DEMO_PARCEL.areaM2);
    const [nearby, trend] = await Promise.all([
      getNearbyOffers(lat, lng, valuation.radiusKm),
      getAreaPriceTrend(lat, lng, valuation.radiusKm),
    ]);
    return { parcel: DEMO_PARCEL, valuation, mpzp: DEMO_MPZP, pog: DEMO_POG, trend, nearby };
  } catch {
    // Brak demo nie może wywrócić narzędzia — samo pole wyszukiwania działa dalej.
    return undefined;
  }
}

export default async function SprawdzDzialkePage() {
  const demo = await zbudujDemo();

  return (
    <main className="relative w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* NARZĘDZIE (wyszukiwarka-hero na zdjęciu + mapa + wynik) */}
      <SprawdzSearch demo={demo} demoZebrano={DEMO_ZEBRANO.split('-').reverse().join('.')} />

      {/* CO DOSTAJESZ — od lewej, spójne z FAQ i sekcjami niżej. Zaraz pod narzędziem,
          żeby od razu było jasne, co jest w raporcie, zanim ktoś wpisze adres. */}
      <section className="border-t border-fg/10">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">
            Sześć pytań, na które raport odpowiada od razu
          </h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-8 text-fg/70 md:text-base">
            Ogłoszenie mówi metraż i cenę. Reszty, czyli tego, co decyduje o zakupie, szuka się
            zwykle w gminie, w starostwie i w geoportalu, każdej rzeczy gdzie indziej. Wskaż
            działkę na mapie albo wpisz adres, a zbierzemy to za Ciebie w kilka sekund. Za darmo,
            bez logowania i tyle razy, ile chcesz.
          </p>

          <div className="mt-10 grid gap-x-14 gap-y-9 md:mt-12 md:grid-cols-2">
            {CO_DOSTANIESZ.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 border-t border-fg/12 pt-6"
              >
                <CheckIcon className="mt-0.5" />
                <div>
                  <h3 className="text-[17px] font-semibold text-fg md:text-[19px]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-7 text-fg/62 md:text-[15px]">
                    {item.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Kto doczytał listę do końca, ten jest przekonany. Kotwica wraca do pola na górze,
              żeby nie musiał scrollować w górę i szukać go wzrokiem. Zwykły link, bez JS. */}
          <div className="mt-12 border-t border-fg/12 pt-8">
            <a
              href="#narzedzie"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-7 text-[12px] font-medium uppercase tracking-[0.18em] text-ink transition hover:bg-brand-bright"
            >
              Sprawdź swoją działkę
            </a>
            <p className="mt-3 text-sm text-fg/60">
              Raport masz w kilka sekund. Nie prosimy o e-mail ani o numer telefonu.
            </p>
          </div>
        </div>
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
              Planu miejscowego nie ma jednak dla większości działek w Polsce, więc sięgamy dalej,
              do planu ogólnego gminy: pokazujemy strefę planistyczną i to, czy działka leży w
              obszarze uzupełnienia zabudowy, bo bez niego gmina co do zasady nie wyda warunków
              zabudowy. Gdzie gmina nie przysłała jeszcze danych, mówimy o tym wprost i odsyłamy
              do urzędu, zamiast zgadywać.
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
