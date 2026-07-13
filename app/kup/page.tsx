import type { Metadata } from 'next';
import type { Przeznaczenie } from '@prisma/client';
import KupSearch, { DEFAULT_RADIUS_KM } from './KupSearch';
import type { SortOption } from './KupSearch';
import { queryDzialkiList } from '@/lib/dzialkiListing';

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

const ALLOWED_TRANSAKCJA = ['SPRZEDAZ', 'WYNAJEM'] as const;

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

  const radiusRaw = Number(one(sp.radius) || String(DEFAULT_RADIUS_KM));
  const radiusKm = [5, 10, 20, 40].includes(radiusRaw)
    ? (radiusRaw as 5 | 10 | 20 | 40)
    : DEFAULT_RADIUS_KM;

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

  const transakcja = one(sp.transakcja)
    .split(',')
    .map((s) => s.trim())
    .filter((x): x is (typeof ALLOWED_TRANSAKCJA)[number] =>
      (ALLOWED_TRANSAKCJA as readonly string[]).includes(x)
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

  // Wejście z konkretnej oferty („Zobacz na mapie ofert") — id oferty do wyróżnienia
  // i auto-otwarcia mapy wyśrodkowanej na jej lokalizacji.
  const focusId = one(sp.focus).trim() || null;

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  // SSR 1. strony wyników: liczymy je już na serwerze i wstrzykujemy do KupSearch, żeby lista
  // pojawiła się RAZEM z HTML-em (koniec waterfallu: SSR skorupy → mount → osobny fetch API).
  // Pomijamy tylko przypadek wymagający geokodowania (wpisany tekst bez współrzędnych) — tam
  // center dolicza klient (Google Geocoder), więc wyniki i tak muszą policzyć się po jego stronie.
  const locTextForSsr = hasBBox ? '' : one(sp.loc).trim();
  const needsGeocode = !hasBBox && !hasCenter && locTextForSsr !== '';

  let initialItems: unknown[] | undefined;
  let initialCount: number | undefined;

  if (!needsGeocode) {
    // Te same nazwy parametrów, które buduje klientowy makeParams() → identyczne wyniki.
    const apiParams = new URLSearchParams();

    if (hasBBox) {
      apiParams.set('n', String(bn));
      apiParams.set('s', String(bs));
      apiParams.set('e', String(be));
      apiParams.set('w', String(bw));
    } else {
      if (locTextForSsr) {
        apiParams.set('q', locTextForSsr);
        apiParams.set('qRaw', locTextForSsr);
      }
      if (hasCenter) {
        apiParams.set('lat', String(lat));
        apiParams.set('lng', String(lng));
        apiParams.set('radius', String(radiusKm));
      }
    }

    const pMin = digitsOnly(one(sp.priceMin));
    const pMax = digitsOnly(one(sp.priceMax));
    const aMin = digitsOnly(one(sp.areaMin));
    const aMax = digitsOnly(one(sp.areaMax));
    if (pMin) apiParams.set('priceMin', pMin);
    if (pMax) apiParams.set('priceMax', pMax);
    if (aMin) apiParams.set('areaMin', aMin);
    if (aMax) apiParams.set('areaMax', aMax);
    if (przezn.length) apiParams.set('przeznaczenia', przezn.join(','));
    if (media.length) apiParams.set('media', media.join(','));
    if (transakcja.length) apiParams.set('transakcja', transakcja.join(','));
    apiParams.set('skip', String((page - 1) * 20));
    apiParams.set('take', '20');
    apiParams.set('sort', sort);

    try {
      const body = await queryDzialkiList(apiParams);
      if ('items' in body) {
        // Serializacja do zwykłego JSON (Daty → ISO) — dokładnie ten kształt, który klient
        // dostaje dziś z fetch(/api/dzialki), więc pierwszy render klienta = render serwera.
        initialItems = JSON.parse(JSON.stringify(body.items)) as unknown[];
        initialCount = body.count;
      }
    } catch {
      // Gdyby SSR padł (np. chwilowy błąd bazy) — nie wywalamy strony; klient dociągnie dane
      // jak dotąd (initialItems zostaje undefined → KupSearch robi startowy fetch).
    }
  }

  return (
    <main>
      <KupSearch
        initialPage={page}
        initialItems={initialItems as never}
        initialCount={initialCount}
        initialFocusId={focusId}
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
          transakcja,
          bbox: hasBBox ? { n: bn, s: bs, e: be, w: bw } : null,
          sort,
        }}
      />
    </main>
  );
}