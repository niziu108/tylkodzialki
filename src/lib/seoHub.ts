// Hub SEO (P13) — liczenie ofert per obszar/typ po stronie serwera.
//
// Zasady:
//   - Zero migracji, zero ruszania danych. Liczymy na istniejącym @@index([lat,lng]).
//   - Filtr „aktywności" 1:1 z API listy (app/api/dzialki/route.ts): ownerId != null,
//     status AKTYWNE, nie wygasłe.
//   - DOPASOWANIE MIASTA dokładnie jak lista: ta sama logika geo (buildSearchContext +
//     getSearchMatchInfo, center + promień + nazwa miasta) co `/api/dzialki`, więc licznik
//     przy linku == „Wyniki: N" na stronie miasta (dla głównych miast lista obejmuje też
//     rozszerzony bbox miasta, nie tylko sam promień — to też uwzględniamy).
//   - DOPASOWANIE WOJEWÓDZTWA tym samym prostokątem (bbox) co lista województwa (tryb bbox).
//   - Wynik per typ = liczba ofert mających dane przeznaczenie (hasSome) — jak filtr listy.

import { cache } from 'react';
import {
  DzialkaStatus,
  SprzedajacyTyp,
  type PradStatus,
  type Przeznaczenie,
  type WodaStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type BBox,
  buildSearchContext,
  getSearchMatchInfo,
  getVoivodeshipByKey,
} from '@/lib/dzialkiSearch';
import {
  SEO_TYPES,
  SEO_REGIONS,
  getSeoCity,
  getSeoRegion,
  type SeoCity,
  type SeoType,
} from '@/lib/seo-locations';

// Promień listy/licznika miasta (km). Zgodny z dotychczasową stroną „budowlane" (radiusKm: 40).
export const CITY_RADIUS_KM = 40;

const KM_PER_DEG_LAT = 111.32;

type GeoRow = { lat: number; lng: number; przeznaczenia: Przeznaczenie[] };

export type AreaStats = {
  total: number;
  // klucz = slug typu (np. 'budowlane'), wartość = liczba ofert tego typu w obszarze
  byType: Record<string, number>;
};

const ENUM_TO_SLUG: Record<string, string> = Object.fromEntries(
  SEO_TYPES.map((t) => [t.enum, t.slug])
);

