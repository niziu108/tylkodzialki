import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KupSearch from '../../../kup/KupSearch';
import Breadcrumbs from '@/components/Breadcrumbs';
import HubLinkGrid, { type HubLinkItem } from '@/components/HubLinkGrid';
import { getSeoRegion, SEO_TYPES } from '@/lib/seo-locations';
import { getVoivodeshipByKey } from '@/lib/dzialkiSearch';
import { getVoivodeshipStats } from '@/lib/seoHub';

type PageProps = {
  params: Promise<{ woj: string }>;
};

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { woj } = await params;
  const region = getSeoRegion(woj);

  if (!region) {
    return { title: 'Działki na sprzedaż', robots: { index: false, follow: true } };
  }

  const stats = await getVoivodeshipStats(region.slug);

  return {
    title: `Działki na sprzedaż, województwo ${region.name}`,
    description: `Aktualne oferty działek na sprzedaż. Województwo ${region.name}: wybierz miasto i typ działki, sprawdź ceny, powierzchnie i media.`,
    alternates: { canonical: `/dzialki/wojewodztwo/${region.slug}` },
    robots: stats.total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function WojewodztwoPage({ params }: PageProps) {
  const { woj } = await params;
  const region = getSeoRegion(woj);
  if (!region) notFound();

  const area = getVoivodeshipByKey(region.slug);
  if (!area) notFound();

  const stats = await getVoivodeshipStats(region.slug);

  const bbox = {
    n: area.bbox.maxLat,
    s: area.bbox.minLat,
    e: area.bbox.maxLng,
    w: area.bbox.minLng,
  };

  const cityItems: HubLinkItem[] = region.cities.map((c) => ({
    href: `/dzialki/${c.slug}`,
    label: `Działki ${c.name}`,
    count: stats.cityCounts[c.slug] ?? 0,
  }));

  return (
    <main className="pb-24 pt-0">
      <h1 className="sr-only">Działki na sprzedaż, województwo {region.name}</h1>

      <div className="mx-auto max-w-6xl px-3 pt-6 md:px-4">
        <Breadcrumbs
          items={[
            { label: 'Strona główna', href: '/' },
            { label: 'Działki na sprzedaż', href: '/dzialki' },
            { label: `Województwo ${region.name}` },
          ]}
        />
      </div>

      <KupSearch
        seoMode
        initialFilters={{
          bbox,
          przezn: [],
        }}
      />

      <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
        <h2 className="text-xl font-semibold text-fg md:text-2xl">
          Działki w miastach województwa {region.name}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-fg/55 md:text-[15px]">
          Przejdź do najczęściej wyszukiwanych miast w regionie. Na stronie miasta
          zawęzisz oferty po typie działki: {SEO_TYPES.map((t) => t.adj).join(', ')}.
        </p>
        <div className="mt-6">
          <HubLinkGrid items={cityItems} />
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-3 md:px-4">
        <div className="rounded-3xl border border-fg/10 bg-fg/[0.025] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-fg md:text-xl">
            Kupno działki w województwie {region.name}
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-fg/55 md:text-[15px]">
            Na tej stronie zebraliśmy oferty działek z całego regionu. Filtruj po
            cenie, powierzchni, przeznaczeniu i mediach, a następnie przejdź do
            wybranej oferty. Kontakt do sprzedającego jest na stronie każdego
            ogłoszenia, więc dogadujesz szczegóły bezpośrednio z właścicielem lub
            biurem.
          </p>
        </div>
      </section>
    </main>
  );
}
