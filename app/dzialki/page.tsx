import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import HubLinkGrid, { type HubLinkItem } from '@/components/HubLinkGrid';
import { SEO_REGIONS, SEO_TYPES } from '@/lib/seo-locations';
import { getRegionTotals } from '@/lib/seoHub';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Działki na sprzedaż w Polsce, według województw i miast',
  description:
    'Przeglądaj działki na sprzedaż w całej Polsce. Wybierz województwo, miasto i typ działki: budowlane, rolne, rekreacyjne, inwestycyjne, leśne i siedliskowe.',
  alternates: {
    canonical: '/dzialki',
  },
};

export default async function DzialkiHubPage() {
  const totals = await getRegionTotals();

  const regionItems: HubLinkItem[] = SEO_REGIONS.map((region) => ({
    href: `/dzialki/wojewodztwo/${region.slug}`,
    label: `Działki ${region.name}`,
    count: totals[region.slug] ?? 0,
  }));

  return (
    <main className="pb-24 pt-0">
      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[
            { label: 'Strona główna', href: '/' },
            { label: 'Działki na sprzedaż' },
          ]}
        />
      </div>

      <section className="mx-auto mt-8 max-w-6xl px-3 md:px-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
          Działki na sprzedaż w Polsce
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 md:text-[15px]">
          Wybierz województwo, a następnie miasto, aby zobaczyć aktualne oferty
          działek w okolicy. Na każdej stronie zawęzisz wyniki po typie działki,
          cenie, powierzchni i mediach. Kontakt do sprzedającego masz od razu na
          stronie oferty.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-3 md:px-4">
        <h2 className="text-lg font-semibold text-white md:text-xl">
          Działki według województw
        </h2>
        <div className="mt-5">
          <HubLinkGrid items={regionItems} />
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <h2 className="text-lg font-semibold text-white md:text-xl">
          Typy działek
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55 md:text-[15px]">
          Szukasz konkretnego rodzaju gruntu? Każdy typ znajdziesz w wybranym
          mieście, na przykład działki budowlane czy rolne w największych
          miastach danego województwa.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {SEO_TYPES.map((t) => (
            <li
              key={t.slug}
              className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/70"
            >
              Działki {t.adj}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <Link
          href="/kup"
          className="inline-flex text-sm text-white/60 transition hover:text-white"
        >
          Przeglądaj wszystkie oferty w wyszukiwarce →
        </Link>
      </section>
    </main>
  );
}