function boxAround(lat: number, lng: number, km: number): BBox {
  const dLat = km / KM_PER_DEG_LAT;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = km / (KM_PER_DEG_LAT * Math.max(Math.abs(cos), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

function unionBox(a: BBox, b: BBox): BBox {
  return {
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
    minLng: Math.min(a.minLng, b.minLng),
    maxLng: Math.max(a.maxLng, b.maxLng),
  };
}

async function queryGeo(box: BBox | null): Promise<GeoRow[]> {
  const now = new Date();
  const rows = await prisma.dzialka.findMany({
    where: {
      ownerId: { not: null },
      status: DzialkaStatus.AKTYWNE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      lat: box ? { gte: box.minLat, lte: box.maxLat } : { not: null },
      lng: box ? { gte: box.minLng, lte: box.maxLng } : { not: null },
    },
    select: { lat: true, lng: true, przeznaczenia: true },
  });

  return rows.filter((r): r is GeoRow => r.lat !== null && r.lng !== null);
}

export function bucketByType(rows: { przeznaczenia: Przeznaczenie[] }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of SEO_TYPES) out[t.slug] = 0;

  for (const r of rows) {
    const seen = new Set<string>();
    for (const p of r.przeznaczenia) {
      const slug = ENUM_TO_SLUG[p];
      if (slug && !seen.has(slug)) {
        out[slug] += 1;
        seen.add(slug);
      }
    }
  }

  return out;
}

// Kontekst dopasowania miasta — identyczny z tym, co buduje /api/dzialki dla listy miasta
// (nazwa miasta jako zapytanie + center + promień).
function cityContext(city: SeoCity) {
  return buildSearchContext(city.name, city.lat, city.lng, CITY_RADIUS_KM, true);
}

function matchCity(rows: GeoRow[], ctx: ReturnType<typeof cityContext>): GeoRow[] {
  return rows.filter((r) => getSearchMatchInfo(r, ctx).anyMatch);
}

// Cache na poziomie żądania (klucze prymitywne), by generateMetadata i body strony
// nie odpytywały bazy dwa razy.
const loadCityMatched = cache(async (citySlug: string): Promise<GeoRow[]> => {
  const city = getSeoCity(citySlug);
  if (!city) return [];

  const ctx = cityContext(city);
  // Prostokąt kandydatów obejmujący i promień, i (dla głównych miast) rozszerzony bbox miasta.
  const radiusBox = boxAround(city.lat, city.lng, CITY_RADIUS_KM);
  const loadBox = ctx.cityBBox ? unionBox(radiusBox, ctx.cityBBox) : radiusBox;

  const rows = await queryGeo(loadBox);
  return matchCity(rows, ctx);
});

// Statystyki miasta: total + per typ (dokładnie jak lista miasta).
export const getCityStats = cache(async (citySlug: string): Promise<AreaStats> => {
  const rows = await loadCityMatched(citySlug);
  return { total: rows.length, byType: bucketByType(rows) };
});

// Statystyki województwa: total (cały bbox, jak lista trybu bbox) + per typ + liczba ofert
// wokół każdego miasta regionu (ta sama liczba, którą pokaże strona danego miasta).
export const getVoivodeshipStats = cache(
  async (
    slug: string
  ): Promise<AreaStats & { cityCounts: Record<string, number> }> => {
    const area = getVoivodeshipByKey(slug);
    const rows = area ? await queryGeo(area.bbox) : [];
    const region = getSeoRegion(slug);

    const cityCounts: Record<string, number> = {};
    if (region) {
      for (const c of region.cities) {
        cityCounts[c.slug] = (await getCityStats(c.slug)).total;
      }
    }

    return { total: rows.length, byType: bucketByType(rows), cityCounts };
  }
);

// Sumy per województwo (dla strony-huba /dzialki). Jeden odczyt + bucketowanie w pamięci.
export const getRegionTotals = cache(async (): Promise<Record<string, number>> => {
  const rows = await queryGeo(null);
  const totals: Record<string, number> = {};

  for (const region of SEO_REGIONS) {
    const area = getVoivodeshipByKey(region.slug);
    totals[region.slug] = area
      ? rows.filter(
          (r) =>
            r.lat >= area.bbox.minLat &&
            r.lat <= area.bbox.maxLat &&
            r.lng >= area.bbox.minLng &&
            r.lng <= area.bbox.maxLng
        ).length
      : 0;
  }

  return totals;
});

// ─────────────────────────────────────────────────────────────────────────────
// P21: metryki lokalne per miasto×typ (do unikalnego opisu + FAQ na stronie kategorii).
//
// Liczone z tej samej dopasowanej puli co licznik (ten sam promień/bbox, ta sama logika
// geo), więc liczby zgadzają się z listą. Osobny, cięższy select (cena, powierzchnia,
// typ sprzedającego, media, MPZP/WZ) uruchamiany TYLKO przy renderze strony kategorii
// (zasięg miasta ~40 km, mała pula) — NIE dokładamy tych kolumn do odczytów całej bazy
// (sitemap, sumy województw), które potrzebują wyłącznie liczników.
//
// Uczciwość ([[feedback-filtry-twarde]]): przy małej próbce zwracamy `null` zamiast mylącej
// mediany/udziału. Strona pokazuje wtedy „za mało ofert", nie zmyśloną liczbę.

// Minimalna próbka, przy której podajemy medianę/zakres ceny i udziały cech.
export const MIN_SAMPLE = 4;

// Zakres odporny na outliery: low=10. percentyl, high=90. percentyl (a NIE surowe min/max,
// które ciągną pojedyncze śmieciowe ogłoszenia, np. „3 zł/m²"). Mediana w środku.
export type RangeStat = { low: number; median: number; high: number };

export type CategoryDetail = {
  count: number;
  privateCount: number;
  officeCount: number;
  // zł/m² (mediana + zakres) — null, gdy za mało ofert z ceną i powierzchnią
  pricePerM2: RangeStat | null;
  // cena całkowita (zł)
  totalPrice: RangeStat | null;
  // powierzchnia (m²)
  areaM2: RangeStat | null;
  // udział 0..1 ofert „uzbrojonych twardo" (prąd + woda NA DZIAŁCE) — null przy małej próbce
  uzbrojoneShare: number | null;
  // udział 0..1 ofert z MPZP lub wydanym WZ — null przy małej próbce
  planShare: number | null;
};

type DetailRow = {
  lat: number;
  lng: number;
  przeznaczenia: Przeznaczenie[];
  cenaPln: number;
  powierzchniaM2: number;
  sprzedajacyTyp: SprzedajacyTyp;
  prad: PradStatus;
  woda: WodaStatus;
  mpzp: boolean;
  wzWydane: boolean;
};

// Percentyl metodą interpolacji liniowej (p w 0..1) na posortowanej tablicy.
function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function rangeStat(values: number[]): RangeStat | null {
  if (values.length < MIN_SAMPLE) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    low: percentile(sorted, 0.1),
    median: percentile(sorted, 0.5),
    high: percentile(sorted, 0.9),
  };
}

// Strukturalny zestaw pól potrzebny do policzenia metryk (DetailRow z miasta i wiersze
// powiatu z seoPowiaty.ts spełniają go z nadmiarem).
export type DetailStatRow = {
  przeznaczenia: Przeznaczenie[];
  cenaPln: number;
  powierzchniaM2: number;
  sprzedajacyTyp: SprzedajacyTyp;
  prad: PradStatus;
  woda: WodaStatus;
  mpzp: boolean;
  wzWydane: boolean;
};

// „Uzbrojona twardo": prąd i woda fizycznie na działce (nie „w drodze/możliwość").
function isUzbrojona(r: DetailStatRow): boolean {
  const pradOk = r.prad === 'PRZYLACZE_NA_DZIALCE';
  const wodaOk = r.woda === 'WODOCIAG_NA_DZIALCE' || r.woda === 'STUDNIA_GLEBINOWA';
  return pradOk && wodaOk;
}

// Liczy metryki (CategoryDetail) z gotowego zbioru wierszy. Wspólne dla strony kategorii
// (miasto×typ) i powiatu — type-filtrowanie/dopasowanie obszaru robi się PRZED wywołaniem.
export function computeDetail(rows: DetailStatRow[]): CategoryDetail {
  const count = rows.length;
  const privateCount = rows.filter((r) => r.sprzedajacyTyp === SprzedajacyTyp.PRYWATNIE).length;

  const ppm2: number[] = [];
  const totals: number[] = [];
  const areas: number[] = [];
  for (const r of rows) {
    if (r.cenaPln > 0 && r.powierzchniaM2 > 0) {
      ppm2.push(Math.round(r.cenaPln / r.powierzchniaM2));
      totals.push(r.cenaPln);
    }
    if (r.powierzchniaM2 > 0) areas.push(r.powierzchniaM2);
  }

  const enoughForShare = count >= MIN_SAMPLE;

  return {
    count,
    privateCount,
    officeCount: count - privateCount,
    pricePerM2: rangeStat(ppm2),
    totalPrice: rangeStat(totals),
    areaM2: rangeStat(areas),
    uzbrojoneShare: enoughForShare ? rows.filter(isUzbrojona).length / count : null,
    planShare: enoughForShare ? rows.filter((r) => r.mpzp || r.wzWydane).length / count : null,
  };
}

// Odczyt szczegółowy puli miasta (z cenami/cechami), dopasowany tą samą logiką co licznik.
const loadCityDetailRows = cache(async (citySlug: string): Promise<DetailRow[]> => {
  const city = getSeoCity(citySlug);
  if (!city) return [];

  const ctx = cityContext(city);
  const radiusBox = boxAround(city.lat, city.lng, CITY_RADIUS_KM);
  const loadBox = ctx.cityBBox ? unionBox(radiusBox, ctx.cityBBox) : radiusBox;

  const now = new Date();
  const rows = await prisma.dzialka.findMany({
    where: {
      ownerId: { not: null },
      status: DzialkaStatus.AKTYWNE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      lat: { gte: loadBox.minLat, lte: loadBox.maxLat },
      lng: { gte: loadBox.minLng, lte: loadBox.maxLng },
    },
    select: {
      lat: true,
      lng: true,
      przeznaczenia: true,
      cenaPln: true,
      powierzchniaM2: true,
      sprzedajacyTyp: true,
      prad: true,
      woda: true,
      mpzp: true,
      wzWydane: true,
    },
  });

  return rows
    .filter((r): r is DetailRow => r.lat !== null && r.lng !== null)
    .filter((r) => getSearchMatchInfo(r, ctx).anyMatch);
});

// Metryki dla jednej strony kategorii (miasto + typ). Filtruje pulę miasta po przeznaczeniu.
export const getCategoryDetail = cache(
  async (citySlug: string, typeEnum: Przeznaczenie): Promise<CategoryDetail> => {
    const all = await loadCityDetailRows(citySlug);
    return computeDetail(all.filter((r) => r.przeznaczenia.includes(typeEnum)));
  }
);

// ── Strona cenowa /ceny/[miasto] ────────────────────────────────────────────────
// „Money page" na zapytanie „ceny/ile kosztuje działka w X": jeden komplet metryk dla
// całego miasta + rozbicie po typach, żeby stronę PROWADZIĆ liczbą (mediana zł/m²), a nie
// chować ją pod listą ofert. Ten sam silnik (computeDetail) i JEDEN cache'owany odczyt
// puli miasta co strony kategorii — spójne liczby, zero dodatkowych zapytań.
// Okno „typowej działki budowlanej" pod dom. Uczciwie odpowiada na zapytanie kupującego:
// bardzo duże grunty (inwestycyjne/rolne w przebraniu budowlanych) mają z natury niższą
// stawkę zł/m² i zaniżają medianę całej puli, więc do liczby wiodącej bierzemy tylko
// działki w rozsądnym metrażu. Poniżej progu próbki wracamy do pełnej puli budowlanych.
export const TYPICAL_BUILD_MIN_M2 = 300;
export const TYPICAL_BUILD_MAX_M2 = 3000;

export type CityPriceBoard = {
  overall: CategoryDetail;
  byType: { type: SeoType; detail: CategoryDetail }[]; // tylko typy z >0 ofert, malejąco po liczbie
  // Typowe działki budowlane (metraż w oknie powyżej) — liczba wiodąca strony cenowej.
  // null, gdy próbka za mała na wiarygodną medianę (wtedy strona używa pełnej puli budowlanych).
  budowlanaTypical: CategoryDetail | null;
};

export const getCityPriceBoard = cache(async (citySlug: string): Promise<CityPriceBoard> => {
  const all = await loadCityDetailRows(citySlug);
  const overall = computeDetail(all);
  const byType = SEO_TYPES.map((type) => ({
    type,
    detail: computeDetail(all.filter((r) => r.przeznaczenia.includes(type.enum))),
  }))
    .filter((x) => x.detail.count > 0)
    .sort((a, b) => b.detail.count - a.detail.count);

  const typicalRows = all.filter(
    (r) =>
      r.przeznaczenia.includes('BUDOWLANA') &&
      r.powierzchniaM2 >= TYPICAL_BUILD_MIN_M2 &&
      r.powierzchniaM2 <= TYPICAL_BUILD_MAX_M2
  );
  const typicalDetail = computeDetail(typicalRows);
  // Uznajemy tylko, gdy realnie policzyliśmy medianę (computeDetail zwraca null przy < MIN_SAMPLE).
  const budowlanaTypical = typicalDetail.pricePerM2 ? typicalDetail : null;

  return { overall, byType, budowlanaTypical };
});

// ─────────────────────────────────────────────────────────────────────────────
// P24: wycena punktowa dla narzędzia „Sprawdź działkę".
//
// Dla dowolnego punktu (pinezka/adres/numer wskazany przez użytkownika) liczymy orientacyjną
// medianę + zakres zł/m² z NASZYCH aktywnych ofert w promieniu `km`. Ten sam silnik co strony
// kategorii (computeDetail), zero migracji (liczone na @@index([lat,lng])). Uczciwie: przy < MIN_SAMPLE
// ofert z ceną zwracamy `null` (UI pokaże „za mało danych", nie zmyśloną liczbę,
// [[feedback-filtry-twarde]]).

// Udział ofert w okolicy z danym medium FIZYCZNIE NA DZIAŁCE (0..1). Uczciwa odpowiedź na pytanie
// „czy jest tu prąd/wodociąg" — z naszych danych, bez zmyślania odległości do rury
// ([[feedback-filtry-twarde]]). null przy zbyt małej próbce.
export type MediaShares = {
  prad: number;
  woda: number;
  gaz: number;
  kanalizacja: number;
};

// Jedno „rozbicie" cenowe: mediana zł/m² + liczba ofert, na których ją policzono.
// pricePerM2 = null, gdy podpróbka nie dobija MIN_SAMPLE (nie zmyślamy przy 1-2 ofertach).
export type PriceStat = { pricePerM2: RangeStat | null; sampleCount: number };

export type PointValuation = {
  // mediana + zakres p10..p90 zł/m² ze WSZYSTKICH ofert w okolicy; null przy zbyt małej próbce
  pricePerM2: RangeStat | null;
  // liczba ofert z ceną i powierzchnią, na których policzono medianę
  sampleCount: number;
  // rozbicie: same działki budowlane, oraz budowlane uzbrojone „twardo" vs bez uzbrojenia.
  // Każde świeci tylko przy wystarczającej próbce — inaczej pricePerM2 = null i UI je chowa.
  budowlana: PriceStat;
  budowlanaUzbrojona: PriceStat;
  budowlanaNieuzbrojona: PriceStat;
  // liczba wszystkich aktywnych ofert w promieniu (baza dla „media w okolicy")
  offersNearby: number;
  // udział ofert z danym medium na działce; null gdy za mało ofert
  mediaShares: MediaShares | null;
  radiusKm: number;
};

// Odległość równopłaszczyznowa (equirectangular) w km — wystarczająco dokładna w skali kilku km.
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * (Math.PI / 180) * KM_PER_DEG_LAT;
  const meanLat = ((aLat + bLat) / 2) * (Math.PI / 180);
  const dLng = (bLng - aLng) * (Math.PI / 180) * KM_PER_DEG_LAT * Math.cos(meanLat);
  return Math.hypot(dLat, dLng);
}

