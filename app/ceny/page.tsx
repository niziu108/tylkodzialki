import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SEO_REGIONS } from '@/lib/seo-locations';
import { getHubSitemapEntries } from '@/lib/seoHub';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Ceny działek w Polsce: ile kosztują wg miasta (zł/m²)',
  description:
    'Aktualne ceny działek budowlanych wg miasta, liczone na bieżąco z ofert: mediana zł/m², zakres stawek i powierzchnie. Wybierz miasto i sprawdź, ile kosztują działki.',
  alternates: { canonical: '/ceny' },
};

// Próg pokazania miasta na indeksie — spójny z progiem mediany (MIN_SAMPLE = 4).
const MIN_OFFERS = 4;

export default async function CenyIndexPage() {
  const entries = await getHubSitemapEntries();
  const countBySlug = new Map(entries.map((e) => [e.citySlug, e.byType['budowlane'] ?? 0]));

  // Miasta z realną podażą budowlanych, pogrupowane po województwie (kolejność jak w hubie).
  const regionsWithCities = SEO_REGIONS.map((region) => ({
    region,
    cities: region.cities
      .map((c) => ({ city: c, count: countBySlug.get(c.slug) ?? 0 }))
      .filter((x) => x.count >= MIN_OFFERS)
      .sort((a, b) => b.count - a.count),
  })).filter((r) => r.cities.length > 0);

  return (
    <main className="pb-24 pt-0">
      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[{ label: 'Strona główna', href: '/' }, { label: 'Ceny działek' }]}
        />
      </div>

      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
        <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Ceny działek w Polsce
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fg/70">
          Ile kosztuje działka budowlana w Twoim mieście? Medianę zł/m², typowy zakres stawek i
          powierzchnie liczymy na bieżąco z aktywnych ofert, nie z cenników. Wybierz miasto:
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-3 md:px-4">
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {regionsWithCities.map(({ region, cities }) => (
            <div key={region.slug}>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg/45">
                {region.name}
              </h2>
              <ul className="mt-3 border-t border-fg/10">
                {cities.map(({ city, count }) => (
                  <li key={city.slug}>
                    <Link
                      href={`/ceny/${city.slug}`}
                      className="group flex items-baseline justify-between gap-4 border-b border-fg/10 py-2.5 transition hover:bg-fg/[0.02]"
                    >
                      <span className="text-sm font-medium text-fg group-hover:text-brand-text">
                        Ceny działek {city.name}
                      </span>
                      <span className="text-[13px] text-fg/45">{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
