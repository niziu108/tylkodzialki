// Ceny działek budowlanych w skali kraju: Polska, 16 województw i miasta huba (indeks /ceny).
//
// Zasady:
//   - JEDNA liczba w całym serwisie: mediana miasta = computeDetail na tej samej puli co
//     /ceny/[miasto] (matchCityPool), bez innego filtra metrażu i bez drugiej mediany.
//   - Województwo liczymy WPROST z ofert w jego granicach (`adminWoj` z ULDK, zapas: ostatni
//     token `locationFull`), a NIE z median miast: pule miast to koła ~40 km, które na siebie
//     zachodzą i wychodzą za granicę województwa, więc ich agregat byłby nieuczciwy.
//   - Wszystko z jednego odczytu bazy (loadActivePricePool), dopasowanie w pamięci.
//   - To ceny OFERTOWE z aktywnych ogłoszeń, nie transakcyjne (RCN jest tylko przy działce).

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { normalizeText } from '@/lib/dzialkiSearch';
import {
  computeDetail,
  loadActivePricePool,
  matchCityPool,
  type CategoryDetail,
  type PricePoolRow,
} from '@/lib/seoHub';
import { SEO_REGIONS, getSeoRegion, type SeoCity, type SeoRegion } from '@/lib/seo-locations';

// Klucze trendu w CityPriceDailyStat obok slugów miast. Slugi miast nie zawierają dwukropka,
// a „pl" nie jest miastem, więc przestrzenie kluczy się nie mieszają.
export const PRICE_KEY_POLSKA = 'pl';
export function regionPriceKey(regionSlug: string): string {
  return `woj:${regionSlug}`;
}

function toSlug(s: string): string {
  return normalizeText(s).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Województwo oferty: kolumna z ULDK (pewna), zapasowo ostatni token `locationFull`.
 * Porównujemy CAŁY slug, nie podciąg, więc „pomorskie" nie łapie „zachodniopomorskiego".
 */
export function regionOfRow(row: {
  adminWoj?: string | null;
  locationFull?: string | null;
}): SeoRegion | null {
  if (row.adminWoj) {
    const r = getSeoRegion(toSlug(row.adminWoj));
    if (r) return r;
  }
  const last = row.locationFull?.split(',').pop()?.trim();
  if (!last) return null;
  return getSeoRegion(toSlug(last.replace(/^wojew[oó]dztwo\s+/i, ''))) ?? null;
}

const isBudowlana = (r: PricePoolRow) => r.przeznaczenia.includes('BUDOWLANA');

export type PolandPriceBoard = {
  computedAt: string; // ISO, moment policzenia (do „stan na")
  national: CategoryDetail;
  regions: { region: SeoRegion; detail: CategoryDetail }[]; // kolejność jak SEO_REGIONS
  cities: { city: SeoCity; region: SeoRegion; detail: CategoryDetail }[];
};

export function computePolandPriceBoard(rows: PricePoolRow[]): PolandPriceBoard {
  const building = rows.filter(isBudowlana);

  const byRegion = new Map<string, PricePoolRow[]>();
  for (const r of building) {
    const region = regionOfRow(r);
    if (!region) continue;
    const list = byRegion.get(region.slug) ?? [];
    list.push(r);
    byRegion.set(region.slug, list);
  }

  return {
    computedAt: new Date().toISOString(),
    national: computeDetail(building),
    regions: SEO_REGIONS.map((region) => ({
      region,
      detail: computeDetail(byRegion.get(region.slug) ?? []),
    })),
    cities: SEO_REGIONS.flatMap((region) =>
      region.cities.map((city) => ({
        city,
        region,
        detail: computeDetail(matchCityPool(building, city)),
      }))
    ),
  };
}

// Liczone raz na godzinę i współdzielone przez stronę główną i /ceny (różne revalidate stron,
// jeden odczyt bazy). React `cache` dokłada deduplikację w obrębie jednego renderu.
const cachedBoard = unstable_cache(
  async (): Promise<PolandPriceBoard> => computePolandPriceBoard(await loadActivePricePool()),
  ['poland-price-board-v1'],
  { revalidate: 3600 }
);

export const getPolandPriceBoard = cache(cachedBoard);