export const getPointValuation = cache(
  async (lat: number, lng: number, km = 10): Promise<PointValuation> => {
    const box = boxAround(lat, lng, km);
    const now = new Date();

    const rows = await prisma.dzialka.findMany({
      where: {
        ownerId: { not: null },
        status: DzialkaStatus.AKTYWNE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        lat: { gte: box.minLat, lte: box.maxLat },
        lng: { gte: box.minLng, lte: box.maxLng },
      },
      select: {
        lat: true,
        lng: true,
        przeznaczenia: true,
        cenaPln: true,
        powierzchniaM2: true,
        sprzedajacyTyp: true,
        prad: true,
        woda: true,
        kanalizacja: true,
        gaz: true,
        mpzp: true,
        wzWydane: true,
      },
    });

    // Prostokąt -> realny promień (róg bboxa jest dalej niż km).
    const near = rows.filter(
      (r): r is typeof r & { lat: number; lng: number } =>
        r.lat !== null && r.lng !== null && distanceKm(lat, lng, r.lat, r.lng) <= km
    );

    const detail = computeDetail(near);
    const sampleCount = near.filter((r) => r.cenaPln > 0 && r.powierzchniaM2 > 0).length;

    // Rozbicie cenowe bez dodatkowych zapytań — te same wiersze, filtrowane w pamięci.
    const priceStat = (subset: typeof near): PriceStat => {
      const ppm2: number[] = [];
      for (const r of subset) {
        if (r.cenaPln > 0 && r.powierzchniaM2 > 0) ppm2.push(Math.round(r.cenaPln / r.powierzchniaM2));
      }
      return { pricePerM2: rangeStat(ppm2), sampleCount: ppm2.length };
    };
    const budowlaneRows = near.filter((r) => r.przeznaczenia.includes('BUDOWLANA'));
    const budUzbr = budowlaneRows.filter(isUzbrojona);
    const budNieuzbr = budowlaneRows.filter((r) => !isUzbrojona(r));

    // Media „twardo na działce" (spójnie z filtrami listy). null przy próbce < MIN_SAMPLE.
    const mediaShares =
      near.length >= MIN_SAMPLE
        ? {
            prad: near.filter((r) => r.prad === 'PRZYLACZE_NA_DZIALCE').length / near.length,
            woda: near.filter((r) => r.woda === 'WODOCIAG_NA_DZIALCE').length / near.length,
            gaz: near.filter((r) => r.gaz === 'GAZ_NA_DZIALCE').length / near.length,
            kanalizacja:
              near.filter((r) => r.kanalizacja === 'MIEJSKA_NA_DZIALCE').length / near.length,
          }
        : null;

    return {
      pricePerM2: detail.pricePerM2,
      sampleCount,
      budowlana: priceStat(budowlaneRows),
      budowlanaUzbrojona: priceStat(budUzbr),
      budowlanaNieuzbrojona: priceStat(budNieuzbr),
      offersNearby: near.length,
      mediaShares,
      radiusKm: km,
    };
  }
);

// Wpisy huba do sitemapy: dla każdego miasta total + per typ (jeden odczyt całej bazy,
// dopasowanie miasta tą samą logiką co strony — spójne z noindex).
export type HubCityEntry = { citySlug: string; total: number; byType: Record<string, number> };

export const getHubSitemapEntries = cache(async (): Promise<HubCityEntry[]> => {
  const all = await queryGeo(null);
  const entries: HubCityEntry[] = [];

  for (const region of SEO_REGIONS) {
    for (const c of region.cities) {
      const matched = matchCity(all, cityContext(c));
      entries.push({ citySlug: c.slug, total: matched.length, byType: bucketByType(matched) });
    }
  }

  return entries;
});
