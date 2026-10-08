import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import FaqSection from '@/components/FaqSection';
import type { FaqItem } from '@/lib/seoCategoryContent';
import { MIN_OFERT_DO_CENY, type CategoryDetail } from '@/lib/seoHub';
import { getPolandPriceBoard, PRICE_KEY_POLSKA, regionPriceKey } from '@/lib/cenyPolska';
import { getMonthAgoMedians } from '@/lib/cityPriceStats';
import { formatIntPL, formatPLN } from '@/lib/format';

export const revalidate = 3600;

// Próg pokazania miasta na liście linków: spójny z progiem mediany (MIN_SAMPLE = 4).
const MIN_OFFERS = 4;
// Ranking najdroższych/najtańszych tylko z miast, gdzie mediana stoi na pewnej próbce.
const RANK_SIZE = 10;
// Zmianę m/m pokazujemy dopiero przy tej próbce (dziś i miesiąc temu). Przy kilkunastu ofertach
// mediana skacze od samego składu podaży (nowe biuro, wygaszone oferty), nie od zmiany cen.
const MIN_TREND_SAMPLE = 30;

function zlM2(v: number): string {
  return `${formatIntPL(v)} zł/m²`;
}

function dateDots(d: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

// „Mazowieckie" -> „mazowieckim" (miejscownik po „w województwie"); wszystkie nazwy kończą się na -ie.
function wojLoc(name: string): string {
  return name.toLowerCase().replace(/ie$/, 'im');
}

function ofert(n: number): string {
  if (n === 1) return 'oferta';
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'oferty' : 'ofert';
}

function pct(change: number): string {
  const v = Math.round(change * 1000) / 10;
  const abs = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(Math.abs(v));
  if (v === 0) return '0%';
  return `${v > 0 ? '+' : '−'}${abs}%`;
}

type MonthAgo = Awaited<ReturnType<typeof getMonthAgoMedians>>;

// Zmiana m/m: dzisiejsza mediana (ta sama, którą pokazujemy) do snapshotu sprzed ~30 dni.
function changeOf(monthAgo: MonthAgo, key: string, detail: CategoryDetail): number | null {
  const past = monthAgo.get(key);
  const now = detail.pricePerM2?.median;
  if (!past || !now || past.median <= 0) return null;
  if (past.sampleCount < MIN_TREND_SAMPLE || detail.count < MIN_TREND_SAMPLE) return null;
  return (now - past.median) / past.median;
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-fg/30">b.d.</span>;
  return (
    <span className={value > 0 ? 'text-brand-text' : value < 0 ? 'text-fg/70' : 'text-fg/45'}>
      {pct(value)}
    </span>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { national } = await getPolandPriceBoard();
  const median = national.pricePerM2?.median;
  return {
    title: median
      ? `Ceny działek budowlanych w Polsce: ${zlM2(median)} (mediana z ofert)`
      : 'Ceny działek w Polsce: ile kosztują wg miasta (zł/m²)',
    description: median
      ? `Działka budowlana w ofertach kosztuje w Polsce średnio ${zlM2(median)} (mediana z ${formatIntPL(national.count)} aktywnych ofert). Ceny wg województw i miast, liczone na bieżąco z ogłoszeń.`
      : 'Aktualne ceny działek budowlanych wg miasta, liczone na bieżąco z ofert: mediana zł/m², zakres stawek i powierzchnie.',
    alternates: { canonical: '/ceny' },
  };
}

export default async function CenyIndexPage() {
  const [board, monthAgo] = await Promise.all([getPolandPriceBoard(), getMonthAgoMedians()]);
  const now = new Date(board.computedAt);
  const stan = dateDots(now);
  const year = now.getFullYear();

  const national = board.national;
  const nationalPrice = national.pricePerM2;
  const nationalChange = changeOf(monthAgo, PRICE_KEY_POLSKA, national);

  // Województwa z medianą, od najdroższego. Bez mediany (za mała próbka) idą na koniec.
  const regions = board.regions
    .map((r) => ({ ...r, change: changeOf(monthAgo, regionPriceKey(r.region.slug), r.detail) }))
    .sort(
      (a, b) => (b.detail.pricePerM2?.median ?? -1) - (a.detail.pricePerM2?.median ?? -1)
    );
  const anyRegionChange = regions.some((r) => r.change !== null);
  // Dwie kolumny po 8 na komputerze (jak listy miast niżej), jedna lista na telefonie.
  const half = Math.ceil(regions.length / 2);
  const regionColumns = [regions.slice(0, half), regions.slice(half)];

  // Ranking miast: tylko pewna próbka (ten sam próg co wycena punktowa).
  const ranked = board.cities
    .filter((c) => c.detail.pricePerM2 && c.detail.count >= MIN_OFERT_DO_CENY)
    .map((c) => ({ ...c, median: c.detail.pricePerM2!.median }))
    .sort((a, b) => b.median - a.median);
  const top = ranked.slice(0, RANK_SIZE);
  const bottom = ranked.slice(Math.max(RANK_SIZE, ranked.length - RANK_SIZE)).reverse();

  // Lista linków do miast wg województwa (jak dotąd), z medianą przy nazwie.
  const regionsWithCities = board.regions
    .map(({ region }) => ({
      region,
      cities: board.cities
        .filter((c) => c.region.slug === region.slug && c.detail.count >= MIN_OFFERS)
        .sort((a, b) => b.detail.count - a.detail.count),
    }))
    .filter((r) => r.cities.length > 0);

  const pricedRegions = regions.filter((r) => r.detail.pricePerM2);
  const priciest = pricedRegions[0];
  const cheapest = pricedRegions[pricedRegions.length - 1];

  const faq: FaqItem[] = nationalPrice
    ? [
        {
          question: `Ile kosztuje działka budowlana w ${year} roku?`,
          answer: `W aktywnych ofertach działka budowlana kosztuje w Polsce średnio ${zlM2(nationalPrice.median)} (mediana z ${formatIntPL(national.count)} ofert, stan na ${stan}). Typowo stawki mieszczą się między ${zlM2(nationalPrice.low)} a ${zlM2(nationalPrice.high)}${national.totalPrice ? `, a cała działka kosztuje zwykle od ${formatPLN(national.totalPrice.low)} do ${formatPLN(national.totalPrice.high)}` : ''}. Cena mocno zależy od regionu i odległości od dużego miasta.`,
        },
        ...(priciest && cheapest && priciest !== cheapest
          ? [
              {
                question: 'W którym województwie działki budowlane są najdroższe, a w którym najtańsze?',
                answer: `Najdroższe są w województwie ${wojLoc(priciest.region.name)} (mediana ${zlM2(priciest.detail.pricePerM2!.median)}), najtańsze w województwie ${wojLoc(cheapest.region.name)} (${zlM2(cheapest.detail.pricePerM2!.median)}).${top[0] ? ` Spośród miast najwyżej wypada okolica ${top[0].city.gen} (${zlM2(top[0].median)}).` : ''}`,
              },
            ]
          : []),
        {
          question: 'Czy to ceny transakcyjne?',
          answer:
            'Nie. To ceny ofertowe, czyli stawki z aktywnych ogłoszeń, za które sprzedający chcą sprzedać działkę. Ceny, za które działki faktycznie się sprzedały, pochodzą z Rejestru Cen Nieruchomości i pokazujemy je przy konkretnej działce w narzędziu Sprawdź działkę.',
        },
        {
          question: 'Jak liczycie cenę dla województwa i dla miasta?',
          answer:
            'Bierzemy medianę ceny za metr kwadratowy wszystkich aktywnych ofert działek budowlanych z ceną i powierzchnią. Województwo liczymy z ofert położonych w jego granicach, a miasto z ofert w okolicy do ok. 40 km, więc sąsiednie miasta mogą dzielić część ofert. Mediana jest odporna na pojedyncze skrajne ogłoszenia.',
        },
      ]
    : [];

  const dataset = nationalPrice
    ? {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'Ceny działek budowlanych w Polsce wg województw',
        description: `Mediana ceny ofertowej (zł/m²) działek budowlanych na sprzedaż w Polsce i w 16 województwach, liczona z aktywnych ofert serwisu tylkodzialki.pl. Ceny ofertowe, nie transakcyjne. Stan na ${stan}.`,
        creator: { '@type': 'Organization', name: 'tylkodzialki.pl' },
        spatialCoverage: { '@type': 'Place', name: 'Polska' },
        variableMeasured: [
          {
            '@type': 'PropertyValue',
            name: 'Mediana ceny ofertowej działki budowlanej w Polsce',
            value: nationalPrice.median,
            unitText: 'PLN/m²',
            minValue: nationalPrice.low,
            maxValue: nationalPrice.high,
          },
          ...pricedRegions.map((r) => ({
            '@type': 'PropertyValue',
            name: `Mediana ceny ofertowej działki budowlanej, województwo ${r.region.name.toLowerCase()}`,
            value: r.detail.pricePerM2!.median,
            unitText: 'PLN/m²',
          })),
        ],
        dateModified: now.toISOString().slice(0, 10),
        isAccessibleForFree: true,
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://tylkodzialki.pl/ceny',
      }
    : null;

  return (
    <main className="pb-24 pt-0">
      {/* Okruszki tylko jako dane strukturalne: przy jednym poziomie nic nie wnoszą na ekranie. */}
      <Breadcrumbs jsonLdOnly items={[{ label: 'Strona główna', href: '/' }, { label: 'Ceny działek' }]} />

      <section className="mx-auto mt-10 max-w-6xl px-3 md:mt-12 md:px-4">
        <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Ceny działek budowlanych w Polsce
        </h1>

        {nationalPrice ? (
          <>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-fg md:text-xl md:leading-9">
              Działka budowlana w ofertach kosztuje w Polsce średnio{' '}
              <strong className="font-semibold text-brand-text">{zlM2(nationalPrice.median)}</strong>{' '}
              (mediana z {formatIntPL(national.count)} {ofert(national.count)} działek budowlanych, stan
              na {stan}).
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-fg/10 pt-4 text-sm">
              <div>
                <dt className="text-[13px] text-fg/55">Typowy zakres</dt>
                <dd className="mt-0.5 font-medium text-fg">
                  {formatIntPL(nationalPrice.low)} do {zlM2(nationalPrice.high)}
                </dd>
              </div>
              {national.totalPrice ? (
                <div>
                  <dt className="text-[13px] text-fg/55">Za całą działkę (mediana)</dt>
                  <dd className="mt-0.5 font-medium text-fg">{formatPLN(national.totalPrice.median)}</dd>
                </div>
              ) : null}
              {national.areaM2 ? (
                <div>
                  <dt className="text-[13px] text-fg/55">Powierzchnia (mediana)</dt>
                  <dd className="mt-0.5 font-medium text-fg">{formatIntPL(national.areaM2.median)} m²</dd>
                </div>
              ) : null}
              {nationalChange !== null ? (
                <div>
                  <dt className="text-[13px] text-fg/55">Zmiana w 30 dni</dt>
                  <dd className="mt-0.5 font-medium">
                    <Change value={nationalChange} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}

        <p className="mt-5 max-w-3xl text-[13px] leading-6 text-fg/50">
          Ceny ofertowe z aktywnych ogłoszeń na tylkodzialki.pl, liczone automatycznie co godzinę.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/sprawdz-dzialke"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-ink transition hover:opacity-90"
          >
            Sprawdź cenę swojej działki
          </Link>
          <Link
            href="/kup?przeznaczenia=BUDOWLANA"
            className="rounded-full border border-fg/15 px-5 py-2.5 text-sm font-medium text-fg transition hover:border-fg/30"
          >
            Zobacz oferty działek budowlanych
          </Link>
        </div>
      </section>

      {/* Województwa: od najdroższego. Mediana policzona wprost z ofert w granicach województwa. */}
      <section className="mx-auto mt-14 max-w-6xl px-3 md:px-4">
        <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Ceny działek budowlanych wg województw
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-fg/50">
          Mediana zł/m² ofert działek budowlanych w granicach województwa, od najdroższego. Obok
          liczba ofert{anyRegionChange ? ' i zmiana mediany w ostatnich 30 dniach' : ''}.
        </p>
        <div className="mt-5 grid gap-x-12 md:grid-cols-2">
          {regionColumns.map((col, ci) => (
            <ol
              key={ci}
              className={`min-w-0 border-fg/10 ${ci === 0 ? 'border-t' : 'md:border-t'}`}
            >
              {col.map(({ region, detail, change }, i) => (
                <li key={region.slug}>
                  <Link
                    href={`/dzialki/wojewodztwo/${region.slug}`}
                    className="group flex items-baseline gap-3 border-b border-fg/10 py-2.5 transition hover:bg-fg/[0.02]"
                  >
                    <span className="w-5 shrink-0 text-right text-[13px] text-fg/35">
                      {ci * half + i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg group-hover:text-brand-text md:text-[15px]">
                      {region.name}
                    </span>
                    <span className="whitespace-nowrap text-sm font-medium text-fg md:text-[15px]">
                      {detail.pricePerM2 ? (
                        zlM2(detail.pricePerM2.median)
                      ) : (
                        <span className="font-normal text-fg/40">za mało danych</span>
                      )}
                    </span>
                    <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-fg/45">
                      {formatIntPL(detail.count)} {ofert(detail.count)}
                    </span>
                    {anyRegionChange ? (
                      <span className="w-14 shrink-0 text-right text-[13px]">
                        <Change value={change} />
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ol>
          ))}
        </div>
      </section>

      {top.length > 0 ? (
        <section className="mx-auto mt-14 max-w-6xl px-3 md:px-4">
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {[
              { title: 'Najdroższe okolice miast', rows: top },
              { title: 'Najtańsze okolice miast', rows: bottom },
            ].map(({ title, rows }) => (
              <div key={title} className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">{title}</h2>
                <ol className="mt-5 border-t border-fg/10">
                  {rows.map(({ city, median, detail }, i) => (
                    <li key={city.slug}>
                      <Link
                        href={`/ceny/${city.slug}`}
                        className="group flex items-baseline gap-3 border-b border-fg/10 py-2.5 transition hover:bg-fg/[0.02]"
                      >
                        <span className="w-5 shrink-0 text-right text-[13px] text-fg/35">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg group-hover:text-brand-text md:text-[15px]">
                          {city.name}
                        </span>
                        <span className="whitespace-nowrap text-sm font-medium text-fg md:text-[15px]">
                          {zlM2(median)}
                        </span>
                        <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-fg/45">
                          {formatIntPL(detail.count)} {ofert(detail.count)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-6 text-fg/45">
            Mediana zł/m² ofert działek budowlanych w okolicy miasta (ok. 40 km) i liczba ofert. W
            rankingu miasta z co najmniej {MIN_OFERT_DO_CENY} ofertami.
          </p>
        </section>
      ) : null}

      {/* Mediana mówi o okolicy, a kupujący pyta o konkretną działkę: tu przejmuje narzędzie. */}
      <section className="mx-auto mt-14 max-w-6xl px-3 md:px-4">
        <div className="flex flex-col gap-5 border-y border-fg/10 py-7 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
              Ile jest warta Twoja działka?
            </h2>
            <p className="mt-2 text-sm leading-7 text-fg/70 md:text-[15px]">
              Wpisz adres lub numer działki albo wskaż ją na mapie. Dostaniesz cenę ofert z
              najbliższej okolicy, ceny z aktów notarialnych (gdy rejestr je ma), plan miejscowy i
              granice z ewidencji. Za darmo.
            </p>
          </div>
          <Link
            href="/sprawdz-dzialke"
            className="shrink-0 self-start rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink transition hover:opacity-90 md:self-auto"
          >
            Sprawdź swoją działkę
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-3 md:px-4">
        <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Ceny działek we wszystkich miastach
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-fg/50">
          Mediana zł/m² ofert działek budowlanych w okolicy miasta (ok. 40 km). W mieście zobaczysz
          zakres cen, ceny wg typu działki i trend.
        </p>
        <div className="mt-6 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {regionsWithCities.map(({ region, cities }) => (
            <div key={region.slug}>
              <h3 className="flex items-baseline justify-between gap-4 text-[13px] font-semibold uppercase tracking-wide text-fg/45">
                {region.name}
                <span className="text-[12px] font-normal normal-case tracking-normal text-fg/40">
                  mediana
                </span>
              </h3>
              <ul className="mt-3 border-t border-fg/10">
                {cities.map(({ city, detail }) => (
                  <li key={city.slug}>
                    <Link
                      href={`/ceny/${city.slug}`}
                      className="group flex items-baseline justify-between gap-4 border-b border-fg/10 py-2.5 transition hover:bg-fg/[0.02]"
                    >
                      <span className="text-sm font-medium text-fg group-hover:text-brand-text">
                        Ceny działek {city.name}
                      </span>
                      <span className="whitespace-nowrap text-[13px] text-fg/45">
                        {detail.pricePerM2 ? zlM2(detail.pricePerM2.median) : 'b.d.'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {faq.length > 0 ? <FaqSection items={faq} title="Ceny działek w Polsce: najczęstsze pytania" /> : null}

      {dataset ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
        />
      ) : null}
    </main>
  );
}
