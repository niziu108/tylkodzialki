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
      ? `Działka budowlana w ofertach kosztuje w Polsce średnio ${zlM2(median)} (mediana z ${formatIntPL(national.count)} aktywnych ofert). Ceny wg województw i miast, zmiana miesiąc do miesiąca, liczone na bieżąco.`
      : 'Aktualne ceny działek budowlanych wg miasta, liczone na bieżąco z ofert: mediana zł/m², zakres stawek i powierzchnie.',
    alternates: { canonical: '/ceny' },
  };
}

export default async function CenyIndexPage() {
  const [board, monthAgo] = await Promise.all([getPolandPriceBoard(), getMonthAgoMedians()]);
  const now = new Date();
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

  // Ranking miast: tylko pewna próbka (ten sam próg co wycena punktowa).
  const ranked = board.cities
    .filter((c) => c.detail.pricePerM2 && c.detail.count >= MIN_OFERT_DO_CENY)
    .map((c) => ({ ...c, median: c.detail.pricePerM2!.median, change: changeOf(monthAgo, c.city.slug, c.detail) }))
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
      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs items={[{ label: 'Strona główna', href: '/' }, { label: 'Ceny działek' }]} />
      </div>

      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
        <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Ceny działek budowlanych w Polsce
        </h1>

        {nationalPrice ? (
          <>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-fg md:text-xl md:leading-9">
              Działka budowlana w ofertach kosztuje w Polsce średnio{' '}
              <strong className="font-semibold text-brand-text">{zlM2(nationalPrice.median)}</strong>{' '}
              (mediana, stan na {stan}, {formatIntPL(national.count)} {ofert(national.count)}).
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
                  <dt className="text-[13px] text-fg/55">Zmiana m/m</dt>
                  <dd className="mt-0.5 font-medium">
                    <Change value={nationalChange} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}

        <p className="mt-5 max-w-3xl text-[13px] leading-6 text-fg/50">
          Ceny ofertowe z aktywnych ogłoszeń, nie transakcyjne. Liczymy je automatycznie z ofert w
          serwisie, nie z cenników. Ceny transakcyjne z rejestru sprawdzisz przy konkretnej działce w{' '}
          <Link href="/sprawdz-dzialke" className="underline decoration-fg/25 underline-offset-2 hover:text-fg">
            Sprawdź działkę
          </Link>
          .
        </p>
      </section>

      {/* Województwa: od najdroższego. Mediana policzona wprost z ofert w granicach województwa. */}
      <section className="mx-auto mt-14 max-w-6xl px-3 md:px-4">
        <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Ceny działek budowlanych wg województw
        </h2>
        <table className="mt-5 w-full max-w-3xl border-collapse text-sm md:text-[15px]">
          <thead>
            <tr className="border-b border-fg/10 text-left text-[12px] text-fg/50 md:text-[13px]">
              <th className="py-2 pr-2 font-normal">Województwo</th>
              <th className="py-2 pr-2 text-right font-normal">Mediana</th>
              <th className="hidden py-2 pr-2 text-right font-normal md:table-cell">Typowo</th>
              <th className="py-2 pr-2 text-right font-normal">Oferty</th>
              {anyRegionChange ? (
                <th className="py-2 text-right font-normal">m/m</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {regions.map(({ region, detail, change }) => (
              <tr key={region.slug} className="border-b border-fg/10">
                <td className="py-2.5 pr-2">
                  <Link
                    href={`/dzialki/wojewodztwo/${region.slug}`}
                    className="font-medium text-fg hover:text-brand-text"
                  >
                    {region.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-2 text-right font-medium text-fg">
                  {detail.pricePerM2 ? zlM2(detail.pricePerM2.median) : <span className="font-normal text-fg/40">za mało danych</span>}
                </td>
                <td className="hidden whitespace-nowrap py-2.5 pr-2 text-right text-fg/55 md:table-cell">
                  {detail.pricePerM2 ? `${formatIntPL(detail.pricePerM2.low)} do ${formatIntPL(detail.pricePerM2.high)}` : null}
                </td>
                <td className="py-2.5 pr-2 text-right text-fg/55">{formatIntPL(detail.count)}</td>
                {anyRegionChange ? (
                  <td className="whitespace-nowrap py-2.5 text-right">
                    <Change value={change} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[13px] leading-6 text-fg/45">
          Mediana zł/m² ofert działek budowlanych w granicach województwa. „Typowo” to przedział, w
          którym mieści się 80% ofert.
          {anyRegionChange
            ? ' m/m to zmiana mediany do stanu sprzed 30 dni.'
            : ' Zmianę miesiąc do miesiąca pokażemy po 30 dniach codziennych pomiarów.'}
        </p>
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
                  {rows.map(({ city, median, detail, change }, i) => (
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
                        <span className="hidden w-16 text-right text-[13px] text-fg/45 sm:inline">
                          {formatIntPL(detail.count)}
                        </span>
                        <span className="w-14 text-right text-[13px]">
                          <Change value={change} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-6 text-fg/45">
            Mediana zł/m² ofert działek budowlanych w okolicy miasta (ok. 40 km), liczba ofert i zmiana
            do stanu sprzed 30 dni. W rankingu miasta z co najmniej {MIN_OFERT_DO_CENY} ofertami, zmiana m/m od {MIN_TREND_SAMPLE} ofert.
          </p>
        </section>
      ) : null}

      <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
        <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Ceny działek w miastach
        </h2>
        <div className="mt-6 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {regionsWithCities.map(({ region, cities }) => (
            <div key={region.slug}>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg/45">
                {region.name}
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
                        {detail.pricePerM2 ? zlM2(detail.pricePerM2.median) : `${detail.count}`}
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
