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
import { DzialkaStatus, type Przeznaczenie } from '@prisma/client';
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

function bucketByType(rows: GeoRow[]): Record<string, number> {
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
