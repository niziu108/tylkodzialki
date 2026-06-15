import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KupSearch from '../../../kup/KupSearch';
import { getSeoCity, SEO_CITIES } from '@/lib/seo-locations';
import Breadcrumbs from '@/components/Breadcrumbs';

type PageProps = {
  params: Promise<{
    city: string;
  }>;
};

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return SEO_CITIES.map((city) => ({
    city: city.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getSeoCity(citySlug);

  if (!city) {
    return {
      title: 'Działki budowlane – oferty na sprzedaż',
    };
  }

  return {
    title: `Działki budowlane ${city.name} – oferty na sprzedaż`,
    description: `Sprawdź aktualne działki budowlane na sprzedaż w lokalizacji ${city.name}. Przeglądaj oferty działek, ceny, powierzchnie i lokalizacje w jednym miejscu.`,
    alternates: {
      canonical: `/dzialki/${city.slug}/budowlane`,
    },
  };
}

export default async function DzialkiBudowlaneCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getSeoCity(citySlug);

  if (!city) notFound();

  return (
    <main className="pt-0 pb-20">
      <h1 className="sr-only">Działki budowlane {city.name}</h1>

      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[
            { label: 'Strona główna', href: '/' },
            { label: 'Działki na sprzedaż', href: '/kup' },
            { label: `Działki budowlane ${city.name}` },
          ]}
        />
      </div>

      <KupSearch
  seoMode
  initialFilters={{
    locText: city.name,
    radiusKm: 40,
    przezn: [],
  }}
/>

      <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 md:p-8">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Działki budowlane {city.name}
          </h2>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/55 md:text-[15px]">
            Na tej stronie znajdziesz aktualne oferty działek budowlanych w lokalizacji{' '}
            {city.name}. Możesz dodatkowo zawęzić wyniki po cenie, powierzchni oraz
            zasięgu wyszukiwania.
          </p>
        </div>
      </section>
    </main>
  );
}