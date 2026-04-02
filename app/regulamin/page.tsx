import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Regulamin | TylkoDziałki',
  description: 'Regulamin serwisu TylkoDziałki.',
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2>
      <div className="space-y-4 text-[15px] leading-8 text-white/72">{children}</div>
    </section>
  );
}

export default function RegulaminPage() {
  return (
    <main className="min-h-screen bg-[#131313] text-white">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mb-12 space-y-5 border-b border-white/10 pb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
            Dokument prawny
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Regulamin serwisu TylkoDziałki
          </h1>

          <p className="max-w-3xl text-[15px] leading-8 text-white/65">
            Niniejszy regulamin określa zasady korzystania z serwisu internetowego
            TylkoDziałki, w szczególności zasady tworzenia kont, publikowania ogłoszeń,
            korzystania z usług płatnych oraz zasady odpowiedzialności użytkowników i
            operatora serwisu.
          </p>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/70">
            <p>
              <span className="text-white">Operator serwisu:</span> Ultima Reality Sp. z o.o.
            </p>
            <p>
              <span className="text-white">Adres siedziby:</span> Łódź, 90-265, Piotrkowska 44/10
            </p>
            <p>
              <span className="text-white">NIP:</span> 7252337429
            </p>
            <p>
              <span className="text-white">KRS:</span> 0001068696
            </p>
            <p>
              <span className="text-white">E-mail kontaktowy:</span>{' '}
              <a
                href="mailto:kontakt@tylkodzialki.pl"
                className="text-[#7aa333] transition hover:opacity-80"
              >
                kontakt@tylkodzialki.pl
              </a>
            </p>
          </div>
        </div>

        <div className="mb-12 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/65 sm:grid-cols-2">
          <Link href="#postanowienia-ogolne" className="transition hover:text-white">
            §1. Postanowienia ogólne
          </Link>
          <Link href="#definicje" className="transition hover:text-white">
            §2. Definicje
          </Link>
          <Link href="#konto" className="transition hover:text-white">
            §3. Konto użytkownika
          </Link>
          <Link href="#ogloszenia" className="transition hover:text-white">
            §4. Zasady publikacji ogłoszeń
          </Link>
          <Link href="#uslugi-platne" className="transition hover:text-white">
            §5. Usługi płatne
          </Link>
          <Link href="#odstapienie" className="transition hover:text-white">
            §6. Odstąpienie od umowy i zwroty
          </Link>
          <Link href="#reklamacje" className="transition hover:text-white">
            §7. Reklamacje
          </Link>
          <Link href="#odpowiedzialnosc" className="transition hover:text-white">
            §8. Odpowiedzialność
          </Link>
          <Link href="#dane" className="transition hover:text-white">
            §9. Dane i kontakt
          </Link>
          <Link href="#postanowienia-koncowe" className="transition hover:text-white">
            §10. Postanowienia końcowe
          </Link>
        </div>

        <div className="space-y-12">
          <Section id="postanowienia-ogolne" title="§1. Postanowienia ogólne">
            <p>
              1. Serwis internetowy TylkoDziałki jest platformą ogłoszeniową przeznaczoną do
              publikowania i przeglądania ogłoszeń dotyczących nieruchomości gruntowych.
            </p>
            <p>
              2. Właścicielem i operatorem serwisu jest Ultima Reality Sp. z o.o. z siedzibą
              w Łodzi, 90-265, przy ul. Piotrkowskiej 44/10, wpisana do Krajowego Rejestru
              Sądowego pod numerem KRS 0001068696, NIP 7252337429.
            </p>
            <p>
              3. Regulamin określa zasady korzystania z serwisu, warunki świadczenia usług
              drogą elektroniczną, zasady zawierania umów na odległość oraz zasady korzystania
              z usług płatnych.
            </p>
            <p>
              4. Użytkownik, korzystając z serwisu, zobowiązuje się do przestrzegania
              regulaminu oraz obowiązujących przepisów prawa.
            </p>
          </Section>

          <Section id="definicje" title="§2. Definicje">
            <p>1. Serwis – serwis internetowy TylkoDziałki.</p>
            <p>2. Operator – Ultima Reality Sp. z o.o.</p>
            <p>
              3. Użytkownik – osoba fizyczna, osoba prawna lub jednostka organizacyjna
              korzystająca z serwisu.
            </p>
            <p>
              4. Konto – indywidualny panel użytkownika umożliwiający korzystanie z funkcji
              serwisu.
            </p>
            <p>5. Ogłoszenie – oferta dotycząca działki opublikowana w serwisie przez użytkownika.</p>
            <p>
              6. Usługi płatne – usługi odpłatne oferowane w serwisie, w szczególności
              publikacja ogłoszeń i wyróżnienia ogłoszeń.
            </p>
            <p>
              7. Pakiet – przyznany użytkownikowi limit publikacji lub wyróżnień do
              wykorzystania w serwisie.
            </p>
          </Section>

          <Section id="konto" title="§3. Konto użytkownika">
            <p>
              1. Założenie konta może być wymagane do korzystania z pełnej funkcjonalności
              serwisu.
            </p>
            <p>
              2. Użytkownik zobowiązany jest do podania danych prawdziwych, aktualnych i
              niewprowadzających w błąd.
            </p>
            <p>
              3. Użytkownik odpowiada za bezpieczeństwo dostępu do swojego konta oraz za
              działania podejmowane z jego użyciem.
            </p>
            <p>
              4. Operator może czasowo zablokować konto lub ograniczyć dostęp do wybranych
              funkcji w przypadku naruszenia regulaminu lub podejrzenia działań niezgodnych z
              prawem.
            </p>
          </Section>

          <Section id="ogloszenia" title="§4. Zasady publikacji ogłoszeń">
            <p>1. W serwisie mogą być publikowane wyłącznie ogłoszenia dotyczące działek.</p>
            <p>
              2. Zabronione jest publikowanie treści:
              <br />a) niezgodnych z prawem,
              <br />b) naruszających prawa osób trzecich,
              <br />c) nieprawdziwych lub mogących wprowadzać w błąd,
              <br />d) niezwiązanych z tematyką serwisu,
              <br />e) o charakterze spamowym, obraźliwym albo reklamującym inne serwisy w sposób
              sprzeczny z celem platformy.
            </p>
            <p>
              3. Użytkownik ponosi pełną odpowiedzialność za treść ogłoszenia, w tym za jej
              zgodność z prawem i stanem faktycznym.
            </p>
            <p>
              4. Operator ma prawo odmówić publikacji, usunąć ogłoszenie albo zakończyć jego
              emisję, jeżeli treść ogłoszenia narusza regulamin, przepisy prawa lub interes
              serwisu.
            </p>
            <p>
              5. Usunięcie lub blokada ogłoszenia z przyczyn leżących po stronie użytkownika nie
              stanowi podstawy do zwrotu środków.
            </p>
          </Section>

          <Section id="uslugi-platne" title="§5. Usługi płatne">
            <p>
              1. Serwis może oferować usługi płatne, w szczególności publikację ogłoszeń oraz
              wyróżnianie ogłoszeń.
            </p>
            <p>2. Płatności są realizowane za pośrednictwem zewnętrznego operatora płatności Stripe.</p>
            <p>
              3. Szczegółowe ceny usług płatnych są prezentowane w serwisie przed złożeniem
              zamówienia.
            </p>
            <p>
              4. Zakupione pakiety publikacji lub wyróżnień nie tracą ważności do momentu ich
              wykorzystania, chyba że wyraźnie wskazano inaczej w ofercie danego pakietu.
            </p>
            <p>
              5. Wykorzystanie pakietu następuje z chwilą skutecznego użycia danej usługi w
              serwisie, zgodnie z jej przeznaczeniem.
            </p>
          </Section>

          <Section id="odstapienie" title="§6. Odstąpienie od umowy i zwroty">
            <p>
              1. Konsument zawierający umowę na odległość może mieć prawo odstąpić od umowy w
              terminie 14 dni, chyba że w danym przypadku zastosowanie ma ustawowy wyjątek.
            </p>
            <p>
              2. W przypadku usług cyfrowych lub usług świadczonych drogą elektroniczną,
              rozpoczętych za wyraźną zgodą użytkownika przed upływem terminu do odstąpienia,
              prawo odstąpienia może nie przysługiwać w zakresie przewidzianym przez
              obowiązujące przepisy prawa.
            </p>
            <p>
              3. Jeżeli użytkownik wyrazi zgodę na rozpoczęcie świadczenia usługi przed upływem
              terminu do odstąpienia, a usługa zostanie rozpoczęta lub wykonana, zwrot środków
              może nie przysługiwać w przypadkach dopuszczonych przez obowiązujące przepisy.
            </p>
            <p>
              4. Postanowienia niniejszego paragrafu nie wyłączają prawa użytkownika do złożenia
              reklamacji w przypadku niewykonania lub nienależytego wykonania usługi przez
              operatora.
            </p>
          </Section>

          <Section id="reklamacje" title="§7. Reklamacje">
            <p>
              1. Użytkownik może zgłaszać reklamacje dotyczące działania serwisu lub usług
              świadczonych przez operatora.
            </p>
            <p>
              2. Reklamacje należy przesyłać na adres:{' '}
              <a
                href="mailto:kontakt@tylkodzialki.pl"
                className="text-[#7aa333] transition hover:opacity-80"
              >
                kontakt@tylkodzialki.pl
              </a>
              .
            </p>
            <p>
              3. Reklamacja powinna zawierać dane umożliwiające identyfikację użytkownika oraz
              opis zgłaszanych zastrzeżeń.
            </p>
            <p>
              4. Reklamacje są rozpatrywane bez zbędnej zwłoki, nie później niż w terminie 14 dni
              od dnia ich otrzymania.
            </p>
          </Section>

          <Section id="odpowiedzialnosc" title="§8. Odpowiedzialność">
            <p>
              1. Operator udostępnia serwis jako platformę techniczną służącą do publikacji
              ogłoszeń i nie jest stroną transakcji zawieranych pomiędzy użytkownikami.
            </p>
            <p>
              2. Operator nie gwarantuje zawarcia transakcji, zainteresowania ofertą ani
              osiągnięcia określonego rezultatu biznesowego przez użytkownika.
            </p>
            <p>
              3. Operator nie odpowiada za treść ogłoszeń publikowanych przez użytkowników ani za
              prawdziwość podanych przez nich informacji, z zastrzeżeniem obowiązków wynikających
              z prawa.
            </p>
            <p>
              4. Operator może prowadzić prace techniczne, aktualizacje i działania
              administracyjne niezbędne do utrzymania, rozwoju lub zabezpieczenia serwisu.
            </p>
          </Section>

          <Section id="dane" title="§9. Dane i kontakt">
            <p>
              1. Zasady przetwarzania danych osobowych określa Polityka prywatności dostępna w
              serwisie.
            </p>
            <p>
              2. Zasady wykorzystywania plików cookies określa Polityka cookies dostępna w
              serwisie.
            </p>
            <p>
              3. Kontakt z operatorem możliwy jest pod adresem:{' '}
              <a
                href="mailto:kontakt@tylkodzialki.pl"
                className="text-[#7aa333] transition hover:opacity-80"
              >
                kontakt@tylkodzialki.pl
              </a>
              .
            </p>
          </Section>

          <Section id="postanowienia-koncowe" title="§10. Postanowienia końcowe">
            <p>
              1. Operator zastrzega sobie prawo do zmiany regulaminu z ważnych przyczyn, w
              szczególności w razie zmiany przepisów prawa, rozwoju funkcjonalności serwisu lub
              zmiany modelu świadczenia usług.
            </p>
            <p>2. Nowa wersja regulaminu publikowana jest w serwisie wraz z datą wejścia w życie.</p>
            <p>3. W sprawach nieuregulowanych regulaminem zastosowanie mają przepisy prawa polskiego.</p>
            <p>4. Regulamin wchodzi w życie z dniem publikacji w serwisie.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}