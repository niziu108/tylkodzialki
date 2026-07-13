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

export type DzialkiListBody =
  | { ok: true; total: number; capped: boolean; points: any[] }
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

  // Tryb mapy: osobne, odchudzone zapytanie (jedno zdjęcie, tylko pola pod pin i popup).
  // Ta sama logika filtrów (andFilters) + ten sam kontekst dopasowania geo/tekst co lista
  // → piny na mapie pokrywają się 1:1 z wynikami listy. Bez stronicowania (wszystkie piny).
  if (mapMode) {
    const ctx = buildSearchContext(searchText, latParam, lngParam, radiusParam, hasRadiusSearch);
    const needsInfo = hasRadiusSearch || Boolean(searchText);

    // Pre-filtr bbox (P?: skalowanie): przy szukaniu z promieniem baza odsiewa piny poza
    // prostokątem-nadzbiorem zamiast ściągać całą Polskę do Node. Mapa i tak pokazuje tylko
    // oferty ze współrzędnymi, więc wariant „lat IS NULL" tu nie jest potrzebny.
    const mapPrefilter = computeGeoPrefilterBBox(ctx);
    const mapGeoAnd: Prisma.DzialkaWhereInput[] = mapPrefilter
      ? [
          { lat: { gte: mapPrefilter.minLat, lte: mapPrefilter.maxLat } },
          { lng: { gte: mapPrefilter.minLng, lte: mapPrefilter.maxLng } },
        ]
      : [];

    const rows = await prisma.dzialka.findMany({
      where: {
        AND: [...andFilters, { lat: { not: null } }, { lng: { not: null } }, ...mapGeoAnd],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lat: true,
        lng: true,
        cenaPln: true,
        powierzchniaM2: true,
        transakcja: true,
        tytul: true,
        przeznaczenia: true,
        prad: true,
        woda: true,
        kanalizacja: true,
        gaz: true,
        sprzedajacyTyp: true,
        biuroNazwa: true,
        biuroLogoUrl: true,
        owner: { select: { defaultBiuroLogoUrl: true, defaultBiuroLogoBg: true, defaultBiuroNazwa: true } },
        isFeatured: true,
        featuredUntil: true,
        createdAt: true,
        locationLabel: true,
        locationFull: true,
        parcelText: true,
        locationMode: true,
        zdjecia: {
          take: 1,
          orderBy: { kolejnosc: 'asc' },
          select: { url: true },
        },
      },
    });

    const matched = needsInfo
      ? rows.filter((r) => getSearchMatchInfo(r, ctx).anyMatch)
      : rows;

    // Wyróżnione piny pierwsze (renderują się na wierzchu), reszta od najnowszych.
    matched.sort((a, b) => {
      const af = isFeaturedActive(a);
      const bf = isFeaturedActive(b);
      if (af !== bf) return af ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const CAP = 4000;
    const points = matched.slice(0, CAP).map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      cena: r.cenaPln,
      area: r.powierzchniaM2,
      transakcja: r.transakcja,
      tytul: r.tytul,
      przezn: r.przeznaczenia,
      featured: isFeaturedActive(r),
      thumb: r.zdjecia[0]?.url ?? null,
      loc: r.locationLabel ?? null,
      approx: r.locationMode === LocationMode.APPROX,
      prad: r.prad,
      woda: r.woda,
      kanalizacja: r.kanalizacja,
      gaz: r.gaz,
      sprzedajacyTyp: r.sprzedajacyTyp,
      biuroNazwa: r.biuroNazwa ?? r.owner?.defaultBiuroNazwa ?? null,
      biuroLogoUrl: r.biuroLogoUrl ?? r.owner?.defaultBiuroLogoUrl ?? null,
      biuroLogoBg: r.owner?.defaultBiuroLogoBg ?? false,
    }));

    return {
      ok: true,
      total: matched.length,
      capped: matched.length > CAP,
      points,
    };
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
