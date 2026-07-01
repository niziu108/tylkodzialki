import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KupSearch from '../../../kup/KupSearch';
import Breadcrumbs from '@/components/Breadcrumbs';
import HubLinkGrid, { type HubLinkItem } from '@/components/HubLinkGrid';
import FaqSection from '@/components/FaqSection';
import { getSeoRegion } from '@/lib/seo-locations';
import { buildSpecRows } from '@/lib/seoCategoryContent';
import {
  getPowiatDetail,
  getPowiatList,
  powiatNom,
  powiatLoc,
  POWIAT_MIN_INDEX,
} from '@/lib/seoPowiaty';
import { buildPowiatParagraphs, buildPowiatFaq, powiatHeading } from '@/lib/seoPowiatContent';

type PageProps = {
  params: Promise<{ powiat: string }>;
};

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { powiat: slug } = await params;
  const data = await getPowiatDetail(slug);

  if (!data) {
    return { title: 'Działki na sprzedaż', robots: { index: false, follow: true } };
  }

  const region = getSeoRegion(data.wojSlug);
  const nom = powiatNom(data.adj);

  return {
    title: `Działki na sprzedaż, ${nom}`,
    description: `Aktualne oferty działek w ${powiatLoc(data.adj)}${region ? `, województwo ${region.name}` : ''}. Sprawdź ceny, powierzchnie, media i przejdź do kontaktu na stronie oferty.`,
    alternates: { canonical: `/dzialki/powiat/${slug}` },
    robots: data.detail.count >= POWIAT_MIN_INDEX ? undefined : { index: false, follow: true },
  };
}

export default async function PowiatPage({ params }: PageProps) {
  const { powiat: slug } = await params;
  const data = await getPowiatDetail(slug);
  if (!data) notFound();

  const region = getSeoRegion(data.wojSlug);
  const detail = data.detail;

  const specRows = buildSpecRows(detail);
  const paragraphs = buildPowiatParagraphs(data.adj, region?.name ?? '', detail);
  const faq = buildPowiatFaq(data.adj, detail);

  // Sąsiednie powiaty w tym samym województwie (mesh woj <-> powiat).
  const siblings = (await getPowiatList())
    .filter((p) => p.wojSlug === data.wojSlug && p.slug !== data.slug && p.total > 0)
    .slice(0, 12);
  const siblingItems: HubLinkItem[] = siblings.map((p) => ({
    href: `/dzialki/powiat/${p.slug}`,
    label: powiatHeading(p.adj),
    count: p.total,
  }));

  const bbox = {
    n: data.bbox.maxLat,
    s: data.bbox.minLat,
    e: data.bbox.maxLng,
    w: data.bbox.minLng,
  };

  return (
    <main className="pb-24 pt-0">
      <h1 className="sr-only">Działki na sprzedaż, {powiatNom(data.adj)}</h1>

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
            { label: powiatHeading(data.adj) },
          ]}
        />
      </div>

      <KupSearch seoMode initialFilters={{ bbox, przezn: [] }} />

      <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
        <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          {powiatHeading(data.adj)}: dane z rynku
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

      <FaqSection items={faq} title={`${powiatHeading(data.adj)}: najczęstsze pytania`} />

      {siblingItems.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl px-3 md:px-4">
          <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
            Inne powiaty{region ? ` w województwie ${region.name}` : ''}
          </h2>
          <div className="mt-6">
            <HubLinkGrid items={siblingItems} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
