// P22: oś POWIATU jako warstwa SEO (`/dzialki/powiat/[powiat]`).
//
// Klucz: NIE potrzebujemy ręcznego datasetu 380 powiatów. Każda oferta ma w `locationFull`
// pełną ścieżkę administracyjną z geokodowania Google, po przecinku:
//   „[ulica,] miejscowość, [gmina,] POWIAT, WOJEWÓDZTWO"
// gdzie ostatni token = województwo, przedostatni = powiat (przymiotnik, np. „giżycki",
// „łęczyński"). Powiat to najgęstsza sensowna oś (agreguje wiele wsi => strony tłuste,
// nie cienkie), a dopasowanie jest DOKŁADNE (własny powiat oferty), nie po promieniu.
//
// ŻELAZNA ZASADA (jak P13/P21): stronę tworzymy tylko z realną treścią; pusty powiat =>
// noindex + poza sitemap. Precyzja > zasięg: akceptujemy tylko token wyglądający jak
// powiat ziemski (przymiotnik na „ki"); miasta na prawach powiatu („X m.") pomijamy,
// bo pokrywają je huby miast.

import { cache } from 'react';
import { DzialkaStatus, type Przeznaczenie } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeText, type BBox } from '@/lib/dzialkiSearch';
import { getSeoRegion } from '@/lib/seo-locations';
import {
  bucketByType,
  computeDetail,
  type CategoryDetail,
  type DetailStatRow,
} from '@/lib/seoHub';

// Próg indeksacji powiatu (ochrona thin-content): poniżej tylu ofert strona istnieje,
// ale leci noindex i jest poza sitemapą. Zgrany z MIN_SAMPLE (od tylu ofert pokazujemy
// medianę), więc indeksujemy tylko strony z realną treścią liczbową.
export const POWIAT_MIN_INDEX = 4;

export type ParsedAdmin = { powiatSlug: string; powiatAdj: string; wojSlug: string };

function toSlug(s: string): string {
  return normalizeText(s).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Wyciąga powiat + województwo z `locationFull`. Zwraca null, gdy nie da się rzetelnie ustalić.
export function parseAdmin(locationFull: string | null | undefined): ParsedAdmin | null {
  if (!locationFull) return null;
  const parts = locationFull
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const wojToken = parts[parts.length - 1];
  const powiatToken = parts[parts.length - 2];

  const wojSlug = toSlug(wojToken);
  if (!getSeoRegion(wojSlug)) return null; // token na końcu musi być znanym województwem

  const powiatAdj = powiatToken.toLowerCase().trim();
  // Miasto na prawach powiatu („Lublin m.") pomijamy — pokrywa je hub miasta.
  if (/\bm\.?$/.test(powiatAdj)) return null;
  // Powiat ziemski to przymiotnik na „ki" (…ski/…cki/…zki). Inne tokeny odrzucamy (precyzja).
  if (!/ki$/.test(powiatAdj)) return null;

  return { powiatSlug: toSlug(powiatAdj), powiatAdj, wojSlug };
}

// Odmiana przymiotnika powiatu (regularna, wszystkie kończą się na „ki"):
//   mianownik „giżycki" -> dopełniacz „giżyckiego" -> miejscownik „giżyckim".
export function powiatAdjGen(adj: string): string {
  return adj.replace(/i$/, 'iego');
}
export function powiatAdjLoc(adj: string): string {
  return adj.replace(/i$/, 'im');
}

// Pełne formy do zdań: „powiat giżycki" / „powiatu giżyckiego" / „w powiecie giżyckim".
export function powiatNom(adj: string): string {
  return `powiat ${adj}`;
}
export function powiatGen(adj: string): string {
  return `powiatu ${powiatAdjGen(adj)}`;
}
export function powiatLoc(adj: string): string {
  return `powiecie ${powiatAdjLoc(adj)}`;
}

type PowiatRow = DetailStatRow & {
  lat: number;
  lng: number;
  powiatSlug: string;
  powiatAdj: string;
  wojSlug: string;
};

// Jeden odczyt całej aktywnej puli (z cechami + locationFull), sparsowany na powiaty.
// Cache na żądanie: strona powiatu i lista powiatów korzystają z tego samego odczytu.
const loadAllPowiatRows = cache(async (): Promise<PowiatRow[]> => {
  const now = new Date();
  const rows = await prisma.dzialka.findMany({
    where: {
      ownerId: { not: null },
      status: DzialkaStatus.AKTYWNE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      lat: true,
      lng: true,
      locationFull: true,
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

  const out: PowiatRow[] = [];
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    const admin = parseAdmin(r.locationFull);
    if (!admin) continue;
    out.push({
      lat: r.lat,
      lng: r.lng,
      przeznaczenia: r.przeznaczenia,
      cenaPln: r.cenaPln,
      powierzchniaM2: r.powierzchniaM2,
      sprzedajacyTyp: r.sprzedajacyTyp,
      prad: r.prad,
      woda: r.woda,
      mpzp: r.mpzp,
      wzWydane: r.wzWydane,
      powiatSlug: admin.powiatSlug,
      powiatAdj: admin.powiatAdj,
      wojSlug: admin.wojSlug,
    });
  }
  return out;
});

export type PowiatEntry = {
  slug: string;
  adj: string; // przymiotnik, np. „giżycki"
  wojSlug: string;
  total: number;
  byType: Record<string, number>;
};

// Lista wszystkich powiatów z podażą (do linkowania i sitemapy). Sort malejąco po liczbie ofert.
export const getPowiatList = cache(async (): Promise<PowiatEntry[]> => {
  const rows = await loadAllPowiatRows();
  const groups = new Map<string, PowiatRow[]>();
  for (const r of rows) {
    const arr = groups.get(r.powiatSlug);
    if (arr) arr.push(r);
    else groups.set(r.powiatSlug, [r]);
  }

  const entries: PowiatEntry[] = [];
  for (const [slug, grp] of groups) {
    entries.push({
      slug,
      adj: grp[0].powiatAdj,
      wojSlug: grp[0].wojSlug,
      total: grp.length,
      byType: bucketByType(grp),
    });
  }
  entries.sort((a, b) => b.total - a.total);
  return entries;
});

export type PowiatDetail = {
  slug: string;
  adj: string;
  wojSlug: string;
  detail: CategoryDetail;
  byType: Record<string, number>;
  bbox: BBox;
};

// Metryki + bbox dla jednej strony powiatu. Dopasowanie DOKŁADNE (własny powiat oferty).
export const getPowiatDetail = cache(async (slug: string): Promise<PowiatDetail | null> => {
  const rows = (await loadAllPowiatRows()).filter((r) => r.powiatSlug === slug);
  if (rows.length === 0) {
    // Zwróć „pusty" wpis tylko, jeśli slug w ogóle istniał kiedyś — inaczej null => 404.
    return null;
  }

  const bbox: BBox = {
    minLat: Math.min(...rows.map((r) => r.lat)),
    maxLat: Math.max(...rows.map((r) => r.lat)),
    minLng: Math.min(...rows.map((r) => r.lng)),
    maxLng: Math.max(...rows.map((r) => r.lng)),
  };

  return {
    slug,
    adj: rows[0].powiatAdj,
    wojSlug: rows[0].wojSlug,
    detail: computeDetail(rows),
    byType: bucketByType(rows),
    bbox,
  };
});
