import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import HomeHorizontalSlider from "@/components/HomeHorizontalSlider";
import ArticleCardCover from "@/components/ArticleCardCover";
import ArticleMeta from "@/components/ArticleMeta";
import KupSearch from "./kup/KupSearch";
import HeroCounter from "@/components/HeroCounter";
import HeroGradientBg from "@/components/HeroGradientBg";
import FeaturedRail from "@/components/FeaturedRail";
import CheckIcon from "@/components/CheckIcon";
import ScrollFill from "@/components/ScrollFill";
import type { OfferData } from "@/components/OfferCard";
import { SEO_REGIONS } from "@/lib/seo-locations";
import { getFeaturedListings } from "@/lib/dzialki";
import { getObnizkiCen } from "@/lib/dzialkaPriceHistory";
import { DEMO_MPZP, DEMO_PARCEL } from "@/components/sprawdz/demoRaport";
import { getPointValuation } from "@/lib/seoHub";
import { getRcnOkolica, rcnRozjechane } from "@/lib/rcnStats";
import { decydujCene, looksRolny } from "@/lib/raportCena";
import { formatIntPL } from "@/lib/format";
import { getPolandPriceBoard, type PolandPriceBoard } from "@/lib/cenyPolska";

// ISR zamiast force-dynamic: strona główna nie renderuje się od zera przy każdym
// wejściu (szybciej dla użytkownika i Googlebota). Licznik/wyróżnione świeże do 5 min.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "tylkodzialki.pl – szukaj, kupuj i sprzedawaj działki",
  description:
    "Portal ogłoszeń poświęcony wyłącznie działkom. Szukaj działek na sprzedaż, przeglądaj oferty i dodawaj własne ogłoszenia w całej Polsce.",
  alternates: {
    canonical: "/",
  },
};

const PAGE_BG = 'var(--bg)';

// P38 C1: skrót raportu na stronie głównej. Hasła, nie akapity — pełne odpowiedzi stoją na
// `/sprawdz-dzialke` i nie ma sensu ich tu dublować. Zadanie tej listy jest podwójne: czytający
// od razu wie, po co ma kliknąć, a strona główna zyskuje konkretne frazy (plan miejscowy,
// cena metra, ewidencja gruntów, księga wieczysta) zamiast samego zaproszenia.
const W_RAPORCIE: string[] = [
  'Czy plan miejscowy pozwala postawić tu dom',
  'Ile kosztuje metr działki w tej okolicy',
  'Ile realnie płacono u notariusza, gdy rejestr ma dane',
  'Dokładne granice, metraż i kształt z ewidencji gruntów',
  'Numer działki i obręb do wniosku w urzędzie',
  'Co sprawdzić samemu: klasa gruntu, media, dojazd, księga wieczysta',
];

// Kawałek PRAWDZIWEGO raportu obok zaproszenia. Sekcja opowiadała o narzędziu („w raporcie
// znajdziesz…"), a to zawsze wygląda jak obietnica. Konkretne liczby z konkretnej działki są
// dowodem: widać, że raport zwraca plan miejscowy i dwie ceny, zanim ktokolwiek kliknie.
// Dane rejestrowe są zamrożone (`demoRaport.ts`, ta sama działka co demo na `/sprawdz-dzialke`),
// ceny liczone tu i teraz z naszej bazy, więc karta nigdy nie pokazuje nieaktualnych kwot.
async function przykladRaportu() {
  try {
    const { lat, lng } = DEMO_PARCEL.center;
    const [wycena, rcn] = await Promise.all([
      getPointValuation(lat, lng, DEMO_PARCEL.areaM2, null, DEMO_PARCEL.id.slice(0, 6)),
      getRcnOkolica(lat, lng, looksRolny(DEMO_MPZP) ? 'rolna' : 'budowlana', {
        powierzchniaM2: DEMO_PARCEL.areaM2,
        gminaTeryt: DEMO_PARCEL.id.slice(0, 6),
      }),
    ]);
    // Te same reguły co w raporcie (próg próbki, bez mieszania rynków): karta to jego kawałek.
    const cena = decydujCene(wycena, DEMO_MPZP);
    return { ofertyZlM2: cena.value && !cena.mixed ? cena.value.median : null, rcn };
  } catch {
    // Karta jest dodatkiem; gdy baza nie odpowie, sekcja stoi dalej bez niej.
    return null;
  }
}

// Pula cen jest dodatkiem: gdy baza nie odpowie, sekcja lokalizacji stoi dalej bez cen.
async function cenyDoLokalizacji(): Promise<PolandPriceBoard | null> {
  try {
    return await getPolandPriceBoard();
  } catch {
    return null;
  }
}

