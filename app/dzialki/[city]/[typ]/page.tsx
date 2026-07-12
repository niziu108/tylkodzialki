import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import KupSearch from '../../../kup/KupSearch';
import Breadcrumbs from '@/components/Breadcrumbs';
import HubLinkGrid, { type HubLinkItem } from '@/components/HubLinkGrid';
import FaqSection from '@/components/FaqSection';
import {
  getSeoCity,
  getSeoType,
  getRegionForCity,
  SEO_TYPES,
} from '@/lib/seo-locations';
import { getCityStats, getCategoryDetail, CITY_RADIUS_KM } from '@/lib/seoHub';
import {
  buildSpecRows,
  buildLocalParagraphs,
  buildFaq,
} from '@/lib/seoCategoryContent';

type PageProps = {
  params: Promise<{ city: string; typ: string }>;
};

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, typ: typSlug } = await params;
  const city = getSeoCity(citySlug);
  const type = getSeoType(typSlug);

  if (!city || !type) {
    return { title: 'Działki na sprzedaż', robots: { index: false, follow: true } };
  }

  const stats = await getCityStats(city.slug);
  const count = stats.byType[type.slug] ?? 0;

  return {
    title: `Działki ${type.adj} ${city.name}, oferty na sprzedaż`,
    description: `Działki ${type.adj} na sprzedaż w okolicy ${city.name}: ${type.desc} Sprawdź ceny, powierzchnie i lokalizacje, kontakt do sprzedającego na stronie oferty.`,
    alternates: { canonical: `/dzialki/${city.slug}/${type.slug}` },
    robots: count > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function CityTypePage({ params }: PageProps) {
  const { city: citySlug, typ: typSlug } = await params;
  const city = getSeoCity(citySlug);
  const type = getSeoType(typSlug);
  if (!city || !type) notFound();

  const region = getRegionForCity(city.slug);
  const stats = await getCityStats(city.slug);
  const detail = await getCategoryDetail(city.slug, type.enum);

  // Unikalna treść lokalna i FAQ generowane z realnych danych (P21).
  const specRows = buildSpecRows(detail);
  const paragraphs = buildLocalParagraphs(city, type, region ?? undefined, detail);
  const faq = buildFaq(city, type, detail);

  // Linki do pozostałych typów w tym mieście (tylko niepuste).
  const siblingItems: HubLinkItem[] = SEO_TYPES.filter(
    (t) => t.slug !== type.slug && (stats.byType[t.slug] ?? 0) > 0
  ).map((t) => ({
    href: `/dzialki/${city.slug}/${t.slug}`,
    label: `Działki ${t.adj} ${city.name}`,
    count: stats.byType[t.slug],
  }));

  return (
    <main className="pb-24 pt-0">
      <h1 className="sr-only">
        Działki {type.adj} {city.name}
      </h1>

      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[
            { label: 'Strona główna', href: '/' },
            { label: 'Działki na sprzedaż', href: '/dzialki' },
            ...(region
              ? [
                  {
                    label: `Województwo ${region.name}`,
                    href: `/dzialki/wojewodztwo/${region.slug}`,
                  },
                ]
              : []),
            { label: `Działki ${city.name}`, href: `/dzialki/${city.slug}` },
            { label: `Działki ${type.adj}` },
          ]}
        />
      </div>

      <KupSearch
        seoMode
        initialFilters={{
          locText: city.name,
          center: { lat: city.lat, lng: city.lng },
          radiusKm: CITY_RADIUS_KM,
          przezn: [type.enum],
        }}
      />

      {/* Blok danych lokalnych + unikalny opis (P21) — wszystko liczone z naszej bazy.
          Renderujemy tylko, gdy realnie są oferty; pusta kategoria jest i tak noindex
          (metadata) i nie ma o czym pisać, więc nie zaśmiecamy jej „0 ofert". */}
      {detail.count > 0 ? (
        <>
          <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
            <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
              Działki {type.adj} {city.name}: dane z rynku
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

            <p className="mt-6 text-sm">
              <Link
                href={`/ceny/${city.slug}`}
                className="font-medium text-brand-text underline-offset-4 hover:underline"
              >
                Zobacz pełne zestawienie cen działek {city.name} →
              </Link>
            </p>
          </section>

          <FaqSection items={faq} title={`Działki ${type.adj} ${city.name}: najczęstsze pytania`} />
        </>
      ) : null}

      {siblingItems.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
          <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
            Inne typy działek w {city.name}
          </h2>
          <div className="mt-6">
            <HubLinkGrid items={siblingItems} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
