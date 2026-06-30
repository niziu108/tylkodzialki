// Paginacja listy ofert PO STRONIE BAZY (P12 — skalowanie pod 50k+).
//
// Dawniej `GET /api/dzialki` pobierał CAŁĄ aktywną tabelę ze wszystkimi zdjęciami do Node,
// sortował w JS i wycinał stronę przez `slice`. Przy 3 tys. działało, przy 50 tys. by padło
// (transfer, pamięć, timeout funkcji). Tu robimy WSZYSTKO w bazie: filtr + sort + paginacja +
// count, więc do Node ląduje tylko jedna strona (≤ take), niezależnie od liczby ofert.
//
// Kolejność musi być 1:1 z dawnym sortem JS, który robił:
//   1) wyróżnione-aktywne pierwsze (dla KAŻDEGO sortu), ale maks. FEATURED_TOP_CAP na czele
//      całej listy („pasmo polecanych"); nadmiarowe wyróżnione spadają do kolejności organicznej
//      (zachowują tylko zieloną ramkę), żeby pierwsza strona nie była samymi wyróżnionymi,
//   2) dla `newest`: oferty ZE zdjęciami przed tymi bez,
//   3) klucz sortu (data/cena/powierzchnia),
//   4) stabilnie (równe → dotychczasowa kolejność = createdAt desc).
// „Wyróżnione-aktywne" i „ze zdjęciami" to warunki wyliczane (Prisma `orderBy` ich nie wyrazi),
// więc rozbijamy zbiór na rozłączne, uporządkowane SEGMENTY i stronicujemy w poprzek nich.
// Każdy segment to zwykłe `where`+`orderBy`+`skip`/`take` w bazie → skaluje się i nie duplikuje
// logiki filtrów (segmenty doklejają warunki do tych samych `andFilters` co reszta endpointu).

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ListSort =
  | 'newest'
  | 'oldest'
  | 'price_asc'
  | 'price_desc'
  | 'area_asc'
  | 'area_desc';

// Zdjęcia tylko dla zwróconej strony (≤ take), w tej samej kolejności co dotąd.
// Logo/nazwa biura z konta właściciela — fallback dla karty, gdy oferta nie ma własnego
// (importy CRM nie ustawiają `biuroLogoUrl`, a logo żyje w `User.defaultBiuroLogoUrl`).
export const PAGE_INCLUDE = {
  zdjecia: { orderBy: { kolejnosc: 'asc' } },
  owner: { select: { defaultBiuroLogoUrl: true, defaultBiuroLogoBg: true, defaultBiuroNazwa: true } },
} satisfies Prisma.DzialkaInclude;

// Ile wyróżnionych maks. ląduje w „paśmie polecanych" na samej górze listy (per ZESTAW wyników,
// nie per strona). Powyżej tego nadmiarowe wyróżnione sortują się jak zwykłe oferty (kafelek dalej
// ma zieloną ramkę — traci tylko pozycję). Pasmo na górze jak w dużych portalach (Otodom), żeby
// przy dużej liczbie wyróżnionych pierwsza strona nie była wyłącznie nimi. Jedna liczba do zmiany.
export const FEATURED_TOP_CAP = 3;