function zlM2(v: number): string {
  return `${formatIntPL(v)} zł/m²`;
}

// Lokalizacje + ceny w jednej sekcji (2026-10-08). Szkielet 16 województw x miasta był tu od
// dawna, więc mediana dochodzi do istniejących kart zamiast osobnego modułu: zielona pigułka
// z ceną województwa w nagłówku karty i cena przy każdym mieście. Linki miast dalej prowadzą do
// ofert (huby), a cały cennik i ranking żyją na /ceny. Liczby z tego samego silnika co /ceny.
function PopularSearchesSection({ ceny }: { ceny: PolandPriceBoard | null }) {
  const regionMedian = new Map(
    (ceny?.regions ?? []).map((r) => [r.region.slug, r.detail.pricePerM2?.median ?? null])
  );
  const cityMedian = new Map(
    (ceny?.cities ?? []).map((c) => [c.city.slug, c.detail.pricePerM2?.median ?? null])
  );
  const national = ceny?.national.pricePerM2 ?? null;
  const stan = ceny
    ? new Intl.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(ceny.computedAt))
    : null;

  return (
    <section className="relative overflow-hidden bg-surface-2">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:46px_46px] opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.13),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.05),transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-brand-bright">
            Lokalizacje i ceny
          </div>

          <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-fg md:text-4xl">
            Działki budowlane i ich ceny w województwach
          </h2>

          {national && ceny ? (
            <p className="mt-4 max-w-3xl text-base leading-7 text-fg md:text-lg md:leading-8">
              Działka budowlana kosztuje w Polsce średnio{" "}
              <strong className="font-semibold text-brand-text">{zlM2(national.median)}</strong>{" "}
              <span className="text-fg/60">
                (mediana z {formatIntPL(ceny.national.count)} ofert, stan na {stan}).
              </span>
            </p>
          ) : null}

          <p className="mt-3 max-w-3xl text-sm leading-7 text-fg/70 md:text-base">
            Przy każdym mieście mediana zł/m² z aktywnych ofert w okolicy. Kliknij miasto, aby
            zobaczyć działki na sprzedaż.
          </p>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/ceny" className="text-fg/72 transition hover:text-fg">
              Ceny działek we wszystkich miastach →
            </Link>
          </div>
        </div>

        <div className="mt-10 [touch-action:pan-x_pan-y]">
          <HomeHorizontalSlider>
            {SEO_REGIONS.map((region, index) => {
              const regionCena = regionMedian.get(region.slug) ?? null;
              return (
              <article
                key={region.name}
                className="group relative min-w-[86%] snap-start overflow-hidden rounded-[32px] border border-brand/30 bg-brand/20 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur transition hover:border-brand/55 md:min-w-[380px] xl:min-w-[410px]"
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-fg/62">
                        Województwo
                      </div>

                      <h3 className="mt-2 break-words hyphens-auto text-2xl font-semibold tracking-tight text-fg">
                        {region.name}
                      </h3>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-surface text-[13px] font-semibold text-brand-bright">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>

                  {regionCena ? (
                    <Link
                      href="/ceny"
                      className="mt-4 inline-flex items-baseline gap-1.5 rounded-full border border-brand/30 bg-surface px-3.5 py-1.5 text-[13px] text-fg/60 transition hover:border-brand/55"
                    >
                      średnio
                      <span className="font-semibold text-brand-text">{zlM2(regionCena)}</span>
                    </Link>
                  ) : null}

                  <div className={`${regionCena ? "mt-5" : "mt-7"} grid gap-2`}>
                    {region.cities.map((city) => {
                      const cena = cityMedian.get(city.slug) ?? null;
                      return (
                        <Link
                          key={city.slug}
                          href={`/dzialki/${city.slug}/budowlane`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-brand/15 bg-surface/70 px-4 py-3 text-sm leading-5 text-fg/80 transition hover:border-brand/45 hover:bg-surface hover:text-fg"
                        >
                          {/* Na telefonie sama nazwa miasta (karta jest wąska, a nagłówek sekcji
                              mówi, że to działki budowlane); pełny tekst linku od tabletu wzwyż. */}
                          <span className="min-w-0">
                            <span className="hidden sm:inline">Działki budowlane </span>
                            {city.name}
                          </span>
                          {cena ? (
                            <span className="shrink-0 whitespace-nowrap text-[13px] text-fg/55">{zlM2(cena)}</span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </article>
              );
            })}
          </HomeHorizontalSlider>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const now = new Date();

  const activeWhere = {
    status: "AKTYWNE" as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  const [featuredListings, latestArticles, listingCount, przyklad, ceny] = await Promise.all([
    getFeaturedListings(8),
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
    }),
    prisma.dzialka.count({ where: activeWhere }),
    przykladRaportu(),
    cenyDoLokalizacji(),
  ]);

  // Mapujemy tylko bezpieczne pola (bez editToken/telefon itp.), bo lecą do
  // komponentu klienckiego FeaturedRail. Karta jest wspólna z /kup, więc dorzucamy
  // media (chipy) oraz sprzedawcę/logo (stopka), żeby wyróżnione wyglądały tak samo.
  const obnizki = await getObnizkiCen(featuredListings.map((d) => d.id));
  const featuredCards: OfferData[] = featuredListings.map((d) => ({
    id: d.id,
    obnizkaPct: obnizki.get(d.id) ?? null,
    tytul: d.tytul,
    cenaPln: d.cenaPln,
    powierzchniaM2: d.powierzchniaM2,
    transakcja: d.transakcja,
    locationLabel: d.locationLabel,
    przeznaczenia: d.przeznaczenia,
    zdjecia: (d.zdjecia ?? []).map((z) => ({ url: z.url, kolejnosc: z.kolejnosc })),
    isFeatured: d.isFeatured,
    featuredUntil: d.featuredUntil,
    prad: d.prad,
    woda: d.woda,
    kanalizacja: d.kanalizacja,
    gaz: d.gaz,
    sprzedajacyTyp: d.sprzedajacyTyp,
    biuroNazwa: d.biuroNazwa,
    biuroLogoUrl: d.biuroLogoUrl,
    owner: d.owner
      ? {
          defaultBiuroLogoUrl: d.owner.defaultBiuroLogoUrl,
          defaultBiuroLogoBg: d.owner.defaultBiuroLogoBg,
          defaultBiuroNazwa: d.owner.defaultBiuroNazwa,
          biuroPartnerStrategiczny: d.owner.biuroPartnerStrategiczny,
        }
      : null,
  }));

  const articleCards =
    latestArticles.length > 0
      ? [
          ...latestArticles,
          ...Array.from(
            { length: Math.max(0, 6 - latestArticles.length) },
            (_, i) => ({
              id: `placeholder-article-${i}`,
              slug: "#",
              title: "Nowy artykuł już wkrótce",
              excerpt:
                "Przygotowujemy kolejne poradniki o działkach, MPZP, wycenie i formalnościach.",
              imageUrl: null,
              createdAt: new Date(),
              isPlaceholder: true,
            })
          ),
        ]
      : Array.from({ length: 6 }, (_, i) => ({
          id: `placeholder-article-${i}`,
          slug: "#",
          title: "Nowy artykuł już wkrótce",
          excerpt:
            "Przygotowujemy kolejne poradniki o działkach, MPZP, wycenie i formalnościach.",
          imageUrl: null,
          createdAt: new Date(),
          isPlaceholder: true,
        }));

  return (
    <main
      className="relative w-full overflow-hidden"
      style={{ background: PAGE_BG }}
    >
      {/* Desktop: hero wyraźnie niższy niż ekran (70svh) — „Znajdź swoją działkę"
          siada wyżej, bliżej menu, a nagłówek „Wyróżnione oferty" i góra kart już
          zaglądają nad zgięciem (jak w dużych portalach: produkt widać od razu).
          Mobile: pełne 100svh zostaje (tam jest idealnie), zdejmujemy tylko kreskę
          dzielącą — na obu widokach przejście hero→oferty jest płynne. */}
      <section className="relative flex min-h-[100svh] w-full items-center overflow-hidden md:min-h-[40svh]">
        <HeroGradientBg />

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 py-16 text-center md:py-9">
          <h1 className="font-hero text-[38px] uppercase tracking-[0.06em] text-fg md:text-[52px] md:leading-none">
            Znajdź swoją działkę
          </h1>

          <HeroCounter target={listingCount} tone="onLight" />

          <div className="mt-6 w-full max-w-4xl">
            <KupSearch navigationMode={true} />
          </div>

          <div className="mt-6">
            <Link
              href="/sprzedaj"
              className="text-sm text-fg/70 transition hover:text-fg"
            >
              Sprzedajesz działkę?{" "}
              <span className="text-brand-bright underline decoration-1 underline-offset-4">
                Dodaj ogłoszenie
              </span>{" "}
              →
            </Link>
          </div>
        </div>
      </section>

      {featuredCards.length > 0 ? (
        <section className="relative overflow-hidden">
          {/* zielona „siateczka" — żeby sekcja nie była monolitem */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] opacity-35" />
          {/* poświata schowana na desktopie (md:hidden): przy krótkim hero sekcja
              siedzi tuż pod spotlightem hero i zielone poświaty by się dublowały.
              Na mobile hero jest pełnoekranowy, więc poświata zostaje. */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_20%,rgba(122,163,51,0.16),transparent_34%),radial-gradient(circle_at_85%_70%,rgba(47,94,70,0.05),transparent_32%)] md:hidden" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 pt-14 pb-14 md:px-10 md:pt-5 md:pb-16">
            <h2 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
              Wyróżnione oferty
            </h2>

            <div className="mt-6">
              <FeaturedRail items={featuredCards} />
            </div>

            <div className="mt-6 flex justify-center md:justify-start">
              <Link
                href="/kup"
                className="inline-flex text-sm text-fg/72 transition hover:text-fg"
              >
                Przeglądaj wszystkie oferty →
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* P38 C1: wejście do narzędzia „Sprawdź działkę". Wcześniej stało pod blogiem, czyli
          praktycznie nigdzie. Teraz zaraz po ofertach: kto nie znalazł działki u nas, ma tu drugi
          powód, żeby zostać, a kto już jakąś ogląda gdzie indziej, sprawdzi ją u nas.
          Jeden przycisk zamiast drugiego pola tekstowego (na górze stoi wyszukiwarka ofert i dwa
          pola na jednym ekranie myliłyby), a pod nim wprost, co jest w raporcie. */}
      <section className="relative overflow-hidden border-t border-fg/10 bg-surface-2">
        {/* Bez ScrollFill (próbowane 2026-09-02, cofnięte): wstająca zieleń przeciągała wzrok na
            tło i odbierała uwagę tekstowi, a to sekcja, która ma być czytana, nie oglądana. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(122,163,51,0.12),transparent_30%),radial-gradient(circle_at_86%_80%,rgba(47,94,70,0.05),transparent_32%)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
          {/* Dwie kolumny na dużym ekranie: po lewej obietnica, po prawej jej dowód. Na telefonie
              karta ląduje pod przyciskiem, żeby najpierw poszła treść, a nie przykład cudzej działki. */}
          <div className="grid gap-12 lg:grid-cols-[1fr_26rem] lg:items-start lg:gap-16">
            <div>
              {/* Etykieta w tym samym wzorcu co „Blog tylkodzialki.pl" nad Wiedzą o działkach:
                  bez niej sekcja stała naga na tle pozostałych. Nagłówek to nazwa narzędzia,
                  ta sama co w menu i we frazie, na którą chcemy wchodzić z Google. */}
              <div className="text-[12px] uppercase tracking-[0.16em] text-brand-bright">
                Narzędzie tylkodzialki.pl
              </div>

              <h2 className="mt-3 max-w-2xl text-[26px] font-semibold tracking-tight text-fg md:text-[38px] md:leading-[1.1]">
                Sprawdź działkę
              </h2>

              <div className="mt-8 grid gap-x-14 gap-y-4 sm:grid-cols-2 lg:grid-cols-1">
                {W_RAPORCIE.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckIcon className="mt-[3px] h-[18px] w-[18px]" />
                    <p className="text-[15px] leading-7 text-fg/75">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link
                  href="/sprawdz-dzialke"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-8 text-[12px] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-brand-bright"
                >
                  Sprawdź swoją działkę
                </Link>

                <p className="mt-3 text-sm text-fg/60">
                  Wpisujesz adres albo wskazujesz działkę na mapie. Za darmo i bez konta.
                </p>
              </div>
            </div>

            {/* DOWÓD: prawdziwa działka, prawdziwe liczby, jedno kliknięcie do pełnego raportu. */}
            {przyklad ? (
              // Bez ramki i cienia: ten sam język co raport na `/sprawdz-dzialke` (zielona
              // etykieta, duża liczba, cienkie linie), więc przykład wygląda jak kawałek
              // produktu, a nie jak wklejony kafelek.
              <div className="lg:border-l lg:border-fg/12 lg:pl-16 lg:pt-1">
                <div className="text-[12px] uppercase tracking-[0.2em] text-brand-text">
                  Przykładowa działka
                </div>

                <div className="mt-2 text-[26px] font-semibold tracking-tight text-fg md:text-[32px]">
                  {formatIntPL(DEMO_PARCEL.areaM2)} m² · {Math.round(DEMO_PARCEL.areaM2 / 100)} ar
                </div>
                <div className="mt-2 text-[15px] text-fg/60">
                  {[DEMO_PARCEL.commune, DEMO_PARCEL.county, DEMO_PARCEL.voivodeship]
                    .filter(Boolean)
                    .join(' · ')}
                </div>

                <dl className="mt-7 border-t border-fg/12">
                  {DEMO_MPZP?.functionName ? (
                    <div className="border-b border-fg/10 py-4">
                      <dt className="text-[12px] uppercase tracking-[0.12em] text-fg/45">
                        Plan miejscowy
                      </dt>
                      <dd className="mt-1.5 text-[15px] leading-6 text-fg/85">
                        {DEMO_MPZP.functionName}
                        {DEMO_MPZP.functionSymbol ? ` (${DEMO_MPZP.functionSymbol})` : ''}
                      </dd>
                    </div>
                  ) : null}

                  {przyklad.ofertyZlM2 ? (
                    <div className="border-b border-fg/10 py-4">
                      <dt className="text-[12px] uppercase tracking-[0.12em] text-fg/45">
                        Ceny z ogłoszeń w okolicy
                      </dt>
                      <dd className="mt-1.5 text-[15px] font-medium text-fg">
                        {formatIntPL(przyklad.ofertyZlM2)} zł/m²
                      </dd>
                    </div>
                  ) : null}

                  {przyklad.rcn ? (
                    <div className="border-b border-fg/10 py-4">
                      <dt className="text-[12px] uppercase tracking-[0.12em] text-fg/45">
                        Realnie zapłacono u notariusza
                      </dt>
                      <dd className="mt-1.5 text-[15px] font-medium text-brand-text">
                        {rcnRozjechane(przyklad.rcn)
                          ? `${formatIntPL(przyklad.rcn.low)}–${formatIntPL(przyklad.rcn.high)}`
                          : formatIntPL(przyklad.rcn.medianaZlM2)}{' '}
                        zł/m²
                        <span className="ml-2 text-[13px] font-normal text-fg/45">
                          z {przyklad.rcn.liczba} aktów
                        </span>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {/* Link prowadzi na samo narzędzie, bo ten sam przykład stoi tam pod wyszukiwarką.
                    Wersja z numerem działki w adresie odpytywała rejestr od nowa i przez chwilę
                    pokazywała to samo demo, więc kliknięcie wyglądało, jakby nic nie zrobiło. */}
                <Link
                  href="/sprawdz-dzialke"
                  className="mt-5 inline-flex text-sm text-fg/80 underline decoration-1 underline-offset-4 transition hover:text-fg"
                >
                  Zobacz cały przykładowy raport →
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Lokalizacje i ceny nad blogiem (wcześniej na samym dole): kupujący pyta o miejsce i
          cenę częściej niż o poradnik, a sekcja niesie linki do hubów miast i do /ceny. */}
      <PopularSearchesSection ceny={ceny} />

      <section className="relative overflow-hidden">
        <ScrollFill />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.16em] text-brand-bright">
                Blog tylkodzialki.pl
              </div>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
                Wiedza o działkach
              </h2>
            </div>
          </div>

          <div className="mt-10 touch-auto">
            <HomeHorizontalSlider>
              {articleCards.map((article: any) => {
                const href = article.isPlaceholder
                  ? "/blog"
                  : `/blog/${article.slug}`;

                return (
                  <Link
                    key={article.id}
                    href={href}
                    className="group flex min-w-[86%] flex-col snap-start md:min-w-[360px] xl:min-w-[380px]"
                  >
                    <article className="flex flex-1 flex-col overflow-hidden rounded-[28px] border border-fg/10 bg-bg transition hover:border-fg/20">
                      <ArticleCardCover
                        imageUrl={article.imageUrl}
                        title={article.title}
                      />

                      <div className="flex flex-1 flex-col p-5">
                        <ArticleMeta
                          category={article.category}
                          createdAt={article.createdAt}
                          readingTime={article.readingTime}
                        />

                        <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-fg">
                          {article.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm text-fg/72">
                          {article.excerpt}
                        </p>

                        <div className="mt-auto pt-4 text-sm font-semibold text-brand-bright">
                          Czytaj →
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </HomeHorizontalSlider>
          </div>

          <div className="mt-6 flex justify-center md:justify-start">
            <Link
              href="/blog"
              className="inline-flex text-sm text-fg/72 transition hover:text-fg"
            >
              Zobacz wszystkie artykuły →
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}