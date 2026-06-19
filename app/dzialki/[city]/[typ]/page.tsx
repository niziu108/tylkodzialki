import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KupSearch from '../../../kup/KupSearch';
import Breadcrumbs from '@/components/Breadcrumbs';
import HubLinkGrid, { type HubLinkItem } from '@/components/HubLinkGrid';
import {
  getSeoCity,
  getSeoType,
  getRegionForCity,
  SEO_TYPES,
} from '@/lib/seo-locations';
import { getCityStats, CITY_RADIUS_KM } from '@/lib/seoHub';

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

      {siblingItems.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
          <h2 className="text-xl font-semibold text-fg md:text-2xl">
            Inne typy działek w {city.name}
          </h2>
          <div className="mt-6">
            <HubLinkGrid items={siblingItems} />
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <div className="rounded-3xl border border-fg/10 bg-fg/[0.025] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-fg md:text-xl">
            Działki {type.adj} {city.name}
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-fg/70 md:text-[15px]">
            Na tej stronie znajdziesz działki {type.adj} w okolicy {city.name}: {type.desc}{' '}
            Zawęź wyniki po cenie, powierzchni i mediach, a kontakt do sprzedającego
            masz na stronie wybranej oferty.
          </p>
        </div>
      </section>
    </main>
  );
}
