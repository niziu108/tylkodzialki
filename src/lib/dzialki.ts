import { cache } from 'react';
import type {
  Przeznaczenie,
  PradStatus,
  WodaStatus,
  KanalizacjaStatus,
  GazStatus,
  SprzedajacyTyp,
} from '@prisma/client';

const SELLER_OWNER_SELECT = {
  owner: { select: { defaultBiuroLogoUrl: true, defaultBiuroLogoBg: true, defaultBiuroNazwa: true } },
} as const;
import { prisma } from '@/lib/prisma';

/**
 * Pobiera pełną ofertę działki bezpośrednio z bazy (Prisma) wraz ze zdjęciami
 * i danymi biura. Współdzielone przez SSR strony oferty i endpoint API,
 * dzięki czemu mamy jedno źródło prawdy i koniec podwójnego pobierania danych.
 *
 * `cache()` deduplikuje wywołania w obrębie jednego żądania
 * (np. generateMetadata + render strony pobiorą dane tylko raz).
 */
export const getDzialkaById = cache(async (id: string) => {
  if (!id || typeof id !== 'string') return null;

  const item = await prisma.dzialka.findUnique({
    where: { id },
    include: {
      zdjecia: { orderBy: { kolejnosc: 'asc' } },
      owner: {
        select: {
          defaultBiuroLogoUrl: true,
          defaultBiuroLogoBg: true,
          defaultBiuroNazwa: true,
          defaultBiuroOpiekun: true,
        },
      },
    },
  });

  if (!item) return null;

  return {
    ...item,
    biuroLogoUrl: item.biuroLogoUrl || item.owner?.defaultBiuroLogoUrl || null,
    biuroLogoBg: item.owner?.defaultBiuroLogoBg ?? false,
    biuroNazwa: item.biuroNazwa || item.owner?.defaultBiuroNazwa || null,
    biuroOpiekun: item.biuroOpiekun || item.owner?.defaultBiuroOpiekun || null,
  };
});

export type DzialkaFull = NonNullable<Awaited<ReturnType<typeof getDzialkaById>>>;

/* ────────────────────────────────────────────────────────────────────────────
 *  Podobne oferty (P8)
 *  Zwraca aktywne działki najbardziej zbliżone do bieżącej: najpierw geograficznie
 *  (bounding box po zaindeksowanych lat/lng), z premią za zgodne przeznaczenie.
 *  Jeśli geo brak lub kandydatów za mało — dobiera najnowsze (najpierw o tym samym
 *  przeznaczeniu, w ostateczności dowolne), tak by sekcja nigdy nie świeciła pustką.
 *  SSR: linki trafiają do HTML serwera → wewnętrzne linkowanie między ofertami (SEO).
 * ──────────────────────────────────────────────────────────────────────────── */

export type SimilarDzialka = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel: string | null;
  przeznaczenia: Przeznaczenie[];
  zdjecia: { url: string }[];
  prad: PradStatus | null;
  woda: WodaStatus | null;
  kanalizacja: KanalizacjaStatus | null;
  gaz: GazStatus | null;
  sprzedajacyTyp: SprzedajacyTyp | null;
  biuroNazwa: string | null;
  biuroLogoUrl: string | null;
  biuroLogoBg: boolean;
  /** Odległość od bieżącej oferty w km (null, gdy dobrane spoza geo). */
  distanceKm: number | null;
};

type SimilarSeed = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  przeznaczenia?: Przeznaczenie[] | null;
};

const EARTH_RADIUS_KM = 6371;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const SIMILAR_PHOTO_INCLUDE = {
  zdjecia: { orderBy: { kolejnosc: 'asc' as const }, take: 1 },
  ...SELLER_OWNER_SELECT,
} as const;

type SimilarRow = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel: string | null;
  przeznaczenia: Przeznaczenie[];
  lat: number | null;
  lng: number | null;
  prad: PradStatus | null;
  woda: WodaStatus | null;
  kanalizacja: KanalizacjaStatus | null;
  gaz: GazStatus | null;
  sprzedajacyTyp: SprzedajacyTyp | null;
  biuroNazwa: string | null;
  biuroLogoUrl: string | null;
  owner?: { defaultBiuroLogoUrl: string | null; defaultBiuroLogoBg: boolean; defaultBiuroNazwa: string | null } | null;
  zdjecia: { url: string }[];
};

function toSimilar(row: SimilarRow, distanceKm: number | null): SimilarDzialka {
  return {
    id: row.id,
    tytul: row.tytul,
    cenaPln: row.cenaPln,
    powierzchniaM2: row.powierzchniaM2,
    locationLabel: row.locationLabel,
    przeznaczenia: row.przeznaczenia ?? [],
    zdjecia: (row.zdjecia ?? []).map((z) => ({ url: z.url })),
    prad: row.prad ?? null,
    woda: row.woda ?? null,
    kanalizacja: row.kanalizacja ?? null,
    gaz: row.gaz ?? null,
    sprzedajacyTyp: row.sprzedajacyTyp ?? null,
    biuroNazwa: row.biuroNazwa ?? row.owner?.defaultBiuroNazwa ?? null,
    biuroLogoUrl: row.biuroLogoUrl ?? row.owner?.defaultBiuroLogoUrl ?? null,
    biuroLogoBg: row.owner?.defaultBiuroLogoBg ?? false,
    distanceKm,
  };
}

