import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Polityka cookies | TylkoDziałki',
  description: 'Polityka cookies serwisu TylkoDziałki.',
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

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#131313] text-white">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mb-12 space-y-5 border-b border-white/10 pb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
            Dokument prawny
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Polityka cookies
          </h1>

          <p className="max-w-3xl text-[15px] leading-8 text-white/65">
            Niniejsza Polityka cookies wyjaśnia, czym są pliki cookies i podobne technologie,
            w jakim celu są stosowane w serwisie TylkoDziałki oraz w jaki sposób użytkownik
            może zarządzać swoimi preferencjami.
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
              <span className="text-white">Kontakt:</span>{' '}
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
          <Link href="#czym-sa-cookies" className="transition hover:text-white">
            §1. Czym są pliki cookies
          </Link>
          <Link href="#cele" className="transition hover:text-white">
            §2. Cele stosowania cookies
          </Link>
          <Link href="#rodzaje" className="transition hover:text-white">
            §3. Rodzaje cookies
          </Link>
          <Link href="#narzedzia-zewnetrzne" className="transition hover:text-white">
            §4. Narzędzia zewnętrzne
          </Link>
          <Link href="#zgoda" className="transition hover:text-white">
            §5. Zgoda na cookies
          </Link>
          <Link href="#zarzadzanie" className="transition hover:text-white">
            §6. Zarządzanie ustawieniami
          </Link>
          <Link href="#przegladarki" className="transition hover:text-white">
            §7. Ustawienia przeglądarki
          </Link>
          <Link href="#zmiany" className="transition hover:text-white">
            §8. Zmiany polityki cookies
          </Link>
        </div>

        <div className="space-y-12">
          <Section id="czym-sa-cookies" title="§1. Czym są pliki cookies">
            <p>
              1. Pliki cookies to niewielkie informacje tekstowe zapisywane na urządzeniu
              końcowym użytkownika podczas korzystania z serwisu.
            </p>
            <p>
              2. Cookies mogą być odczytywane przez system teleinformatyczny operatora lub
              przez podmioty trzecie, których narzędzia są używane w serwisie.
            </p>
            <p>
              3. Serwis może stosować również technologie podobne do cookies, w szczególności
              identyfikatory sesji, pamięć lokalną przeglądarki lub znaczniki techniczne,
              jeżeli są wykorzystywane do zapewnienia prawidłowego działania strony.
            </p>
          </Section>

          <Section id="cele" title="§2. Cele stosowania cookies">
            <p>1. Cookies mogą być wykorzystywane w następujących celach:</p>
            <p>
              a) zapewnienie prawidłowego działania serwisu,
              <br />
              b) utrzymanie sesji użytkownika po zalogowaniu,
              <br />
              c) zapamiętywanie ustawień interfejsu i preferencji użytkownika,
              <br />
              d) zapewnienie bezpieczeństwa serwisu,
              <br />
              e) prowadzenie statystyk i analiz ruchu,
              <br />
              f) mierzenie skuteczności działań marketingowych,
              <br />
              g) dopasowanie treści, funkcji lub reklam — jeżeli takie rozwiązania są stosowane.
            </p>
          </Section>

          <Section id="rodzaje" title="§3. Rodzaje cookies">
            <p>1. W serwisie mogą być stosowane następujące rodzaje cookies:</p>

            <p>
              <span className="text-white">Cookies niezbędne</span>
              <br />
              Są konieczne do prawidłowego działania strony i podstawowych funkcji serwisu,
              takich jak logowanie, utrzymanie sesji, bezpieczeństwo czy poprawne wyświetlanie
              treści.
            </p>

            <p>
              <span className="text-white">Cookies funkcjonalne</span>
              <br />
              Umożliwiają zapamiętanie wybranych ustawień użytkownika i poprawiają wygodę
              korzystania z serwisu.
            </p>

            <p>
              <span className="text-white">Cookies analityczne</span>
              <br />
              Służą do tworzenia statystyk, analizy sposobu korzystania z serwisu oraz
              ulepszania jego funkcjonalności.
            </p>

            <p>
              <span className="text-white">Cookies marketingowe</span>
              <br />
              Mogą być wykorzystywane do mierzenia skuteczności kampanii, remarketingu lub
              dopasowania komunikatów reklamowych — jeśli takie narzędzia są wdrożone.
            </p>

            <p>
              2. Część cookies może być sesyjna, czyli usuwana po zakończeniu sesji
              przeglądarki, a część może mieć charakter trwały i pozostawać na urządzeniu
              użytkownika przez określony czas lub do momentu ich usunięcia.
            </p>
          </Section>

          <Section id="narzedzia-zewnetrzne" title="§4. Narzędzia zewnętrzne">
            <p>
              1. Serwis może korzystać z narzędzi lub usług podmiotów trzecich, które zapisują
              lub odczytują cookies albo podobne identyfikatory.
            </p>
            <p>2. Mogą to być w szczególności narzędzia związane z:</p>
            <p>
              a) analityką ruchu,
              <br />
              b) bezpieczeństwem i wydajnością strony,
              <br />
              c) logowaniem i autoryzacją,
              <br />
              d) płatnościami online,
              <br />
              e) osadzaniem treści zewnętrznych,
              <br />
              f) marketingiem i kampaniami reklamowymi.
            </p>
            <p>
              3. Jeżeli w serwisie zostaną wdrożone konkretne narzędzia analityczne lub
              marketingowe, polityka cookies może zostać rozszerzona o ich szczegółowy opis.
            </p>
          </Section>

          <Section id="zgoda" title="§5. Zgoda na cookies">
            <p>
              1. Cookies niezbędne mogą być stosowane bez odrębnej zgody użytkownika, o ile są
              wymagane do prawidłowego świadczenia usługi drogą elektroniczną lub działania
              serwisu.
            </p>
            <p>
              2. Cookies analityczne, marketingowe i inne niekonieczne powinny być stosowane po
              uzyskaniu odpowiedniej zgody użytkownika, jeżeli jest ona wymagana przez przepisy.
            </p>
            <p>
              3. Użytkownik może w każdej chwili zmienić swoje preferencje dotyczące cookies,
              w tym wycofać wcześniej udzieloną zgody dla kategorii nieobowiązkowych.
            </p>
          </Section>

          <Section id="zarzadzanie" title="§6. Zarządzanie ustawieniami cookies">
            <p>
              1. Użytkownik może zarządzać cookies za pomocą ustawień przeglądarki internetowej
              lub — jeżeli serwis wdroży odpowiedni mechanizm — za pomocą banera lub panelu
              ustawień cookies.
            </p>
            <p>
              2. Ograniczenie stosowania cookies może wpływać na niektóre funkcjonalności
              dostępne w serwisie, w szczególności te wymagające utrzymania sesji lub
              zapamiętania ustawień użytkownika.
            </p>
          </Section>

          <Section id="przegladarki" title="§7. Ustawienia przeglądarki">
            <p>
              1. Większość przeglądarek internetowych domyślnie dopuszcza zapisywanie cookies
              na urządzeniu użytkownika.
            </p>
            <p>
              2. Użytkownik może samodzielnie zmienić ustawienia przeglądarki tak, aby
              blokować cookies w całości, częściowo albo każdorazowo otrzymywać informację
              o próbie ich zapisania.
            </p>
            <p>
              3. Szczegółowe informacje na temat konfiguracji ustawień można znaleźć w pomocy
              technicznej używanej przeglądarki.
            </p>
          </Section>

          <Section id="zmiany" title="§8. Zmiany polityki cookies">
            <p>
              1. Operator zastrzega sobie prawo do zmiany niniejszej Polityki cookies,
              w szczególności w przypadku zmian technologicznych, zmian przepisów prawa
              lub wdrożenia nowych narzędzi w serwisie.
            </p>
            <p>2. Aktualna wersja Polityki cookies jest publikowana w serwisie.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}