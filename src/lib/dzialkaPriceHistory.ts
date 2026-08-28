import { prisma } from '@/lib/prisma';
import { warsawDateOnly } from '@/lib/biuroStats';

// Historia cen KONKRETNEJ działki (fundament „land intelligence": trend ceny działki w czasie).
// Odróżnia się od CityPriceDailyStat (mediana miasta) tym, że tu śledzimy pojedynczą ofertę.
//
// Zasada oszczędności: to NIE jest codzienna migawka wszystkich ofert (to byłyby miliony wierszy
// rocznie), tylko CHANGE-LOG. Zapisujemy wiersz tylko, gdy cena albo metraż różni się od ostatniego
// znanego stanu tej oferty. Pierwszy przebieg zakłada linię bazową dla każdej aktywnej oferty.
// Idempotentny w obrębie dnia (unikat dzialkaId+date + skipDuplicates). Wołany z crona stats-snapshot,
// czyli PO synchronizacji CRM — łapie ceny już zaktualizowane importem.

type LastPrice = { dzialkaId: string; cenaPln: number; powierzchniaM2: number };

/**
 * Zapisuje zmiany cen aktywnych ofert względem ostatniego znanego stanu. Zwraca licznik nowych
 * wierszy (na starcie = liczba aktywnych ofert = linia bazowa; potem tylko realne zmiany ceny/metrażu).
 */
export async function takeDailyPriceSnapshot(now: Date = new Date()) {
  const date = warsawDateOnly(now);

  // Jeden odczyt: ostatnia znana cena/metraż każdej oferty, jaką już mamy w historii.
  // DISTINCT ON (Postgres) bierze najświeższy wiersz per działka. Pusta tabela = pusty wynik.
  const lastRows = await prisma.$queryRaw<LastPrice[]>`
    SELECT DISTINCT ON ("dzialkaId") "dzialkaId", "cenaPln", "powierzchniaM2"
    FROM "DzialkaPriceSnapshot"
    ORDER BY "dzialkaId", "date" DESC
  `;
  const last = new Map<string, LastPrice>();
  for (const r of lastRows) last.set(r.dzialkaId, r);

  // Aktualny stan aktywnych ofert (źródło prawdy: Dzialka). Lekki select.
  const offers = await prisma.dzialka.findMany({
    where: { status: 'AKTYWNE' },
    select: { id: true, cenaPln: true, powierzchniaM2: true },
  });

  const changed = offers
    .filter((o) => {
      const prev = last.get(o.id);
      return !prev || prev.cenaPln !== o.cenaPln || prev.powierzchniaM2 !== o.powierzchniaM2;
    })
    .map((o) => ({ dzialkaId: o.id, date, cenaPln: o.cenaPln, powierzchniaM2: o.powierzchniaM2 }));

  if (changed.length === 0) {
    return { ok: true as const, date: date.toISOString().slice(0, 10), inserted: 0, active: offers.length };
  }

  // skipDuplicates: gdyby cron ruszył dwa razy tego samego dnia, unikat (dzialkaId,date) chroni
  // przed duplikatem — pierwszy zapis dnia zostaje.
  const res = await prisma.dzialkaPriceSnapshot.createMany({ data: changed, skipDuplicates: true });

  return { ok: true as const, date: date.toISOString().slice(0, 10), inserted: res.count, active: offers.length };
}

export type OfferPricePoint = { date: string; cenaPln: number; pricePerM2: number | null };

export type OfferPriceTrend = {
  points: OfferPricePoint[];
  /** (ostatnia − pierwsza) / pierwsza cena; null gdy < 2 punktów. */
  changePct: number | null;
  firstDate: string | null;
};

/**
 * Trend ceny jednej działki. ODPORNY na brak tabeli (feature dodatkowy, nie blokuje renderu oferty):
 * przed migracją / bez danych zwraca pusty trend, a strona po prostu nie pokazuje sekcji. Przydatne
 * do przyszłego widoku „jak zmieniała się cena tej działki" na stronie oferty.
 */
