import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KupSearch from '../../../kup/KupSearch';
import { getSeoCity, SEO_CITIES } from '@/lib/seo-locations';

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
    <main className="pt-10 pb-20">
      <section className="mx-auto max-w-6xl px-3 pb-8 md:px-4">
        <div className="rounded-3xl border border-white/10 bg-[#0f0f0f]/40 p-6 md:p-8">
          <p className="text-[12px] uppercase tracking-[0.26em] text-white/45">
            TylkoDziałki.pl
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Działki budowlane {city.name}
          </h1>

          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/65 md:text-[16px]">
            Przeglądaj aktualne oferty działek budowlanych w lokalizacji {city.name}.
            Filtruj po cenie, powierzchni i lokalizacji, a następnie przejdź do szczegółów
            wybranej oferty.
          </p>
        </div>
      </section>

      <KupSearch
        seoMode
        initialFilters={{
          locText: city.name,
          radiusKm: 40,
          przezn: ['BUDOWLANA'],
        }}
      />
    </main>
  );
}