// Wspólna logika listy ofert dla `GET /api/dzialki` ORAZ dla renderu serwerowego /kup.
//
// Dawniej cała ta logika żyła w handlerze route'a, a strona /kup renderowała pustą
// skorupę i dopiero klient dociągał 1. stronę osobnym fetchem (waterfall: SSR skorupy →
// mount → fetch API). Tu wyciągamy zapytanie do jednej funkcji, żeby /kup mógł policzyć
// 1. stronę już na serwerze (SSR, bez drugiego round-tripu), a route był jej cienką
// nakładką HTTP. Jedno źródło prawdy — wyniki listy z SSR i z API są identyczne.

import {
  LocationMode,
  Prisma,
  DzialkaStatus,
  TransakcjaTyp,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildSearchContext, getSearchMatchInfo, computeGeoPrefilterBBox } from '@/lib/dzialkiSearch';
import { listDzialkiPaginated, PAGE_INCLUDE, FEATURED_TOP_CAP, type ListSort } from '@/lib/dzialkiQuery';
import { MEDIA_AVAILABLE } from '@/lib/media';

function isFeaturedActive(d: any) {
  return !!d.isFeatured && !!d.featuredUntil && new Date(d.featuredUntil).getTime() > Date.now();
}

/* ── Mapa: piny i bąble ────────────────────────────────────────────────────────
 * Mapa nie ściąga już całej Polski naraz. Serwer dostaje kadr (vn/vs/ve/vw) i zoom,
 * i oddaje albo pojedyncze piny (gdy w kadrze mieści się ich sensownie mało), albo
 * bąble — zliczenia ofert w komórkach siatki. Dzięki temu payload i liczba obiektów
 * po stronie przeglądarki są STAŁE, niezależnie czy w bazie jest 8 tys. czy 500 tys.
 * ofert. Bąble zastępują też klastrowanie po stronie klienta: liczy je baza + jeden
 * przebieg po tablicy, a nie tysiące obiektów mapy. */

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  cena: number;
  transakcja: TransakcjaTyp;
  featured: boolean;
  approx: boolean;
};

export type MapCluster = { lat: number; lng: number; count: number };

export type DzialkiMapBody = {
  ok: true;
  /** Ile ofert pasuje do filtrów W TYM KADRZE (nie w całej bazie). */
  total: number;
  /** Oferty pokazywane pojedynczo — z ceną na pinie. */
  points: MapPin[];
  /** Skupiska — liczba ofert w komórce siatki. Obie listy rysują się razem. */
  clusters: MapCluster[];
  /** Ramka wszystkich pasujących ofert — tylko przy `fit=1` (dopasowanie kadru). */
  bounds: { n: number; s: number; e: number; w: number } | null;
};

// Powyżej tylu ofert w kadrze przechodzimy na bąble. 600 pinów to ~0,2 s budowy
// przy pierwszym renderze i zero przy kolejnych (pula markerów), a jednocześnie
// gęstość, przy której pojedyncze piny są jeszcze czytelne.
const PIN_MAX = 600;
// Górny limit bąbli — gdyby siatka wyszła zbyt drobna, powiększamy komórkę.
const CLUSTER_MAX = 400;

/* Bok komórki siatki w stopniach: ~64 px na ekranie przy danym zoomie, czyli bąble
 * mają stałą wielkość wizualną niezależnie od przybliżenia. Na szerokości Polski
 * stopień długości jest ok. 0,62 stopnia szerokości „w metrach", więc komórka jest
 * skalowana, żeby wychodziła kwadratowa, a nie rozciągnięta. */
function gridStep(zoom: number) {
  const z = Math.min(Math.max(Number.isFinite(zoom) ? zoom : 6, 3), 20);
  const lng = 90 / 2 ** z;
  return { lat: lng * 0.62, lng };
}

/* Zbicie ofert w bąble: jeden przebieg po tablicy na komórkę siatki. Gdyby siatka
 * wyszła zbyt drobna (np. bardzo gęsty region), komórka się podwaja, aż bąbli będzie
 * mniej niż limit — klient zawsze dostaje kilkaset obiektów, nie kilkadziesiąt tysięcy.
 *
 * Komórki z jedną ofertą wracają OSOBNO (`singles`), żeby pokazać je jako normalny pin
 * z ceną. Bąbel z napisem „1" to zmarnowane kliknięcie: kupujący ma od razu widzieć,
 * ile ta działka kosztuje. Singletonów nigdy nie jest więcej niż komórek, więc łączna
 * liczba obiektów na mapie i tak trzyma się limitu. */