// Klucz sortu W OBRĘBIE segmentu. `{ id: 'desc' }` na końcu = deterministyczny rozjemca
// (dawny sort JS był stabilny na pobraniu „createdAt desc", ale dla identycznego createdAt
// kolejność była nieokreślona; tu jest stała → stabilna paginacja między żądaniami).
function sortOrderBy(sort: ListSort): Prisma.DzialkaOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }, { id: 'desc' }];
    case 'price_asc':
      return [{ cenaPln: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'price_desc':
      return [{ cenaPln: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'area_asc':
      return [{ powierzchniaM2: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'area_desc':
      return [{ powierzchniaM2: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    default: // newest
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

type Segment = {
  where: Prisma.DzialkaWhereInput;
  orderBy: Prisma.DzialkaOrderByWithRelationInput[];
};

// Rozłączne, uporządkowane segmenty, których sklejenie = dokładna globalna kolejność.
// `boostedIds` = wyróżnione w paśmie „polecanych" na górze (≤ FEATURED_TOP_CAP). Nadmiarowe
// wyróżnione NIE są tu podbijane — wpadają do segmentu organicznego razem z nie-wyróżnionymi
// (po ID: `notIn boostedIds`), więc sortują się normalnym kluczem sortu.
function buildSegments(
  andFilters: Prisma.DzialkaWhereInput[],
  sort: ListSort,
  boostedIds: string[]
): Segment[] {
  const orderBy = sortOrderBy(sort);
  const hasBoost = boostedIds.length > 0;

  // Pasmo na górze vs reszta — rozłączny podział po ID. Gdy brak wyróżnionych: tylko „reszta"
  // (bez filtra ID), czyli cała lista organicznie — jak dawniej, gdy nie było co podbijać.
  const boostBand: Prisma.DzialkaWhereInput[] = [{ id: { in: boostedIds } }];
  const organic: Prisma.DzialkaWhereInput[] = hasBoost ? [{ id: { notIn: boostedIds } }] : [];
  const groups = hasBoost ? [boostBand, organic] : [organic];

  const hasPhotos: Prisma.DzialkaWhereInput[] = [{ zdjecia: { some: {} } }];
  const noPhotos: Prisma.DzialkaWhereInput[] = [{ zdjecia: { none: {} } }];

  // Tylko `newest` miał dodatkowy podział „ze zdjęciami najpierw"; pozostałe sorty go nie mają.
  if (sort === 'newest') {
    const segments: Segment[] = [];
    for (const g of groups) {
      for (const p of [hasPhotos, noPhotos]) {
        segments.push({ where: { AND: [...andFilters, ...g, ...p] }, orderBy });
      }
    }
    return segments;
  }

  return groups.map((g) => ({ where: { AND: [...andFilters, ...g] }, orderBy }));
}

export type PaginatedResult = {
  items: Prisma.DzialkaGetPayload<{ include: typeof PAGE_INCLUDE }>[];
  total: number;
};

// Stronicowanie w poprzek segmentów. Liczy count każdego segmentu (suma = total), a dane pobiera
// tylko z segmentów nachodzących na okno [skip, skip+take) — zwykle 1, czasem 2 zapytania.
export async function listDzialkiPaginated(opts: {
  andFilters: Prisma.DzialkaWhereInput[];
  sort: ListSort;
  skip: number;
  take: number;
  // Opcjonalny klient transakcji — pozwala wywołać funkcję wewnątrz `$transaction`
  // (np. dla spójnej migawki). Domyślnie globalny klient.
  client?: Prisma.TransactionClient;
}): Promise<PaginatedResult> {
  const { andFilters, sort, skip, take } = opts;
  const db = opts.client ?? prisma;
  const now = new Date();

  // Pasmo „polecanych": ID maks. FEATURED_TOP_CAP wyróżnionych-aktywnych, które trafią na górę.
  // Wybór wg klucza sortu (dla `newest` = najnowsze; podział „ze zdjęciami" dotyczy już tylko
  // wyświetlania pasma, nie wyboru). Reszta wyróżnionych wpada do segmentów organicznych.
  const boosted = await db.dzialka.findMany({
    where: { AND: [...andFilters, { isFeatured: true }, { featuredUntil: { gt: now } }] },
    orderBy: sortOrderBy(sort),
    take: FEATURED_TOP_CAP,
    select: { id: true },
  });
  const boostedIds = boosted.map((b) => b.id);

  const segments = buildSegments(andFilters, sort, boostedIds);

  const counts = await Promise.all(
    segments.map((s) => db.dzialka.count({ where: s.where }))
  );
  const total = counts.reduce((a, b) => a + b, 0);

  const items: PaginatedResult['items'] = [];
  let consumed = 0;

  for (let i = 0; i < segments.length && items.length < take; i++) {
    const segStart = consumed;
    const segEnd = segStart + counts[i];
    consumed = segEnd;

    // Przecięcie okna strony [skip, skip+take) z zakresem segmentu [segStart, segEnd).
    const lo = Math.max(skip, segStart);
    const hi = Math.min(skip + take, segEnd);
    if (lo >= hi) continue;

    const segItems = await db.dzialka.findMany({
      where: segments[i].where,
      orderBy: segments[i].orderBy,
      skip: lo - segStart,
      take: hi - lo,
      include: PAGE_INCLUDE,
    });
    items.push(...segItems);
  }

  return { items, total };
}
