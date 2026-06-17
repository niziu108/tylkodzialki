import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KupSearch from '../../kup/KupSearch';
import Breadcrumbs from '@/components/Breadcrumbs';
import HubLinkGrid, { type HubLinkItem } from '@/components/HubLinkGrid';
import { getSeoCity, getRegionForCity, SEO_TYPES } from '@/lib/seo-locations';
import { getCityStats, CITY_RADIUS_KM } from '@/lib/seoHub';

type PageProps = {
  params: Promise<{ city: string }>;
};

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getSeoCity(citySlug);

  if (!city) {
    return { title: 'Działki na sprzedaż', robots: { index: false, follow: true } };
  }

  const stats = await getCityStats(city.slug);

  return {
    title: `Działki na sprzedaż ${city.name}`,
    description: `Aktualne oferty działek na sprzedaż w okolicy ${city.name}. Filtruj po typie działki, cenie, powierzchni i mediach. Kontakt do sprzedającego na stronie oferty.`,
    alternates: { canonical: `/dzialki/${city.slug}` },
    robots: stats.total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function CityHubPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getSeoCity(citySlug);
  if (!city) notFound();

  const region = getRegionForCity(city.slug);
  const stats = await getCityStats(city.slug);

  // Linkujemy tylko do typów, które faktycznie mają oferty w okolicy — nie kierujemy
  // użytkownika ani Googlebota na puste (noindex) strony.
  const typeItems: HubLinkItem[] = SEO_TYPES.filter(
    (t) => (stats.byType[t.slug] ?? 0) > 0
  ).map((t) => ({
    href: `/dzialki/${city.slug}/${t.slug}`,
    label: `Działki ${t.adj} ${city.name}`,
    count: stats.byType[t.slug],
    sub: t.desc,
  }));

  return (
    <main className="pb-24 pt-0">
      <h1 className="sr-only">Działki na sprzedaż {city.name}</h1>

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
            { label: `Działki ${city.name}` },
          ]}
        />
      </div>

      <KupSearch
        seoMode
        initialFilters={{
          locText: city.name,
          center: { lat: city.lat, lng: city.lng },
          radiusKm: CITY_RADIUS_KM,
          przezn: [],
        }}
      />

      {typeItems.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Działki w {city.name} według typu
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55 md:text-[15px]">
            Wybierz rodzaj gruntu, którego szukasz. Liczba przy każdym typie to
            aktualna liczba ofert w okolicy.
          </p>
          <div className="mt-6">
            <HubLinkGrid items={typeItems} />
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-white md:text-xl">
            Działki na sprzedaż w okolicy {city.name}
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/55 md:text-[15px]">
            Zebraliśmy oferty działek z {city.name} i najbliższej okolicy. Możesz
            zawęzić wyniki po cenie, powierzchni, przeznaczeniu oraz dostępnych
            mediach. Każde ogłoszenie ma kontakt do sprzedającego, więc szczegóły
            ustalasz bezpośrednio.
          </p>
        </div>
      </section>
    </main>
  );
}