function clusterize<T extends { lat: number; lng: number }>(
  rows: T[],
  zoom: number
): { clusters: MapCluster[]; singles: T[] } {
  let step = gridStep(zoom);
  let cells = new Map<string, { lat: number; lng: number; count: number; sample: T }>();

  for (let pass = 0; pass < 6; pass++) {
    cells = new Map();
    for (const r of rows) {
      const key = `${Math.floor(r.lat / step.lat)}:${Math.floor(r.lng / step.lng)}`;
      const cell = cells.get(key);
      if (cell) {
        cell.lat += r.lat;
        cell.lng += r.lng;
        cell.count += 1;
      } else {
        cells.set(key, { lat: r.lat, lng: r.lng, count: 1, sample: r });
      }
    }
    if (cells.size <= CLUSTER_MAX) break;
    step = { lat: step.lat * 2, lng: step.lng * 2 };
  }

  // Bąbel siada w środku ciężkości swoich ofert, nie w środku komórki — dzięki temu
  // po przybliżeniu piny wychodzą stamtąd, gdzie bąbel stał, a nie „przeskakują".
  const clusters: MapCluster[] = [];
  const singles: T[] = [];
  for (const c of cells.values()) {
    if (c.count === 1) singles.push(c.sample);
    else clusters.push({ lat: c.lat / c.count, lng: c.lng / c.count, count: c.count });
  }
  return { clusters, singles };
}

export type DzialkiListBody =
  | DzialkiMapBody
  | { ok: true; total: number; count: number; items: any[]; meta: {
      page: number; skip: number; take: number; totalPages: number; hasPrev: boolean; hasNext: boolean;
    } };

