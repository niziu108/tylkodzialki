import { prisma } from '@/lib/prisma';
import { warsawDateOnly } from '@/lib/biuroStats';
import { computeCityPriceSnapshots } from '@/lib/seoHub';

// Trend cen działek per miasto. Analogicznie do BiuroDailyStat (P16): raz dziennie zapisujemy
// medianę zł/m² typowych działek budowlanych per miasto, a z serii kolejnych dni rysujemy trend
// na /ceny/[miasto]. Snapshot jest wartością „na dziś" (nie deltą), idempotentny w obrębie dnia.

/**
 * Zapisuje dzienny snapshot mediany zł/m² per miasto. Idempotentny: ponowne uruchomienie
 * tego samego dnia odświeża wiersze, nie tworzy duplikatów. Wołany z crona stats-snapshot.
 */
export async function takeDailyCityPriceSnapshot(now: Date = new Date()) {
  const date = warsawDateOnly(now);
  const snaps = await computeCityPriceSnapshots();

  let cities = 0;
  for (const s of snaps) {
    const data = { medianPricePerM2: s.medianPricePerM2, sampleCount: s.sampleCount };
    await prisma.cityPriceDailyStat.upsert({
      where: { citySlug_date: { citySlug: s.citySlug, date } },
      create: { citySlug: s.citySlug, date, ...data },
      update: data,
    });
    cities += 1;
  }

  return { ok: true as const, date: date.toISOString().slice(0, 10), cities };
}

export type PriceTrendPoint = { date: string; median: number };

export type CityPriceTrend = {
  points: PriceTrendPoint[];
  /** (ostatni − pierwszy) / pierwszy; null gdy < 2 punktów lub brak bazy pierwszego. */
  changePct: number | null;
  firstDate: string | null;
  windowDays: number;
};

/**
 * Seria trendu ceny dla jednego miasta. ODPORNA na brak tabeli (feature dodatkowy, nie
 * blokujący render strony): przed migracją / gdy brak danych zwraca pusty trend, a strona
 * po prostu nie pokazuje sekcji trendu.
 */
export async function getCityPriceTrend(
  citySlug: string,
  windowDays = 180,
  now: Date = new Date()
): Promise<CityPriceTrend> {
  const start = new Date(warsawDateOnly(now));
  start.setUTCDate(start.getUTCDate() - windowDays);

  try {
    const rows = await prisma.cityPriceDailyStat.findMany({
      where: { citySlug, date: { gte: start } },
      orderBy: { date: 'asc' },
      select: { date: true, medianPricePerM2: true },
    });

    const points: PriceTrendPoint[] = rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      median: r.medianPricePerM2,
    }));

    if (points.length < 2) {
      return { points, changePct: null, firstDate: points[0]?.date ?? null, windowDays };
    }

    const first = points[0].median;
    const last = points[points.length - 1].median;
    const changePct = first > 0 ? (last - first) / first : null;
    return { points, changePct, firstDate: points[0].date, windowDays };
  } catch {
    // Tabela może jeszcze nie istnieć (przed migracją) — nie wywracamy strony cenowej.
    return { points: [], changePct: null, firstDate: null, windowDays };
  }
}
