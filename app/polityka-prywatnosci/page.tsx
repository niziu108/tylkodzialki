import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Polityka prywatności | TylkoDziałki',
  description: 'Polityka prywatności serwisu TylkoDziałki.',
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

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#131313] text-white">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mb-12 space-y-5 border-b border-white/10 pb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7aa333]">
            Dokument prawny
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Polityka prywatności
          </h1>

          <p className="max-w-3xl text-[15px] leading-8 text-white/65">
            Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych
            użytkowników serwisu TylkoDziałki, w tym osób odwiedzających stronę, zakładających
            konto, publikujących ogłoszenia, kontaktujących się z operatorem oraz korzystających
            z usług płatnych.
          </p>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/70">
            <p>
              <span className="text-white">Administrator danych:</span> Ultima Reality Sp. z o.o.
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
          <Link href="#administrator" className="transition hover:text-white">
            §1. Administrator danych
          </Link>
          <Link href="#zakres" className="transition hover:text-white">
            §2. Zakres przetwarzanych danych
          </Link>
          <Link href="#cele" className="transition hover:text-white">
            §3. Cele i podstawy prawne
          </Link>
          <Link href="#odbiorcy" className="transition hover:text-white">
            §4. Odbiorcy danych
          </Link>
          <Link href="#okres" className="transition hover:text-white">
            §5. Okres przechowywania danych
          </Link>
          <Link href="#prawa" className="transition hover:text-white">
            §6. Prawa użytkownika
          </Link>
          <Link href="#dobrowolnosc" className="transition hover:text-white">
            §7. Dobrowolność podania danych
          </Link>
          <Link href="#bezpieczenstwo" className="transition hover:text-white">
            §8. Bezpieczeństwo danych
          </Link>
          <Link href="#kontakt" className="transition hover:text-white">
            §9. Kontakt w sprawach danych
          </Link>
          <Link href="#zmiany" className="transition hover:text-white">
            §10. Zmiany polityki prywatności
          </Link>
        </div>

        <div className="space-y-12">
          <Section id="administrator" title="§1. Administrator danych">
            <p>
              1. Administratorem danych osobowych jest Ultima Reality Sp. z o.o. z siedzibą
              w Łodzi, 90-265, przy ul. Piotrkowskiej 44/10, KRS 0001068696, NIP 7252337429.
            </p>
            <p>
              2. W sprawach dotyczących przetwarzania danych osobowych można kontaktować się
              z administratorem pod adresem e-mail:{' '}
              <a
                href="mailto:kontakt@tylkodzialki.pl"
                className="text-[#7aa333] transition hover:opacity-80"
              >
                kontakt@tylkodzialki.pl
              </a>
              .
            </p>
          </Section>

          <Section id="zakres" title="§2. Zakres przetwarzanych danych">
            <p>1. Administrator może przetwarzać w szczególności następujące dane:</p>
            <p>
              a) dane identyfikacyjne i kontaktowe, w tym imię, nazwisko, adres e-mail,
              numer telefonu,
              <br />
              b) dane związane z kontem użytkownika,
              <br />
              c) dane zawarte w ogłoszeniach,
              <br />
              d) dane rozliczeniowe i dane do faktury,
              <br />
              e) dane związane z płatnościami,
              <br />
              f) dane techniczne, takie jak adres IP, identyfikatory sesji, dane urządzenia,
              dane przeglądarki i aktywności w serwisie,
              <br />
              g) dane przekazane w korespondencji kierowanej do administratora.
            </p>
          </Section>

          <Section id="cele" title="§3. Cele i podstawy prawne przetwarzania">
            <p>1. Dane osobowe mogą być przetwarzane w celu:</p>
            <p>
              a) założenia i obsługi konta użytkownika,
              <br />
              b) umożliwienia publikacji, edycji i zarządzania ogłoszeniami,
              <br />
              c) realizacji usług płatnych, w tym obsługi płatności i rozliczeń,
              <br />
              d) wystawiania dokumentów księgowych,
              <br />
              e) kontaktu z użytkownikiem, w tym obsługi zgłoszeń, reklamacji i pytań,
              <br />
              f) zapewnienia bezpieczeństwa serwisu i zapobiegania nadużyciom,
              <br />
              g) dochodzenia roszczeń lub obrony przed roszczeniami,
              <br />
              h) prowadzenia analiz statystycznych i rozwoju serwisu,
              <br />
              i) realizacji obowiązków wynikających z przepisów prawa.
            </p>
            <p>
              2. Podstawą przetwarzania danych jest w szczególności:
              <br />
              a) niezbędność do wykonania umowy lub podjęcia działań przed jej zawarciem,
              <br />
              b) realizacja obowiązków prawnych ciążących na administratorze,
              <br />
              c) prawnie uzasadniony interes administratora,
              <br />
              d) zgoda użytkownika — jeżeli jest wymagana w konkretnym przypadku.
            </p>
          </Section>

          <Section id="odbiorcy" title="§4. Odbiorcy danych">
            <p>1. Dane osobowe mogą być przekazywane podmiotom współpracującym z administratorem, jeżeli jest to niezbędne do działania serwisu.</p>
            <p>2. Odbiorcami danych mogą być w szczególności:</p>
            <p>
              a) dostawcy hostingu i infrastruktury technicznej,
              <br />
              b) dostawcy usług uwierzytelniania i logowania,
              <br />
              c) operator płatności Stripe,
              <br />
              d) dostawcy usług pocztowych i wysyłki wiadomości e-mail,
              <br />
              e) dostawcy usług przechowywania i obsługi zdjęć, w tym Cloudinary,
              <br />
              f) dostawcy narzędzi analitycznych i bezpieczeństwa,
              <br />
              g) podmioty świadczące obsługę księgową, prawną, informatyczną lub administracyjną.
            </p>
            <p>
              3. Dane mogą być przekazywane poza Europejski Obszar Gospodarczy wyłącznie wtedy,
              gdy będzie to zgodne z obowiązującymi przepisami prawa i z zastosowaniem
              odpowiednich zabezpieczeń.
            </p>
          </Section>

          <Section id="okres" title="§5. Okres przechowywania danych">
            <p>
              1. Dane osobowe są przechowywane przez okres niezbędny do realizacji celu, w jakim
              zostały zebrane.
            </p>
            <p>
              2. Dane związane z kontem użytkownika są przechowywane co do zasady przez okres
              utrzymywania konta, a po jego zakończeniu przez okres niezbędny do rozliczeń,
              obrony przed roszczeniami, dochodzenia roszczeń oraz realizacji obowiązków
              wynikających z prawa.
            </p>
            <p>
              3. Dane rozliczeniowe i księgowe mogą być przechowywane przez okres wymagany
              przepisami prawa podatkowego i rachunkowego.
            </p>
            <p>
              4. Dane przetwarzane na podstawie zgody są przechowywane do czasu jej wycofania,
              chyba że wcześniej odpadnie cel ich przetwarzania.
            </p>
          </Section>

          <Section id="prawa" title="§6. Prawa użytkownika">
            <p>
              1. Osobie, której dane dotyczą, przysługuje prawo:
              <br />
              a) dostępu do danych,
              <br />
              b) sprostowania danych,
              <br />
              c) usunięcia danych,
              <br />
              d) ograniczenia przetwarzania,
              <br />
              e) przenoszenia danych — w przypadkach przewidzianych prawem,
              <br />
              f) wniesienia sprzeciwu wobec przetwarzania danych — w przypadkach przewidzianych prawem,
              <br />
              g) cofnięcia zgody w dowolnym momencie, jeżeli przetwarzanie odbywa się na podstawie zgody.
            </p>
            <p>
              2. Użytkownik ma również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych
              Osobowych, jeżeli uzna, że jego dane są przetwarzane niezgodnie z prawem.
            </p>
          </Section>

          <Section id="dobrowolnosc" title="§7. Dobrowolność podania danych">
            <p>
              1. Podanie danych osobowych jest co do zasady dobrowolne, ale w wielu przypadkach
              niezbędne do założenia konta, publikacji ogłoszenia, skorzystania z usług
              płatnych, otrzymania faktury albo kontaktu z administratorem.
            </p>
            <p>
              2. Niepodanie danych wymaganych do realizacji danej usługi może skutkować brakiem
              możliwości skorzystania z wybranych funkcjonalności serwisu.
            </p>
          </Section>

          <Section id="bezpieczenstwo" title="§8. Bezpieczeństwo danych">
            <p>
              1. Administrator stosuje odpowiednie środki techniczne i organizacyjne mające na
              celu ochronę danych osobowych przed ich utratą, zniszczeniem, nieuprawnionym
              ujawnieniem lub dostępem osób nieuprawnionych.
            </p>
            <p>
              2. Dostęp do danych mają wyłącznie osoby i podmioty upoważnione, w zakresie
              niezbędnym do realizacji celów przetwarzania.
            </p>
          </Section>

          <Section id="kontakt" title="§9. Kontakt w sprawach danych osobowych">
            <p>
              W sprawach dotyczących danych osobowych, realizacji praw użytkownika lub pytań
              związanych z niniejszą polityką prywatności można kontaktować się z administratorem
              pod adresem:{' '}
              <a
                href="mailto:kontakt@tylkodzialki.pl"
                className="text-[#7aa333] transition hover:opacity-80"
              >
                kontakt@tylkodzialki.pl
              </a>
              .
            </p>
          </Section>

          <Section id="zmiany" title="§10. Zmiany polityki prywatności">
            <p>
              1. Administrator zastrzega sobie prawo do zmiany niniejszej Polityki prywatności,
              w szczególności w przypadku zmian przepisów prawa, zmian technologicznych,
              rozwoju funkcjonalności serwisu lub zmiany sposobu świadczenia usług.
            </p>
            <p>
              2. Aktualna wersja Polityki prywatności jest publikowana w serwisie.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}