/**
 * Najbliższe/najbardziej podobne aktywne oferty do `seed` (bez samej `seed`).
 * Co najwyżej 3 lekkie zapytania do bazy; zwykle 1 (geo) lub 1–2 (dobór najnowszych).
 */
export async function getSimilarDzialki(
  seed: SimilarSeed,
  limit = 8
): Promise<SimilarDzialka[]> {
  const now = new Date();
  // Rail nosi tytuł „Podobne działki na sprzedaż" → świadomie pomijamy wynajem.
  const activeWhere = {
    status: 'AKTYWNE' as const,
    transakcja: 'SPRZEDAZ' as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  const purposes = seed.przeznaczenia ?? [];
  const hasGeo =
    typeof seed.lat === 'number' &&
    typeof seed.lng === 'number' &&
    Number.isFinite(seed.lat) &&
    Number.isFinite(seed.lng);

  // Premia za zgodne przeznaczenie ≈ „8 km bliżej" — podbija dopasowane działki,
  // nie wywracając silnego sygnału geograficznego.
  const PURPOSE_BONUS_KM = 8;
  const score = (d: SimilarDzialka) => {
    const base = d.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const sharesPurpose =
      purposes.length > 0 && d.przeznaczenia.some((p) => purposes.includes(p));
    return base - (sharesPurpose ? PURPOSE_BONUS_KM : 0);
  };

  let result: SimilarDzialka[] = [];

  if (hasGeo) {
    const lat = seed.lat as number;
    const lng = seed.lng as number;
    // ~0.9° szerokości ≈ ~100 km; długość skalowana cos(lat), by „pudełko" było
    // mniej więcej kwadratowe w terenie (zapytanie korzysta z @@index([lat, lng])).
    const dLat = 0.9;
    const lngScale = Math.max(0.3, Math.cos((lat * Math.PI) / 180));
    const dLng = dLat / lngScale;

    const candidates = await prisma.dzialka.findMany({
      where: {
        ...activeWhere,
        id: { not: seed.id },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      include: SIMILAR_PHOTO_INCLUDE,
      take: 200,
    });

    result = candidates
      .map((d) =>
        toSimilar(
          d as SimilarRow,
          typeof d.lat === 'number' && typeof d.lng === 'number'
            ? haversineKm(lat, lng, d.lat, d.lng)
            : null
        )
      )
      .sort((a, b) => score(a) - score(b))
      .slice(0, limit);
  }

  // Dobór, gdy geo nie wystarczyło: najpierw o tym samym przeznaczeniu, najnowsze.
  if (result.length < limit) {
    const excludeIds = [seed.id, ...result.map((d) => d.id)];

    const samePurpose =
      purposes.length > 0
        ? await prisma.dzialka.findMany({
            where: {
              ...activeWhere,
              id: { notIn: excludeIds },
              przeznaczenia: { hasSome: purposes },
            },
            include: SIMILAR_PHOTO_INCLUDE,
            orderBy: [{ publishedAt: 'desc' }],
            take: limit - result.length,
          })
        : [];

    result = [...result, ...samePurpose.map((d) => toSimilar(d as SimilarRow, null))];

    // Ostatnia deska: dowolne najnowsze, by rail był pełny (więcej linków/odsłon).
    if (result.length < limit) {
      const excludeIds2 = [seed.id, ...result.map((d) => d.id)];
      const newest = await prisma.dzialka.findMany({
        where: { ...activeWhere, id: { notIn: excludeIds2 } },
        include: SIMILAR_PHOTO_INCLUDE,
        orderBy: [{ publishedAt: 'desc' }],
        take: limit - result.length,
      });
      result = [...result, ...newest.map((d) => toSimilar(d as SimilarRow, null))];
    }
  }

  return result.slice(0, limit);
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Wyróżnione oferty (homepage)
 *  Najpierw faktycznie wyróżnione (isFeatured, aktywne). Dopóki nikt nie wykupił
 *  wyróżnienia — dobiera LOSOWO, ale stabilnie w obrębie doby (seed z daty), więc
 *  zestaw zmienia się „codziennie", a nie przy każdym odświeżeniu strony.
 * ──────────────────────────────────────────────────────────────────────────── */
const HOME_PHOTO_INCLUDE = {
  // kilka zdjęć — karuzela na karcie (jak na /kup), nie tylko okładka
  zdjecia: { orderBy: { kolejnosc: 'asc' as const }, take: 12 },
  ...SELLER_OWNER_SELECT,
} as const;

export async function getFeaturedListings(limit = 8) {
  const now = new Date();
  const activeWhere = {
    status: 'AKTYWNE' as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  const featured = await prisma.dzialka.findMany({
    where: { ...activeWhere, isFeatured: true },
    include: HOME_PHOTO_INCLUDE,
    orderBy: [{ featuredUntil: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
  });

  if (featured.length >= limit) return featured;

  // Losowy, ale stały w obrębie doby dobór spośród niewyróżnionych aktywnych ofert.
  const fillCount = limit - featured.length;
  const seed = now.toISOString().slice(0, 10); // YYYY-MM-DD → „codziennie inne"

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Dzialka"
    WHERE status::text = 'AKTYWNE'
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      AND "isFeatured" = false
    ORDER BY md5(id || ${seed})
    LIMIT ${fillCount}
  `;

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return featured;

  const fill = await prisma.dzialka.findMany({
    where: { id: { in: ids } },
    include: HOME_PHOTO_INCLUDE,
  });
  const byId = new Map(fill.map((d) => [d.id, d]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof fill;

  return [...featured, ...ordered];
}
