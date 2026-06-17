import type { Metadata } from 'next';
import type { Przeznaczenie } from '@prisma/client';
import KupSearch from './KupSearch';
import type { SortOption } from './KupSearch';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Szukaj działki – oferty działek na sprzedaż',
  description:
    'Przeglądaj oferty działek na sprzedaż w całej Polsce. Filtruj po lokalizacji, cenie, powierzchni i przeznaczeniu.',
  alternates: {
    canonical: '/kup',
  },
};

const ALLOWED_PRZEZN: Przeznaczenie[] = [
  'INWESTYCYJNA',
  'BUDOWLANA',
  'ROLNA',
  'LESNA',
  'REKREACYJNA',
  'SIEDLISKOWA',
];

const ALLOWED_MEDIA = ['prad', 'woda', 'kanalizacja', 'gaz'] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

type KupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KupPage({ searchParams }: KupPageProps) {
  const sp = (await searchParams) ?? {};

  const lat = Number(one(sp.lat));
  const lng = Number(one(sp.lng));

  const hasCenter =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);

  const radiusRaw = Number(one(sp.radius) || '5');
  const radiusKm = [5, 10, 20, 40].includes(radiusRaw)
    ? (radiusRaw as 5 | 10 | 20 | 40)
    : 5;

  const przezn = one(sp.przezn)
    .split(',')
    .filter((x): x is Przeznaczenie =>
      ALLOWED_PRZEZN.includes(x as Przeznaczenie)
    );

  const media = one(sp.media)
    .split(',')
    .map((s) => s.trim())
    .filter((x): x is (typeof ALLOWED_MEDIA)[number] =>
      (ALLOWED_MEDIA as readonly string[]).includes(x)
    );

  // BBox „szukaj w tym obszarze" (P11) — zastępuje lokalizację tekstową/promień.
  const rawN = one(sp.n);
  const rawS = one(sp.s);
  const rawE = one(sp.e);
  const rawW = one(sp.w);
  const bn = Number(rawN);
  const bs = Number(rawS);
  const be = Number(rawE);
  const bw = Number(rawW);
  const hasBBox =
    !!rawN &&
    !!rawS &&
    !!rawE &&
    !!rawW &&
    Number.isFinite(bn) &&
    Number.isFinite(bs) &&
    Number.isFinite(be) &&
    Number.isFinite(bw) &&
    bn > bs &&
    be > bw;

  const pageRaw = Number(one(sp.page) || '1');

  const ALLOWED_SORTS: SortOption[] = ['newest', 'oldest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'];
  const sortRaw = one(sp['sort']);
  const sort: SortOption = ALLOWED_SORTS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest';

  return (
    <main className="pt-10 pb-20">
      <KupSearch
        initialPage={Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1}
        initialFilters={{
          locText: hasBBox ? '' : one(sp.loc),
          radiusKm,
          center: hasBBox ? null : hasCenter ? { lat, lng } : null,
          priceMin: digitsOnly(one(sp.priceMin)),
          priceMax: digitsOnly(one(sp.priceMax)),
          areaMin: digitsOnly(one(sp.areaMin)),
          areaMax: digitsOnly(one(sp.areaMax)),
          przezn,
          media,
          bbox: hasBBox ? { n: bn, s: bs, e: be, w: bw } : null,
          sort,
        }}
      />
    </main>
  );
}