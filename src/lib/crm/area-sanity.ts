/**
 * Ratowanie powierzchni podanej w hektarach w polu, które trzyma metry.
 *
 * Problem, który to naprawia: część biur wpisuje w swoim CRM powierzchnię w hektarach,
 * a feed oddaje tę liczbę jako metry. U nas ląduje wtedy działka 1,07 ha zapisana jako
 * 1 m². Znalezione na produkcji 2026-08-27 na wizytówce RE/MAX, gdzie portfel opisywał
 * się jako „powierzchnie od 1 do 851 200 m²", ale skutek jest szerszy niż jedno zdanie:
 * taka oferta wypada ze wszystkich filtrów powierzchni (kupujący szukający 10 000 m²
 * nigdy jej nie zobaczy) i ma bezsensowną cenę za metr.
 *
 * Reguła: NIE zgadujemy. Ruszamy powierzchnię tylko wtedy, gdy oferta sama się zdradza,
 * czyli gdy w tytule albo opisie stoi liczba hektarów, która po zaokrągleniu daje dokładnie
 * tę wartość, jaka wpadła do pola metrów. „Działka inwestycyjna 1,07 ha" przy zapisanym
 * 1 m² to nie zbieg okoliczności, tylko ta sama liczba w innej jednostce.
 *
 * Dzięki temu warunkowi bramka nie tyka:
 *  - poprawnych zapisów w hektarach („0,0165 ha" przy 165 m²: zaokrąglenie daje 0, nie 165),
 *  - hektarów, które opisują coś innego niż działkę („10,6 ha" jeziora przy działce 57 m²),
 *  - małych, ale prawdziwych działek („Działka pod garaż" na 24 m², bez hektarów w tekście).
 *
 * Arów świadomie NIE obsługujemy. W danych trafia się „17 arów" przy zapisanym 18 m²,
 * czyli liczby, które się nie zgadzają, więc każda naprawa byłaby już zgadywaniem.
 */

/** Poniżej tego progu powierzchnia jest podejrzana: działki liczy się w metrach, nie w garściach. */
export const AREA_SUSPICIOUS_BELOW_M2 = 100;

/** Górny bezpiecznik na wynik przeliczenia: 10 000 ha to więcej niż największy majątek w feedzie. */
export const AREA_MAX_PLAUSIBLE_M2 = 100_000_000;

/** Liczba hektarów w tekście: „1,07 ha", „4,5 ha", „12 hektarów". */
const HECTARES_RE = /(\d{1,4}(?:[.,]\d{1,6})?)\s*(?:ha|hektar[a-ząóéę]*)\b/gi;

/**
 * Zwraca powierzchnię w metrach: przeliczoną z hektarów, jeśli oferta sama zdradza pomyłkę
 * jednostki, a w każdym innym przypadku dokładnie tę, która przyszła z feedu.
 *
 * @param areaM2 powierzchnia z feedu, już zaokrąglona do metrów
 * @param text   tytuł i opis oferty (dowolnie zlepione, szukamy w całości)
 */
export function repairAreaFromHectares(areaM2: number, text: string): number {
  // Zero i wartości ujemne zostawiamy silnikom: pusta powierzchnia to osobna sprawa
  // niż powierzchnia w złej jednostce.
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return areaM2;
  if (areaM2 >= AREA_SUSPICIOUS_BELOW_M2) return areaM2;
  if (!text) return areaM2;

  for (const match of text.matchAll(HECTARES_RE)) {
    const hektary = Number(match[1].replace(",", "."));
    if (!Number.isFinite(hektary) || hektary <= 0) continue;

    // Feed mógł zaokrąglić hektary w którąkolwiek stronę („4,5 ha" bywa i 4, i 5),
    // więc dopuszczamy każde z trzech zaokrągleń. Zgodność liczb zostaje warunkiem.
    const zgadzaSie =
      Math.round(hektary) === areaM2 ||
      Math.floor(hektary) === areaM2 ||
      Math.ceil(hektary) === areaM2;
    if (!zgadzaSie) continue;

    const wMetrach = Math.round(hektary * 10_000);

    // Przeliczenie ma sens tylko wtedy, gdy podnosi powierzchnię do wielkości działki.
    if (wMetrach <= areaM2) continue;
    if (wMetrach < AREA_SUSPICIOUS_BELOW_M2 || wMetrach > AREA_MAX_PLAUSIBLE_M2) continue;

    return wMetrach;
  }

  return areaM2;
}