// Zwraca gotowe „body" (nie NextResponse), żeby móc je oddać zarówno z route'a
// (NextResponse.json) jak i użyć wprost w komponencie serwerowym /kup.
export async function queryDzialkiList(searchParams: URLSearchParams): Promise<DzialkiListBody> {
  const q = (searchParams.get('q') || '').trim();
  const qRaw = (searchParams.get('qRaw') || '').trim();
  const searchText = qRaw || q;

  const priceMin = searchParams.get('priceMin');
  const priceMax = searchParams.get('priceMax');
  const areaMin = searchParams.get('areaMin');
  const areaMax = searchParams.get('areaMax');

  const latParam = Number(searchParams.get('lat'));
  const lngParam = Number(searchParams.get('lng'));
  const radiusParam = Number(searchParams.get('radius') || '0');

  const hasRadiusSearch =
    Number.isFinite(latParam) &&
    Number.isFinite(lngParam) &&
    Number.isFinite(radiusParam) &&
    radiusParam > 0;

  const przeznRaw = (searchParams.get('przeznaczenia') || '').trim();
  const przeznaczenia = przeznRaw
    ? przeznRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const mediaRaw = (searchParams.get('media') || '').trim();
  const media = mediaRaw
    ? mediaRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Typ oferty (sprzedaż / wynajem): filtr „miękki" jak media/przeznaczenie — nic nie zaznaczone
  // = pokazuj wszystko (i sprzedaż, i wynajem), zaznaczenie zawęża. Zaznaczenie obu = brak zawężenia.
  const transakcjaRaw = (searchParams.get('transakcja') || '').trim();
  const transakcja = transakcjaRaw
    ? transakcjaRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is TransakcjaTyp => s === 'SPRZEDAZ' || s === 'WYNAJEM')
    : [];

  // Tryb mapy (P11): lekki payload wszystkich pasujących pinów zamiast stronicowanej listy.
  const mapMode = searchParams.get('mode') === 'map';

  // BBox „szukaj w tym obszarze" (P11): prostokąt z widoku mapy. Filtr w bazie na indeksie
  // @@index([lat,lng]) — wspólny dla listy i mapy, więc wyniki się nie rozjeżdżają.
  const bboxN = Number(searchParams.get('n'));
  const bboxS = Number(searchParams.get('s'));
  const bboxE = Number(searchParams.get('e'));
  const bboxW = Number(searchParams.get('w'));
  const hasBBox =
    Number.isFinite(bboxN) &&
    Number.isFinite(bboxS) &&
    Number.isFinite(bboxE) &&
    Number.isFinite(bboxW) &&
    bboxN > bboxS &&
    bboxE > bboxW;

  const takeReq = Number(searchParams.get('take') || '20');
  const take = Math.min(Math.max(Number.isFinite(takeReq) ? Math.floor(takeReq) : 20, 1), 100);

  const pageReq = Number(searchParams.get('page') || '1');
  const page = Math.max(Number.isFinite(pageReq) ? Math.floor(pageReq) : 1, 1);

  const skipParam = searchParams.get('skip');
  const skip = skipParam != null ? Math.max(Number(skipParam) || 0, 0) : (page - 1) * take;

  const sortParam = searchParams.get('sort') ?? 'newest';
  const sort = ['newest', 'oldest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'].includes(sortParam)
    ? sortParam
    : 'newest';

  const andFilters: Prisma.DzialkaWhereInput[] = [
    { ownerId: { not: null } },
    { status: DzialkaStatus.AKTYWNE },
    {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  ];

  if (priceMin || priceMax) {
    const cenaPln: Prisma.IntFilter = {};
    if (priceMin) cenaPln.gte = Number(priceMin);
    if (priceMax) cenaPln.lte = Number(priceMax);
    andFilters.push({ cenaPln });
  }

  if (areaMin || areaMax) {
    const powierzchniaM2: Prisma.IntFilter = {};
    if (areaMin) powierzchniaM2.gte = Number(areaMin);
    if (areaMax) powierzchniaM2.lte = Number(areaMax);
    andFilters.push({ powierzchniaM2 });
  }

  if (przeznaczenia.length) {
    andFilters.push({
      przeznaczenia: { hasSome: przeznaczenia as any },
    });
  }

  // length 1 = zawęź do jednego typu; length 2 (oba) = brak zawężenia (= jak nic nie zaznaczone).
  if (transakcja.length === 1) {
    andFilters.push({ transakcja: transakcja[0] });
  }

  // Filtr mediów (P10): zaznaczone medium = działka faktycznie je MA, fizycznie NA DZIAŁCE.
  // Lista dozwolonych statusów (MEDIA_AVAILABLE) jest wspólna z chipem „media" na kartach
  // (src/lib/media.ts) — jedno źródło prawdy, filtr i etykieta nigdy się nie rozjadą.
  for (const key of media) {
    if (key === 'prad') andFilters.push({ prad: { in: [...MEDIA_AVAILABLE.prad] } });
    else if (key === 'woda') andFilters.push({ woda: { in: [...MEDIA_AVAILABLE.woda] } });
    else if (key === 'kanalizacja')
      andFilters.push({ kanalizacja: { in: [...MEDIA_AVAILABLE.kanalizacja] } });
    else if (key === 'gaz') andFilters.push({ gaz: { in: [...MEDIA_AVAILABLE.gaz] } });
  }

  if (hasBBox) {
    andFilters.push({
      lat: { gte: bboxS, lte: bboxN },
      lng: { gte: bboxW, lte: bboxE },
    });
  }

  const where: Prisma.DzialkaWhereInput = {
    AND: andFilters,
  };

  // TRYB MAPY: ta sama logika filtrów (andFilters) i ten sam kontekst dopasowania geo/tekst
  // co lista → to, co widać na mapie, pokrywa się z wynikami listy. Różnica względem listy:
  // zamiast stronicowania ograniczamy się do KADRU mapy i oddajemy albo piny, albo bąble.
  // Payload to gołe minimum pod pin (id/lat/lng/cena/flagi) — resztę karty oferty dociąga
  // MapOfferCard z /api/dzialki/[id], więc mapa nie płaci za zdjęcia, tytuły i loga biur.
  if (mapMode) {
    const ctx = buildSearchContext(searchText, latParam, lngParam, radiusParam, hasRadiusSearch);
    const needsInfo = hasRadiusSearch || Boolean(searchText);

    // Pre-filtr bbox: przy szukaniu z promieniem baza odsiewa oferty poza prostokątem-nadzbiorem
    // zamiast ściągać całą Polskę do Node. Mapa pokazuje tylko oferty ze współrzędnymi, więc
    // wariant „lat IS NULL" tu nie jest potrzebny.
    const mapPrefilter = computeGeoPrefilterBBox(ctx);
    const baseAnd: Prisma.DzialkaWhereInput[] = [
      ...andFilters,
      { lat: { not: null } },
      { lng: { not: null } },
      ...(mapPrefilter
        ? [
            { lat: { gte: mapPrefilter.minLat, lte: mapPrefilter.maxLat } },
            { lng: { gte: mapPrefilter.minLng, lte: mapPrefilter.maxLng } },
          ]
        : []),
    ];

    // Kadr mapy. Osobne parametry niż n/s/e/w — tamte to „szukaj w tym obszarze", czyli
    // trwałe zawężenie LISTY, i muszą działać niezależnie od tego, gdzie akurat patrzymy.
    const viewN = Number(searchParams.get('vn'));
    const viewS = Number(searchParams.get('vs'));
    const viewE = Number(searchParams.get('ve'));
    const viewW = Number(searchParams.get('vw'));
    const hasView =
      Number.isFinite(viewN) && Number.isFinite(viewS) &&
      Number.isFinite(viewE) && Number.isFinite(viewW) &&
      viewN > viewS && viewE > viewW;

    const zoom = Number(searchParams.get('z'));

    // fit=1: klient prosi o ramkę WSZYSTKICH pasujących ofert, żeby dopasować kadr po
    // zmianie filtrów. Liczone poza kadrem (inaczej byłoby błędnym kołem) i jednym tanim
    // zapytaniem agregującym na indeksie, bez ściągania rekordów.
    let bounds: DzialkiMapBody['bounds'] = null;
    if (searchParams.get('fit') === '1') {
      const agg = await prisma.dzialka.aggregate({
        where: { AND: baseAnd },
        _min: { lat: true, lng: true },
        _max: { lat: true, lng: true },
      });
      const { _min, _max } = agg;
      if (_min.lat != null && _min.lng != null && _max.lat != null && _max.lng != null) {
        bounds = { n: _max.lat, s: _min.lat, e: _max.lng, w: _min.lng };
      }
    }

    const viewAnd: Prisma.DzialkaWhereInput[] = hasView
      ? [{ lat: { gte: viewS, lte: viewN } }, { lng: { gte: viewW, lte: viewE } }]
      : [];
    const mapWhere: Prisma.DzialkaWhereInput = { AND: [...baseAnd, ...viewAnd] };

    const pinSelect: Prisma.DzialkaSelect = {
      id: true,
      lat: true,
      lng: true,
      cenaPln: true,
      transakcja: true,
      isFeatured: true,
      featuredUntil: true,
      locationMode: true,
      // Pola tekstowe tylko wtedy, gdy trzeba dopasować zapytanie w JS (ta sama funkcja
      // co lista i alerty). Przy zwykłym przeglądaniu z filtrami nie płacimy za nie w ogóle.
      ...(needsInfo ? { locationLabel: true, locationFull: true, parcelText: true } : {}),
    };

    type PinRow = {
      id: string;
      lat: number;
      lng: number;
      cenaPln: number;
      transakcja: TransakcjaTyp;
      isFeatured: boolean;
      featuredUntil: Date | null;
      locationMode: LocationMode;
      locationLabel?: string | null;
      locationFull?: string | null;
      parcelText?: string | null;
    };

    const toPins = (rows: PinRow[]): MapPin[] =>
      rows.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        cena: r.cenaPln,
        transakcja: r.transakcja,
        featured: isFeaturedActive(r),
        approx: r.locationMode === LocationMode.APPROX,
      }));

    // ŚCIEŻKA Z WYSZUKIWANIEM: dopasowanie liczy JS na polach opisowych (ta sama funkcja
    // co lista i alerty), więc kandydatów trzeba pobrać w całości.
    if (needsInfo) {
      const rows = (await prisma.dzialka.findMany({ where: mapWhere, select: pinSelect })) as PinRow[];
      const matched = rows.filter((r) => getSearchMatchInfo(r, ctx).anyMatch);

      if (matched.length <= PIN_MAX) {
        return { ok: true, total: matched.length, points: toPins(matched), clusters: [], bounds };
      }
      const { clusters, singles } = clusterize(matched, zoom);
      return { ok: true, total: matched.length, points: toPins(singles), clusters, bounds };
    }

    // ŚCIEŻKA BEZ WYSZUKIWANIA (dominujący ruch): dwustopniowo. Najpierw same identyfikatory
    // i współrzędne — do policzenia siatki nic więcej nie jest potrzebne, a to kilka razy
    // mniej danych na łączu do bazy. Pola pinów (cena, flagi) dociągamy drugim, krótkim
    // zapytaniem po kluczu głównym i tylko dla tych ofert, które faktycznie pokażemy.
    const coords = (await prisma.dzialka.findMany({
      where: mapWhere,
      select: { id: true, lat: true, lng: true },
    })) as Array<{ id: string; lat: number; lng: number }>;

    if (!coords.length) return { ok: true, total: 0, points: [], clusters: [], bounds };

    // Mało ofert w kadrze → wszystkie jako piny, bez siatki.
    if (coords.length <= PIN_MAX) {
      const rows = (await prisma.dzialka.findMany({
        where: { id: { in: coords.map((c) => c.id) } },
        select: pinSelect,
      })) as PinRow[];
      return { ok: true, total: coords.length, points: toPins(rows), clusters: [], bounds };
    }

    const grid = clusterize(coords, zoom);
    const singles = grid.singles.length
      ? ((await prisma.dzialka.findMany({
          where: { id: { in: grid.singles.map((s) => s.id) } },
          select: pinSelect,
        })) as PinRow[])
      : [];

    return { ok: true, total: coords.length, points: toPins(singles), clusters: grid.clusters, bounds };
  }

  const searchContext = buildSearchContext(searchText, latParam, lngParam, radiusParam, hasRadiusSearch);
  const needsMatchInfo = hasRadiusSearch || Boolean(searchText);

  const buildMeta = (total: number) => {
    const currentPage = Math.floor(skip / take) + 1;
    const totalPages = Math.max(1, Math.ceil(total / take));
    return { page: currentPage, skip, take, totalPages, hasPrev: skip > 0, hasNext: skip + take < total };
  };

  // ŚCIEŻKA BEZ WYSZUKIWANIA (przeglądanie /kup: same filtry + sort, też bbox „w tym obszarze").
  // Dominujący ruch. Całość w bazie — filtr + sort + paginacja + count (P12) — do Node ląduje
  // tylko jedna strona, niezależnie od liczby ofert. Kolejność 1:1 z dawnym sortem JS, patrz
  // src/lib/dzialkiQuery.ts (wyróżnione-aktywne pierwsze, dla „newest" ze zdjęciami przed bez).
  if (!needsMatchInfo) {
    const { items, total } = await listDzialkiPaginated({
      andFilters,
      sort: sort as ListSort,
      skip,
      take,
    });

    return { ok: true, total, count: total, items, meta: buildMeta(total) };
  }

  // ŚCIEŻKA Z WYSZUKIWANIEM (tekst/promień): dopasowanie geo/tekst jest w JS (wspólna logika
  // src/lib/dzialkiSearch.ts — jedno źródło prawdy z alertami), więc kandydatów trzeba przejrzeć
  // w Node. ALE pobieramy tylko LEKKIE pola (bez zdjęć), rankujemy, a pełne dane + zdjęcia
  // dociągamy WYŁĄCZNIE dla zwróconej strony (≤ take). Koniec pobierania wszystkich zdjęć na raz.
  //
  // Pre-filtr bbox: przy szukaniu z promieniem baza zawęża kandydatów do prostokąta-nadzbioru
  // (koło ∪ miasto ∪ województwo) ZAMIAST ściągać wszystkie aktywne oferty do Node. Oferty bez
  // współrzędnych (mogą trafić tekstem) zostawiamy przez `OR lat/lng IS NULL`. Precyzyjne
  // dopasowanie i tak liczy JS niżej, więc nadzbiór nie zmienia wyników — tylko tnie transferuje
  // rekordów, które i tak by odpadły. Bez promienia (czysty tekst) prefilter = null → jak dotąd.
  const prefilterBBox = computeGeoPrefilterBBox(searchContext);
  const lightWhere: Prisma.DzialkaWhereInput = prefilterBBox
    ? {
        AND: [
          ...andFilters,
          {
            OR: [
              {
                AND: [
                  { lat: { gte: prefilterBBox.minLat, lte: prefilterBBox.maxLat } },
                  { lng: { gte: prefilterBBox.minLng, lte: prefilterBBox.maxLng } },
                ],
              },
              { lat: null },
              { lng: null },
            ],
          },
        ],
      }
    : where;

  const lightRows = await prisma.dzialka.findMany({
    where: lightWhere,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      lat: true,
      lng: true,
      locationLabel: true,
      locationFull: true,
      parcelText: true,
      createdAt: true,
      cenaPln: true,
      powierzchniaM2: true,
      isFeatured: true,
      featuredUntil: true,
      _count: { select: { zdjecia: true } },
    },
  });

  // P3: „match info" liczone RAZ na ofertę (jeden przebieg O(n)), wyróżnione/zdjęcia policzone tu raz.
  const withInfo = lightRows.map((item) => ({
    item,
    info: getSearchMatchInfo(item, searchContext),
    featured: isFeaturedActive(item),
    photos: item._count.zdjecia > 0,
  }));

  const ranked = withInfo.filter((x) => x.info.anyMatch);

  type Ranked = (typeof withInfo)[number];

  // Klucz sortu (bez grupy trafności i bez wyróżnienia). Wspólny dla finalnego rankingu
  // i dla wyboru, które wyróżnione dostają podbicie — żeby obie listy liczyły to samo.
  const compareBySort = (a: Ranked, b: Ranked) => {
    switch (sort) {
      case 'oldest':
        return new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
      case 'price_asc':
        return a.item.cenaPln - b.item.cenaPln;
      case 'price_desc':
        return b.item.cenaPln - a.item.cenaPln;
      case 'area_asc':
        return a.item.powierzchniaM2 - b.item.powierzchniaM2;
      case 'area_desc':
        return b.item.powierzchniaM2 - a.item.powierzchniaM2;
      default: {
        if (a.photos !== b.photos) return a.photos ? -1 : 1;
        if (
          hasRadiusSearch &&
          a.info.radiusDistance !== null &&
          b.info.radiusDistance !== null
        ) {
          return a.info.radiusDistance - b.info.radiusDistance;
        }
        return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
      }
    }
  };

  // Pasmo „polecanych": maks. FEATURED_TOP_CAP wyróżnionych na całą listę dostaje podbicie na górę
  // (wybór wg grupy trafności, potem klucza sortu). Nadmiarowe wyróżnione sortują się organicznie —
  // zielona ramka zostaje (to dane oferty), traci tylko pozycję, żeby przy dużej liczbie
  // wyróżnionych pierwsza strona nie była wyłącznie nimi. Spójne ze ścieżką bez wyszukiwania.
  const boostedFeaturedIds = new Set(
    ranked
      .filter((x) => x.featured)
      .sort((a, b) => {
        if (a.info.group !== b.info.group) return a.info.group - b.info.group;
        return compareBySort(a, b);
      })
      .slice(0, FEATURED_TOP_CAP)
      .map((x) => x.item.id)
  );

  ranked.sort((a, b) => {
    if (a.info.group !== b.info.group) return a.info.group - b.info.group;

    const aBoost = a.featured && boostedFeaturedIds.has(a.item.id);
    const bBoost = b.featured && boostedFeaturedIds.has(b.item.id);
    if (aBoost !== bBoost) return aBoost ? -1 : 1;

    return compareBySort(a, b);
  });

  const total = ranked.length;
  const pageIds = ranked.slice(skip, skip + take).map((x) => x.item.id);

  // Dociągamy pełne rekordy + zdjęcia tylko dla ID z bieżącej strony, w ustalonej kolejności.
  const hydrated = pageIds.length
    ? await prisma.dzialka.findMany({ where: { id: { in: pageIds } }, include: PAGE_INCLUDE })
    : [];
  const byId = new Map(hydrated.map((d) => [d.id, d]));
  const items = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return { ok: true, total, count: total, items, meta: buildMeta(total) };
}
