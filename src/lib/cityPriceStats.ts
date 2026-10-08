import { prisma } from '@/lib/prisma';
import { warsawDateOnly } from '@/lib/biuroStats';
import { loadActivePricePool, type CategoryDetail } from '@/lib/seoHub';
import { computePolandPriceBoard, PRICE_KEY_POLSKA, regionPriceKey } from '@/lib/cenyPolska';

// Trend cen działek per miasto. Analogicznie do BiuroDailyStat (P16): raz dziennie zapisujemy
// medianę zł/m² typowych działek budowlanych per miasto, a z serii kolejnych dni rysujemy trend
// na /ceny/[miasto]. Snapshot jest wartością „na dziś" (nie deltą), idempotentny w obrębie dnia.

// Od 2026-10-08 w tej samej tabeli zapisujemy też medianę całej Polski (klucz „pl") i każdego
// województwa („woj:<slug>"), pod zmianę miesiąc do miesiąca na indeksie /ceny. Bez migracji:
// klucz to zwykły tekst, a slugi miast nie kolidują z tymi przestrzeniami.

/**
 * Zapisuje dzienny snapshot mediany zł/m² per miasto, województwo i całą Polskę. Idempotentny:
 * ponowne uruchomienie tego samego dnia odświeża wiersze, nie tworzy duplikatów. Wołany z crona
 * stats-snapshot. Ten sam silnik co strony (computePolandPriceBoard), więc trend śledzi
 * dokładnie te liczby, które pokazujemy. Obszary bez wiarygodnej próbki pomijamy.
 */
export async function takeDailyCityPriceSnapshot(now: Date = new Date()) {
  const date = warsawDateOnly(now);
  const board = computePolandPriceBoard(await loadActivePricePool());

  const snaps: { key: string; detail: CategoryDetail }[] = [
    ...board.cities.map((c) => ({ key: c.city.slug, detail: c.detail })),
    ...board.regions.map((r) => ({ key: regionPriceKey(r.region.slug), detail: r.detail })),
    { key: PRICE_KEY_POLSKA, detail: board.national },
  ];

  let cities = 0;
  let areas = 0;
  for (const { key, detail } of snaps) {
    if (!detail.pricePerM2) continue;
    const data = { medianPricePerM2: detail.pricePerM2.median, sampleCount: detail.count };
    await prisma.cityPriceDailyStat.upsert({
      where: { citySlug_date: { citySlug: key, date } },
      create: { citySlug: key, date, ...data },
      update: data,
    });
    if (key === PRICE_KEY_POLSKA || key.startsWith('woj:')) areas += 1;
    else cities += 1;
  }

  return { ok: true as const, date: date.toISOString().slice(0, 10), cities, areas };
}

/**
 * Mediany sprzed ok. miesiąca dla wielu kluczy naraz (jedno zapytanie). Bierzemy snapshot
 * najbliższy dacie „dziś − 30 dni" w oknie 27-33 dni, więc pojedynczy brakujący dzień crona
 * nie gasi zmiany m/m. Brak klucza w wyniku = brak historii, strona nie pokazuje zmiany.
 * ODPORNA na błąd bazy (feature dodatkowy): zwraca pustą mapę.
 */
export async function getMonthAgoMedians(
  now: Date = new Date()
): Promise<Map<string, { date: string; median: number; sampleCount: number }>> {
  const today = warsawDateOnly(now);
  const target = new Date(today);
  target.setUTCDate(target.getUTCDate() - 30);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 33);
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() - 27);

  const out = new Map<string, { date: string; median: number; sampleCount: number; dist: number }>();
  try {
    const rows = await prisma.cityPriceDailyStat.findMany({
      where: { date: { gte: from, lte: to } },
      select: { citySlug: true, date: true, medianPricePerM2: true, sampleCount: true },
    });
    for (const r of rows) {
      const dist = Math.abs(r.date.getTime() - target.getTime());
      const prev = out.get(r.citySlug);
      if (!prev || dist < prev.dist) {
        out.set(r.citySlug, {
          date: r.date.toISOString().slice(0, 10),
          median: r.medianPricePerM2,
          sampleCount: r.sampleCount,
          dist,
        });
      }
    }
  } catch {
    return new Map();
  }
  return new Map([...out].map(([k, v]) => [k, { date: v.date, median: v.median, sampleCount: v.sampleCount }]));
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
