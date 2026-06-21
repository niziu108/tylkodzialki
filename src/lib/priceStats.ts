// P17 — średnie ceny działek (zł/m²) po województwach.
//
// Zasady (jak huby P13 → [[feedback-non-destructive-fixes]]):
//   - Zero migracji, zero ruszania danych. Liczymy na żywej bazie z pól, które JUŻ mamy
//     (cenaPln, powierzchniaM2, lat, lng po @@index([lat,lng])).
//   - Filtr „aktywności" 1:1 z hubami (seoHub.ts): ownerId != null, status AKTYWNE, nie wygasłe.
//   - Definicja województwa = ta sama prostokątna definicja (VOIVODESHIPS) co wyszukiwarka i huby
//     → jedno źródło prawdy. RÓŻNICA wobec liczników huba: tam bboxy się nakładają i ofertę można
//     policzyć w kilku regionach (licznik „ile w okolicy"); tu robimy CZYSTY PODZIAŁ — każda
//     oferta trafia do DOKŁADNIE jednego województwa (bbox zawierający punkt, remis = najbliższy
//     środek; brak trafienia = najbliższy środek w zasięgu) — żeby sumy i mediany się nie dublowały.
//   - Mediana to liczba wiodąca (odporna na skrajne stawki). Średnia podawana pomocniczo
//     (rozkład cen jest prawostronnie skośny: drogie działki miejskie windują średnią).

import { cache } from 'react';
import { DzialkaStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { VOIVODESHIPS, type BBox } from '@/lib/dzialkiSearch';

// Pas sanity dla zł/m²: tnie tylko ewidentne błędy danych (cena 0 / absurdalnie wysoka stawka),
// nie rusza realnego zakresu (tania działka leśna ~kilka zł/m² … droga budowlana w mieście).
export const PPM_MIN = 2;
export const PPM_MAX = 20_000;

// Minimalna próba, by pokazać medianę. Poniżej tej liczby mediana jest szumem → pokazujemy
// „za mało ofert" zamiast mylącej liczby (uczciwość danych > więcej wypełnionych pól).
export const MIN_SAMPLE = 15;

export type VoivodeshipPrice = {
  slug: string;
  label: string;
  // liczba ofert w próbie (wycenione, w pasie sanity, przypisane do tego województwa)
  sample: number;
  // mediana zł/m² (0, gdy sample < MIN_SAMPLE)
  median: number;
  // średnia zł/m² (0, gdy sample < MIN_SAMPLE)
  avg: number;
  // czy mamy wiarygodną liczbę (sample >= MIN_SAMPLE)
  hasData: boolean;
};

export type PriceStats = {
  // posortowane malejąco po medianie; regiony bez danych na końcu (alfabetycznie po etykiecie)
  regions: VoivodeshipPrice[];
  // mediana krajowa (po wszystkich wycenionych ofertach w pasie sanity)
  nationalMedian: number;
  // łączna liczba ofert w próbie krajowej
  nationalSample: number;
  // data wyliczenia (do podpisu „dane na dzień …")
  computedAt: Date;
};

function centerOf(b: BBox) {
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

function contains(b: BBox, lat: number, lng: number) {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

// Kwadrat odległości w przybliżeniu płaskim (wystarcza do porównań „który środek bliżej").
function dist2(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = aLat - bLat;
  const dLng = (aLng - bLng) * Math.cos((aLat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

// Limit dla fallbacku (oferta poza wszystkimi bboxami): ~65 km od najbliższego środka.
const FALLBACK_MAX_DEG2 = 0.6 * 0.6;

// Przypisanie oferty do DOKŁADNIE jednego województwa (czysty podział, bez dublowania).
export function assignVoivodeship(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;

  for (const v of VOIVODESHIPS) {
    if (!contains(v.bbox, lat, lng)) continue;
    const c = centerOf(v.bbox);
    const d = dist2(lat, lng, c.lat, c.lng);
    if (d < bestD) {
      bestD = d;
      best = v.key;
    }
  }
  if (best) return best;

  // fallback: najbliższy środek w zasięgu (granice/wybrzeże, lekkie niedoszacowanie bboxa)
  for (const v of VOIVODESHIPS) {
    const c = centerOf(v.bbox);
    const d = dist2(lat, lng, c.lat, c.lng);
    if (d < bestD) {
      bestD = d;
      best = v.key;
    }
  }
  return bestD <= FALLBACK_MAX_DEG2 ? best : null;
}

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

// Liczone raz na żądanie (cache React) — homepage i ewentualne metadane nie odpytują bazy dwa razy.
export const getVoivodeshipPriceStats = cache(async (): Promise<PriceStats> => {
  const now = new Date();

  const rows = await prisma.dzialka.findMany({
    where: {
      ownerId: { not: null },
      status: DzialkaStatus.AKTYWNE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      cenaPln: { gt: 0 },
      powierzchniaM2: { gt: 0 },
      lat: { not: null },
      lng: { not: null },
    },
    select: { cenaPln: true, powierzchniaM2: true, lat: true, lng: true },
  });

  const buckets = new Map<string, number[]>();
  for (const v of VOIVODESHIPS) buckets.set(v.key, []);
  const national: number[] = [];

  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    const ppm = r.cenaPln / r.powierzchniaM2;
    if (ppm < PPM_MIN || ppm > PPM_MAX) continue;

    const key = assignVoivodeship(r.lat, r.lng);
    if (!key) continue;

    buckets.get(key)!.push(ppm);
    national.push(ppm);
  }

  const regions: VoivodeshipPrice[] = VOIVODESHIPS.map((v) => {
    const arr = buckets.get(v.key)!;
    arr.sort((a, b) => a - b);
    const sample = arr.length;
    const hasData = sample >= MIN_SAMPLE;
    return {
      slug: v.key,
      label: v.label,
      sample,
      hasData,
      median: hasData ? Math.round(median(arr)) : 0,
      avg: hasData ? Math.round(arr.reduce((s, x) => s + x, 0) / sample) : 0,
    };
  });

  regions.sort((a, b) => {
    if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
    if (a.hasData) return b.median - a.median;
    return a.label.localeCompare(b.label, 'pl');
  });

  national.sort((a, b) => a - b);

  return {
    regions,
    nationalMedian: Math.round(median(national)),
    nationalSample: national.length,
    computedAt: now,
  };
});
