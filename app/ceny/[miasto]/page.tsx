import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import FaqSection from '@/components/FaqSection';
import {
  getSeoCity,
  getSeoType,
  getRegionForCity,
  inCity,
  type SeoType,
} from '@/lib/seo-locations';
import { getCityPriceBoard, type CategoryDetail, type RangeStat } from '@/lib/seoHub';
import { buildSpecRows, buildLocalParagraphs, buildFaq } from '@/lib/seoCategoryContent';
import { getCityPriceTrend } from '@/lib/cityPriceStats';
import { formatIntPL, formatPLN } from '@/lib/format';

type PageProps = {
  params: Promise<{ miasto: string }>;
};

export const revalidate = 3600;

// Typ wiodący strony cenowej: „budowlane" pokrywa najczęstsze zapytanie o cenę.
const BUDOWLANA = getSeoType('budowlane') as SeoType;

function zlM2(v: number): string {
  return `${formatIntPL(v)} zł/m²`;
}

function range(stat: RangeStat, fmt: (n: number) => string): string {
  if (stat.low === stat.high) return fmt(stat.low);
  return `od ${fmt(stat.low)} do ${fmt(stat.high)}`;
}

function plDate(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

// Punkty polyline sparkline (viewBox 0..W × 0..H) z serii median.
function sparkPoints(values: number[], w: number, h: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3; // margines pionowy, żeby linia nie kleiła się do krawędzi
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// Detail typu wiodącego (budowlane) z tablicy, albo null gdy brak ofert budowlanych.
function budowlanaDetail(board: Awaited<ReturnType<typeof getCityPriceBoard>>): CategoryDetail | null {
  return board.byType.find((x) => x.type.slug === 'budowlane')?.detail ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { miasto } = await params;
  const city = getSeoCity(miasto);
  if (!city) {
    return { title: 'Ceny działek', robots: { index: false, follow: true } };
  }

  const board = await getCityPriceBoard(city.slug);
  const median = budowlanaDetail(board)?.pricePerM2?.median ?? null;
  const hasPrice = median !== null;

  return {
    title: `Ceny działek budowlanych ${city.name}: ile kosztują (zł/m²)`,
    description: hasPrice
      ? `Mediana cen działek budowlanych ${inCity(city)} to ${zlM2(median)}. Zakres stawek, cena za całą działkę i powierzchnie liczone na bieżąco z aktywnych ofert.`
      : `Ceny działek ${inCity(city)} liczone na bieżąco z aktywnych ofert: mediana zł/m², zakres stawek i powierzchnie. Sprawdź aktualne oferty na sprzedaż.`,
    alternates: { canonical: `/ceny/${city.slug}` },
    // Indeksujemy tylko strony z realną medianą — pusta/cienka leci noindex (jak huby P13/P22).
    robots: hasPrice ? undefined : { index: false, follow: true },
  };
}

export default async function CenyMiastoPage({ params }: PageProps) {
  const { miasto } = await params;
  const city = getSeoCity(miasto);
  if (!city) notFound();

  const region = getRegionForCity(city.slug) ?? undefined;
  const [board, trend] = await Promise.all([
    getCityPriceBoard(city.slug),
    getCityPriceTrend(city.slug),
  ]);

  // JEDNA liczba w całym serwisie: dokładnie ta sama mediana budowlanych co na stronie kategorii
  // (ten sam byType/computeDetail), żeby serwis nie mówił dwiema różnymi liczbami o tym samym.
  const budBased = budowlanaDetail(board); // null tylko gdy zero ofert budowlanych
  const heroDetail = budBased ?? board.overall;
  const heroPrice = heroDetail.pricePerM2;

  const dateStr = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Treść i FAQ z tego samego generatora co strony kategorii (P21) — na tej samej próbce co hero.
  const specRows = buildSpecRows(heroDetail);
  const paragraphs = budBased ? buildLocalParagraphs(city, BUDOWLANA, region, budBased) : [];
  const faq = budBased ? buildFaq(city, BUDOWLANA, budBased) : [];

  // Dane strukturalne Dataset — tylko gdy mamy realną medianę (nie zmyślamy liczby).
  const dataset = heroPrice
    ? {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `Ceny działek budowlanych ${inCity(city)}`,
        description: `Mediana i typowy zakres cen (zł/m²) działek budowlanych na sprzedaż ${inCity(city)}, liczone z aktywnych ofert serwisu tylkodzialki.pl. Stan na ${dateStr}.`,
        creator: { '@type': 'Organization', name: 'tylkodzialki.pl' },
        variableMeasured: {
          '@type': 'PropertyValue',
          name: 'Mediana ceny działki budowlanej',
          value: heroPrice.median,
          unitText: 'PLN/m²',
          minValue: heroPrice.low,
          maxValue: heroPrice.high,
        },
        dateModified: new Date().toISOString().slice(0, 10),
        isAccessibleForFree: true,
        // Licencja reużycia z podaniem źródła — Google prosi o to pole w Dataset, a przy okazji
        // wprost zachęca do cytowania danych z atrybucją do nas (backlinki/cytowania AI).
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: `https://tylkodzialki.pl/ceny/${city.slug}`,
      }
    : null;

  return (
    <main className="pb-24 pt-0">
      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[
            { label: 'Strona główna', href: '/' },
            { label: 'Ceny działek', href: '/ceny' },
            ...(region
              ? [
                  {
                    label: `Województwo ${region.name}`,
                    href: `/dzialki/wojewodztwo/${region.slug}`,
                  },
                ]
              : []),
            { label: `Ceny działek ${city.name}` },
          ]}
        />
      </div>

      {/* Hero: PROWADZIMY liczbą — mediana zł/m² od razu, nie pod listą ofert. */}
      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
        <p className="text-[13px] font-medium uppercase tracking-wide text-fg/50">
          Ceny działek {inCity(city)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Ile kosztuje działka budowlana {inCity(city)}?
        </h1>

        {heroPrice ? (
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:gap-12">
            <div>
              <div className="text-[13px] text-fg/55">Mediana ceny</div>
              <div className="mt-1 text-5xl font-semibold tracking-tight text-brand-text md:text-6xl">
                {zlM2(heroPrice.median)}
              </div>
              <div className="mt-2 text-sm text-fg/70">
                Typowo {range(heroPrice, zlM2)}
              </div>
            </div>
            {heroDetail.totalPrice ? (
              <div className="md:pb-1">
                <div className="text-[13px] text-fg/55">Za całą działkę</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-fg md:text-3xl">
                  {range(heroDetail.totalPrice, formatPLN)}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-fg/70">
            {inCity(city)} mamy na razie za mało ofert z ceną, aby podać wiarygodną medianę.
            Nie zmyślamy liczb przy zbyt małej próbce. Aktualne stawki sprawdzisz wprost w
            ogłoszeniach poniżej.
          </p>
        )}

        <p className="mt-6 text-[13px] text-fg/45">
          {heroPrice
            ? `Policzone z ${formatIntPL(heroDetail.count)} aktywnych ofert działek budowlanych w okolicy ${city.gen} (w promieniu ok. 40 km). Stan na ${dateStr}. Liczymy medianę i zakres percentylowy z ogłoszeń, nie z cenników.`
            : `Stan na ${dateStr}.`}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/dzialki/${city.slug}/budowlane`}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-ink transition hover:opacity-90"
          >
            Zobacz oferty działek budowlanych
          </Link>
          <Link
            href="/sprawdz-dzialke"
            className="rounded-full border border-fg/15 px-5 py-2.5 text-sm font-medium text-fg transition hover:border-fg/30"
          >
            Sprawdź cenę konkretnej działki
          </Link>
        </div>
      </section>

      {/* Trend mediany ceny — pojawia się dopiero, gdy uzbieramy min. 2 dni snapshotów.
          Do tego czasu sekcji nie ma (bez pustego stanu na publicznej stronie). */}
      {trend.points.length >= 2 && trend.firstDate ? (
        <section className="mx-auto mt-10 max-w-6xl px-3 md:px-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-fg/10 bg-fg/[0.02] px-5 py-4">
            <div>
              <div className="text-[13px] text-fg/55">Trend mediany zł/m²</div>
              <div
                className={`mt-0.5 text-sm font-medium ${
                  trend.changePct !== null && trend.changePct >= 0
                    ? 'text-brand-text'
                    : 'text-fg/70'
                }`}
              >
                {trend.changePct !== null
                  ? `${trend.changePct >= 0 ? '+' : ''}${Math.round(trend.changePct * 100)}% od ${plDate(trend.firstDate)}`
                  : `od ${plDate(trend.firstDate)}`}
              </div>
            </div>
            <svg
              viewBox="0 0 220 44"
              className="h-11 w-[220px] max-w-full text-brand"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polyline
                points={sparkPoints(
                  trend.points.map((p) => p.median),
                  220,
                  44
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </section>
      ) : null}

      {/* Ceny wg typu działki — rozbicie, każdy typ linkuje do swojej listy. */}
      {board.byType.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
          <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
            Ceny wg typu działki {inCity(city)}
          </h2>
          <div className="mt-6 border-t border-fg/10">
            {board.byType.map(({ type, detail }) => (
              <Link
                key={type.slug}
                href={`/dzialki/${city.slug}/${type.slug}`}
                className="group flex items-baseline justify-between gap-4 border-b border-fg/10 py-3.5 transition hover:bg-fg/[0.02]"
              >
                <span className="text-sm font-medium text-fg group-hover:text-brand-text md:text-[15px]">
                  Działki {type.adj}
                </span>
                <span className="flex items-baseline gap-4">
                  <span className="text-sm text-fg/85 md:text-[15px]">
                    {detail.pricePerM2 ? zlM2(detail.pricePerM2.median) : 'za mało danych'}
                  </span>
                  <span className="hidden w-24 text-right text-[13px] text-fg/45 sm:inline">
                    {formatIntPL(detail.count)} {detail.count === 1 ? 'oferta' : 'ofert'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-fg/45">
            Mediana zł/m². „Za mało danych" oznacza próbkę zbyt małą na wiarygodną liczbę.
          </p>
        </section>
      ) : null}

      {/* Opis lokalny + blok danych (ten sam generator co strona kategorii). */}
      {budBased && budBased.count > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
          <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
            Działki budowlane {city.name}: dane z rynku
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
            <div className="max-w-4xl space-y-4 text-sm leading-7 text-fg/70 md:text-[15px]">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <dl className="md:min-w-[18rem] md:border-l md:border-fg/10 md:pl-8">
              {specRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 border-b border-fg/10 py-2.5"
                >
                  <dt className="text-[13px] text-fg/55">{row.label}</dt>
                  <dd className="text-right text-sm font-medium text-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      {faq.length > 0 ? (
        <FaqSection items={faq} title={`Ceny działek ${city.name}: najczęstsze pytania`} />
      ) : null}

      {dataset ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
        />
      ) : null}
    </main>
  );
}