export async function getOfferPriceTrend(dzialkaId: string): Promise<OfferPriceTrend> {
  try {
    const rows = await prisma.dzialkaPriceSnapshot.findMany({
      where: { dzialkaId },
      orderBy: { date: 'asc' },
      select: { date: true, cenaPln: true, powierzchniaM2: true },
    });

    const points: OfferPricePoint[] = rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      cenaPln: r.cenaPln,
      pricePerM2: r.powierzchniaM2 > 0 ? Math.round(r.cenaPln / r.powierzchniaM2) : null,
    }));

    if (points.length < 2) {
      return { points, changePct: null, firstDate: points[0]?.date ?? null };
    }
    const first = points[0].cenaPln;
    const last = points[points.length - 1].cenaPln;
    return { points, changePct: first > 0 ? (last - first) / first : null, firstDate: points[0].date };
  } catch {
    return { points: [], changePct: null, firstDate: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND CEN OKOLICY (raport „Sprawdz dzialke")
//
// Liczymy na PARACH: bierzemy wylacznie oferty, ktore wisialy i wtedy, i dzis, i porownujemy
// mediany zl/m2 tego samego zbioru. Gdybysmy zestawili „mediane wszystkich ofert wtedy" z
// „mediana wszystkich dzis", wynik mowilby glownie o tym, jakie oferty doszly i zniknely, a nie
// o tym, czy ceny poszly w gore. Przy zmiennej podazy to bylaby loteria podana jako fakt.
//
// Sekcja wlacza sie SAMA, gdy dane dojrzeja: dopoki historia jest krotsza niz TREND_MIN_DNI albo
// par jest za malo, zwracamy null i raport o trendzie nie wspomina ([[feedback-filtry-twarde]]).
// ─────────────────────────────────────────────────────────────────────────────

/** Minimalny odstep, ponizej ktorego roznica median to szum, nie trend. */
export const TREND_MIN_DNI = 60;
/** Minimalna liczba ofert obecnych w obu momentach. */
export const TREND_MIN_PAR = 8;
/** Jak daleko wstecz siegamy, gdy historia jest juz dluga. */
export const TREND_OKNO_DNI = 180;

export type AreaPriceTrend = {
  /** 0.032 = ceny wyzsze o 3,2% niz w dniu odniesienia */
  changePct: number;
  fromDate: string; // YYYY-MM-DD
  days: number;
  sampleCount: number;
  medianThen: number;
  medianNow: number;
};

function mediana(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : Math.round((s[i - 1] + s[i]) / 2);
}

/**
 * Zmiana median zl/m2 wsrod ofert w promieniu `km` od punktu. `null`, gdy historia jest za krotka,
 * par za malo albo tabeli snapshotow jeszcze nie ma (funkcja nie moze wywrocic raportu).
 */
export async function getAreaPriceTrend(
  lat: number,
  lng: number,
  km: number,
  now: Date = new Date()
): Promise<AreaPriceTrend | null> {
  try {
    const dLat = km / 111.32;
    const dLng = km / (111.32 * Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 0.01));

    const aktualne = await prisma.dzialka.findMany({
      where: {
        ownerId: { not: null },
        status: 'AKTYWNE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        cenaPln: { gt: 0 },
        powierzchniaM2: { gt: 0 },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      select: { id: true, cenaPln: true, powierzchniaM2: true },
    });
    if (aktualne.length < TREND_MIN_PAR) return null;

    // Data odniesienia: pol roku wstecz, a gdy historia jest mlodsza — jej najstarszy dzien.
    const najstarszy = await prisma.dzialkaPriceSnapshot.aggregate({ _min: { date: true } });
    const pierwszaData = najstarszy._min.date;
    if (!pierwszaData) return null;

    const chciana = new Date(now);
    chciana.setDate(chciana.getDate() - TREND_OKNO_DNI);
    const ref = chciana > pierwszaData ? chciana : pierwszaData;
    const days = Math.round((now.getTime() - ref.getTime()) / 86_400_000);
    if (days < TREND_MIN_DNI) return null;

    // Cena obowiazujaca w dniu odniesienia = ostatni wpis change-logu nie pozniejszy niz ta data.
    const wtedy = await prisma.$queryRaw<{ dzialkaId: string; cenaPln: number; powierzchniaM2: number }[]>`
      SELECT DISTINCT ON (s."dzialkaId") s."dzialkaId", s."cenaPln", s."powierzchniaM2"
      FROM "DzialkaPriceSnapshot" s
      JOIN "Dzialka" d ON d.id = s."dzialkaId"
      WHERE s."date" <= ${ref}
        AND d.lat BETWEEN ${lat - dLat} AND ${lat + dLat}
        AND d.lng BETWEEN ${lng - dLng} AND ${lng + dLng}
      ORDER BY s."dzialkaId", s."date" DESC
    `;
    if (wtedy.length < TREND_MIN_PAR) return null;

    const teraz = new Map(aktualne.map((o) => [o.id, o]));
    const parWtedy: number[] = [];
    const parTeraz: number[] = [];
    for (const w of wtedy) {
      const t = teraz.get(w.dzialkaId);
      if (!t || w.powierzchniaM2 <= 0 || w.cenaPln <= 0) continue;
      parWtedy.push(Math.round(w.cenaPln / w.powierzchniaM2));
      parTeraz.push(Math.round(t.cenaPln / t.powierzchniaM2));
    }
    if (parWtedy.length < TREND_MIN_PAR) return null;

    const medianThen = mediana(parWtedy);
    const medianNow = mediana(parTeraz);
    if (medianThen <= 0) return null;

    return {
      changePct: (medianNow - medianThen) / medianThen,
      fromDate: ref.toISOString().slice(0, 10),
      days,
      sampleCount: parWtedy.length,
      medianThen,
      medianNow,
    };
  } catch {
    return null;
  }
}
