import type { Metadata } from 'next';
import type { Przeznaczenie } from '@prisma/client';
import KupSearch from './KupSearch';
import { parseRadiusKm } from '@/lib/searchRadius';
import type { SortOption } from './KupSearch';
import { unstable_cache } from 'next/cache';
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

// Gołe wejście na /kup (zero filtrów, pierwsza strona, domyślny sort) daje dla wszystkich
// dokładnie ten sam wynik, a przy fali ruchu z zewnątrz to właśnie tam trafia większość odwiedzin.
// Trzymamy ten jeden wariant we wspólnym cache przez minutę, żeby setki równoczesnych wejść
// nie oznaczały setek zapytań do bazy. Import z CRM chodzi co 2 h, więc minuta opóźnienia nie
// zmienia świeżości podaży w niczym, co użytkownik jest w stanie zauważyć.
// Cache trzyma gotowy JSON (nie obiekty Prismy), więc kształt jest identyczny z tym, co klient
// dostaje z /api/dzialki, i nie ma pułapki na serializacji dat.
const getDefaultListing = unstable_cache(
  async () => {
    const params = new URLSearchParams();
    params.set('skip', '0');
    params.set('take', '20');
    params.set('sort', 'newest');

    const body = await queryDzialkiList(params);
    if (!('items' in body)) return null;

    return {
      items: JSON.parse(JSON.stringify(body.items)) as unknown[],
      count: body.count,
    };
  },
  ['kup-listing-default-v1'],
  { revalidate: 60 }
);

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

  const radiusKm = parseRadiusKm(one(sp.radius));

  const przezn = one(sp.przezn)
    .split(',')
    .filter((x): x is Przeznaczenie =>
      ALLOWED_PRZEZN.includes(x as Przeznaczenie)
    );

  const dojazd = one(sp.dojazd) === '1';

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

  // Wejście od razu na mapę (przycisk „Mapa" na stronie głównej → /kup?widok=mapa).
  const openMap = one(sp.widok).trim() === 'mapa';

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
    if (dojazd) apiParams.set('dojazd', '1');
    if (transakcja.length) apiParams.set('transakcja', transakcja.join(','));
    apiParams.set('skip', String((page - 1) * 20));
    apiParams.set('take', '20');
    apiParams.set('sort', sort);

    // Czy to jest właśnie ten goły wariant, który wolno wziąć ze wspólnego cache.
    // Każde odstępstwo (filtr, tekst, promień, bbox, inny sort, dalsza strona) liczy się na świeżo.
    const isDefaultView =
      !hasBBox &&
      !hasCenter &&
      !locTextForSsr &&
      page === 1 &&
      sort === 'newest' &&
      !przezn.length &&
      !media.length &&
      !dojazd &&
      !transakcja.length &&
      !pMin &&
      !pMax &&
      !aMin &&
      !aMax;

    try {
      if (isDefaultView) {
        const cached = await getDefaultListing();
        if (cached) {
          initialItems = cached.items;
          initialCount = cached.count;
        }
      } else {
        const body = await queryDzialkiList(apiParams);
        if ('items' in body) {
          // Serializacja do zwykłego JSON (Daty → ISO) — dokładnie ten kształt, który klient
          // dostaje dziś z fetch(/api/dzialki), więc pierwszy render klienta = render serwera.
          initialItems = JSON.parse(JSON.stringify(body.items)) as unknown[];
          initialCount = body.count;
        }
      }
    } catch {
      // Gdyby SSR padł (np. chwilowy błąd bazy) — nie wywalamy strony; klient dociągnie dane
      // jak dotąd (initialItems zostaje undefined → KupSearch robi startowy fetch).
    }
  }

  return (
    <main>
      {/* Nagłówek tylko dla wyszukiwarek. Strona wyników celowo nie ma widocznego tytułu
          (to narzędzie, nie landing), ale bez H1 Google dostawał stronę z sitemapy, która
          nigdzie nie mówi, o czym jest. Ten sam zabieg co na hubach /dzialki/... Treść
          opisuje canonical, czyli /kup bez filtrów, bo warianty z ?loc i tak się do niego
          sprowadzają. */}
      <h1 className="sr-only">Działki na sprzedaż w całej Polsce</h1>

      <KupSearch
        initialPage={page}
        initialItems={initialItems as never}
        initialCount={initialCount}
        initialFocusId={focusId}
        initialOpenMap={openMap}
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
          dojazd,
          transakcja,
          bbox: hasBBox ? { n: bn, s: bs, e: be, w: bw } : null,
          sort,
        }}
      />
    </main>
  );
}