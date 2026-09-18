import type { Metadata } from 'next';
import FaqSection from '@/components/FaqSection';
import type { FaqItem } from '@/lib/seoCategoryContent';
import WycenaDzialki from '@/components/wycena/WycenaDzialki';

// „Sprawdź wartość swojej działki": wejście dla właściciela (fraza „wycena działki"). Silnik ten sam
// co „Sprawdź działkę" i formularz dodawania; kończy się przejściem do formularza z już wskazaną
// działką. Kanał osób prywatnych (P27b) bez zaczepiania kogokolwiek SMS-em.

export const metadata: Metadata = {
  title: 'Wycena działki online: sprawdź, ile jest warta Twoja działka',
  description:
    'Podaj obręb i numer działki albo wskaż ją na mapie. Pokażemy ceny ofert w okolicy i kwoty z aktów notarialnych (Rejestr Cen Nieruchomości), a jeśli sprzedajesz, wystawisz ją za darmo. Bez konta.',
  alternates: { canonical: '/wycena-dzialki' },
  openGraph: {
    title: 'Sprawdź wartość swojej działki | tylkodzialki.pl',
    description:
      'Ceny ofert w okolicy i kwoty zapłacone u notariusza dla Twojej działki. Wystarczy obręb i numer działki albo kliknięcie na mapie.',
    url: '/wycena-dzialki',
    type: 'website',
  },
};

const KROKI: { nr: string; title: string; sub: string }[] = [
  { nr: '01', title: 'Podajesz numer działki', sub: 'Albo klikasz ją na mapie z granicami.' },
  { nr: '02', title: 'Widzisz ceny w okolicy', sub: 'Z ogłoszeń i z aktów notarialnych.' },
  { nr: '03', title: 'Wystawiasz za darmo', sub: 'Dane działki uzupełnimy za Ciebie.' },
];

const FAQ: FaqItem[] = [
  {
    question: 'Skąd bierzecie ceny?',
    answer:
      'Z dwóch źródeł. Pierwsze to aktualne ogłoszenia działek w naszym serwisie w promieniu kilku kilometrów, w miarę możliwości działek podobnej wielkości. Drugie to Rejestr Cen Nieruchomości prowadzony przez GUGiK, czyli kwoty faktycznie zapłacone u notariusza. Przy każdej liczbie podajemy, z ilu ofert albo transakcji ją policzyliśmy i z jakiego promienia.',
  },
  {
    question: 'Czy to jest wycena rzeczoznawcy?',
    answer:
      'Nie. To orientacja z rynku, a nie operat szacunkowy. Operat, potrzebny na przykład do kredytu, sprawy w sądzie albo podziału majątku, sporządza rzeczoznawca majątkowy, który ogląda działkę i jej dokumenty. Nasze liczby pomagają ustalić rozsądną cenę ofertową i sprawdzić, czy propozycja kupującego trzyma się rynku.',
  },
  {
    question: 'Dlaczego czasem nie podajecie kwoty za całą działkę?',
    answer:
      'Bo za metr dużej działki płaci się zwykle kilka razy mniej niż za metr działki pod dom. Kwotę za całą działkę liczymy tylko wtedy, gdy w okolicy są oferty podobnej wielkości. W przeciwnym razie pokazujemy ceny za metr z zastrzeżeniem, zamiast podawać liczbę, która do Twojej działki nie pasuje.',
  },
  {
    question: 'Co najmocniej wpływa na cenę działki?',
    answer:
      'Przeznaczenie w planie miejscowym albo szansa na warunki zabudowy, dojazd i media przy granicy, powierzchnia i kształt oraz sama lokalizacja. Dwie działki w tej samej miejscowości potrafią mieć bardzo różne ceny, dlatego liczby z okolicy traktuj jako punkt wyjścia, a nie gotową cenę.',
  },
  {
    question: 'Gdzie znajdę obręb i numer działki?',
    answer:
      'W akcie notarialnym, w wypisie z ewidencji gruntów i w księdze wieczystej. Obręb bywa nazwą (na przykład Domiechowice) albo numerem (na przykład 0008). Możesz też wkleić cały identyfikator działki w formacie 100102_2.0006.100. Gdy numeru nie masz pod ręką, wskaż działkę na mapie z granicami.',
  },
  {
    question: 'Jak wystawić działkę na sprzedaż?',
    answer:
      'Pod wynikiem kliknij „Wystaw działkę za darmo". Formularz otworzy się z już wskazaną działką, a powierzchnię, plan miejscowy i zdjęcie z lotu ptaka uzupełnimy z ewidencji. Dopisujesz cenę i telefon. Wystawienie jest bezpłatne, a konto zakładasz dopiero przy publikacji.',
  },
  {
    question: 'Czy to kosztuje?',
    answer: 'Nie. Sprawdzisz dowolną liczbę działek za darmo i bez zakładania konta.',
  },
];

export default function WycenaDzialkiPage() {
  return (
    <main className="relative w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <WycenaDzialki />

      <section className="mt-10 border-t border-fg/10">
        <div className="mx-auto max-w-6xl px-6 py-14 md:px-10 md:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Jak to działa</h2>
          <div className="mt-8 grid gap-x-12 gap-y-7 md:grid-cols-3">
            {KROKI.map((krok) => (
              <div key={krok.nr} className="border-t border-fg/12 pt-5">
                <div className="text-[13px] font-semibold tracking-[0.18em] text-brand-text">{krok.nr}</div>
                <h3 className="mt-2 text-[17px] font-semibold text-fg md:text-[19px]">{krok.title}</h3>
                <p className="mt-1 text-[14px] leading-7 text-fg/62 md:text-[15px]">{krok.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FaqSection items={FAQ} green wide />

      <div className="h-16" />
    </main>
  );
}
