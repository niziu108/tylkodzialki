/* Znaczek „Obniżka X%" na kartach ofert.
 *
 * Liczymy tak samo jak „Cena niższa o X%" na stronie oferty: ostatni wpis historii cen kontra
 * pierwszy (DzialkaPriceSnapshot zbiera historię od 2026-08-17). To fakt o samej ofercie, a nie
 * porównanie z okolicą: tania działka bywa tania przez wady, a obniżka zawsze znaczy to samo.
 *
 * Bramki, żeby znaczek nie kłamał (pomiar 2026-09-15 na 220 obniżkach aktywnych ofert):
 *  - od 5%: drobna korekta to szum, a nie powód, żeby wyróżniać kartę,
 *  - metraż bez zmian: 10 z 220 „obniżek" to zmiana samej oferty (część działki, poprawka jednostek
 *    w CRM, np. 50 000 m² za 390 tys. zamienione na 15 500 m² za 130 tys.), a nie tańsza ta sama działka,
 *  - najwyżej 50%: większy spadek przy tym samym metrażu to raczej literówka w cenie niż obniżka.
 *
 * Czysty moduł bez bazy, żeby dało się go testować ([[project-testy]]). */

export const MIN_OBNIZKA_PCT = 5;
export const MAX_OBNIZKA_PCT = 50;

type Cena = { cenaPln: number; powierzchniaM2: number };

/** Procent obniżki do znaczka albo null, gdy znaczka nie pokazujemy. */
export function obnizkaPct(pierwsza: Cena, ostatnia: Cena): number | null {
  if (!(pierwsza.cenaPln > 0) || !(ostatnia.cenaPln > 0)) return null;
  const tolerancja = Math.max(1, pierwsza.powierzchniaM2 * 0.01);
  if (Math.abs(ostatnia.powierzchniaM2 - pierwsza.powierzchniaM2) > tolerancja) return null;
  const pct = Math.round(((pierwsza.cenaPln - ostatnia.cenaPln) / pierwsza.cenaPln) * 100);
  return pct >= MIN_OBNIZKA_PCT && pct <= MAX_OBNIZKA_PCT ? pct : null;
}
