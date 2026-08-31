// „Czy chodziło o…" — ratunek dla literówki w nazwie miejscowości.
//
// Wpisanie „Radmosko" kończyło się pustą listą i końcem rozmowy: Google Autocomplete
// podpowiada tylko wtedy, gdy user KLIKNIE podpowiedź, a wpisany z palca tekst z przestawioną
// literą nie geokoduje się na nic sensownego.
//
// Słownik do porównania robimy z WŁASNYCH danych (nazwy miejscowości, w których faktycznie
// mamy oferty), a nie z zewnętrznego rejestru. Dzięki temu nigdy nie proponujemy miejsca,
// w którym po kliknięciu i tak byłoby pusto — podpowiedź zawsze prowadzi do ofert.

import { cleanSearchQuery, normalizeText } from '@/lib/dzialkiSearch';

export type PlaceEntry = {
  /** Nazwa do pokazania użytkownikowi, np. „Radomsko". */
  label: string;
  lat: number;
  lng: number;
  /** Ile ofert stoi pod tą nazwą — rozstrzyga remisy i ląduje w podpowiedzi. */
  count: number;
};

export type PlaceSuggestion = PlaceEntry & { distance: number };

/* Odległość edycyjna w wariancie OSA (Levenshtein + zamiana sąsiednich znaków). Transpozycja
 * musi kosztować 1, a nie 2, bo „radmosko" zamiast „radomsko" to najczęstsza literówka z
 * klawiatury — w czystym Levenshteinie wypadłaby poza próg razem z zupełnie innymi nazwami.
 *
 * `limit` ucina liczenie: przy różnicy długości większej niż próg wynik i tak zostanie
 * odrzucony, a słownik ma tysiące pozycji na każde zapytanie. */
export function osaDistance(a: string, b: string, limit = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr: number[] = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1);
      }

      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }

    // Cały wiersz powyżej progu = dalej może być tylko gorzej.
    if (rowMin > limit) return limit + 1;

    prev2 = prev;
    prev = curr;
    curr = new Array(b.length + 1);
  }

  return prev[b.length];
}

/* Ile literówek wybaczamy przy danej długości nazwy. Przy krótkich nazwach jedna litera
 * to zwykle INNA miejscowość („Brok" / „Broc", „Zator" / „Zatory"), więc tam wymagamy
 * trafienia co do znaku. */
function toleranceFor(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Podpowiedzi dla zapytania, które nic nie znalazło. Zwraca miejscowości najbliższe
 * literowo, od najlepiej pasującej; przy równej odległości wygrywa ta z większą podażą.
 */
export function suggestPlaces(
  query: string,
  dictionary: PlaceEntry[],
  limit = 3
): PlaceSuggestion[] {
  // Każde słowo zapytania jest kandydatem na nazwę miejscowości: „działki bechatow budowlane"
  // ma trafić w Bełchatów, a nie w najdłuższy wyraz („budowlane"). Słowa krótsze niż 4 znaki
  // odpadają — przy nich każda pomyłka daje inną miejscowość.
  const terms = cleanSearchQuery(query).filter((t) => t.length >= 4);
  if (!terms.length) return [];

  const scored: PlaceSuggestion[] = [];

  for (const entry of dictionary) {
    const name = normalizeText(entry.label);
    if (!name) continue;

    let best = Number.POSITIVE_INFINITY;

    for (const term of terms) {
      const tolerance = toleranceFor(term.length);
      const distance = osaDistance(term, name, tolerance);
      if (distance <= tolerance && distance < best) best = distance;
    }

    if (!Number.isFinite(best)) continue;

    scored.push({ ...entry, distance: best });
  }

  scored.sort((a, b) => (a.distance !== b.distance ? a.distance - b.distance : b.count - a.count));

  return scored.slice(0, limit);
}
