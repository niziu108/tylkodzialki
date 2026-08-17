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
