/* Zamiana tego, co człowiek ma na kartce („obręb Domiechowice, działka 100"), na zapytanie,
 * które rozumie ULDK. Osobny, bezzależnościowy moduł, bo to czysta reguła tekstowa: wygląda
 * na oczywistą i cicho się psuje, a testy nie mogą ciągnąć sieci ([[project-testy]]).
 *
 * Powód powstania: większość działek w Polsce nie ma adresu. Ludzie przychodzą z aktu
 * notarialnego albo z księgi wieczystej, gdzie stoi obręb i numer działki, i dotąd nie mieli
 * czym tego wpisać w „Sprawdź działkę".
 *
 * Najważniejsza pułapka: numer obrębu każdy powiat zapisuje po swojemu. Ta sama „ósemka" to
 * w Zelowie „8", w Bełchatowie „08", a w Błoniu „0008" — sprawdzone na żywej usłudze. Kto wpisze
 * „8", musi znaleźć swoją działkę niezależnie od tego, jak zapisał ją jego powiat, więc pytamy
 * o wszystkie warianty naraz. */

/** Pełny identyfikator ewidencyjny: WWPPGG_R.OOOO.[AR_n.]NR (np. 100102_2.0006.100). */
const PARCEL_ID_RE = /^\d{6}_[0-9A-Z]+\.\d{4}(\.[A-Z]+_\d+)?\.\S+$/i;

/** Czy tekst jest gotowym identyfikatorem działki (a nie nazwą obrębu). */
export function looksLikeParcelId(text: string): boolean {
  return PARCEL_ID_RE.test(text.trim());
}

/** „ 123 / 4 " → „123/4"; usuwa spacje wokół ukośnika i zbędne odstępy. */
export function normalizeParcelNumber(text: string): string {
  return text.trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
}

/** „ obręb  Domiechowice " → „Domiechowice”: bez etykiety, bez podwójnych spacji. */
export function normalizeRegionName(text: string): string {
  return text.trim().replace(/^obr[ęe]b\s*(ewidencyjny)?\s*:?\s*/i, '').replace(/\s+/g, ' ');
}

/**
 * Warianty zapisu obrębu do odpytania. Dla nazwy („Domiechowice") jeden wariant; dla numeru
 * („8") wszystkie realnie spotykane szerokości pola: 8, 08, 008, 0008 — z oryginałem na
 * początku, bo najczęściej user wpisuje dokładnie to, co ma w dokumencie.
 */
export function regionVariants(region: string): string[] {
  const base = normalizeRegionName(region);
  if (!base) return [];
  if (!/^\d{1,4}$/.test(base)) return [base];

  const bare = String(Number(base)); // „0008" → „8"
  const out = [base, bare, bare.padStart(2, '0'), bare.padStart(3, '0'), bare.padStart(4, '0')];
  return [...new Set(out)];
}

/**
 * Rozdzielenie jednego pola na obręb i numer działki, gdy user wpisał wszystko razem
 * („Domiechowice 100", „08 123/4"). Numer działki to ostatni człon, o ile wygląda jak numer
 * (cyfry, ewentualnie z ukośnikiem) — nazwy obrębów bywają wieloczłonowe („Stara Wieś 756").
 */
export function splitRegionAndNumber(text: string): { region: string; number: string } | null {
  const clean = normalizeParcelNumber(normalizeRegionName(text));
  const parts = clean.split(' ');
  if (parts.length < 2) return null;

  const number = parts[parts.length - 1];
  if (!/^\d+[a-z]?(\/\d+[a-z]?)*$/i.test(number)) return null;

  const region = parts.slice(0, -1).join(' ');
  return region ? { region, number } : null;
}

/**
 * Zapytania `id=` do ULDK (GetParcelByIdOrNr) dla podanego obrębu i numeru działki.
 * Pusta lista = danych nie da się złożyć w sensowne zapytanie.
 */
export function buildParcelQueries(region: string, number: string): string[] {
  const reg = normalizeRegionName(region);
  const num = normalizeParcelNumber(number);

  // Ktoś wkleił gotowy identyfikator (obojętne, w które pole) — pytamy dokładnie o niego,
  // warianty numeru obrębu nie mają wtedy sensu.
  if (looksLikeParcelId(reg)) return [reg];
  if (looksLikeParcelId(num)) return [num];

  // Wszystko w jednym polu („Domiechowice 100") — rozdziel i pytaj normalnie.
  if (!num) {
    const split = splitRegionAndNumber(reg);
    if (!split) return [];
    return regionVariants(split.region).map((v) => `${v} ${split.number}`);
  }

  if (!reg) return [];
  return regionVariants(reg).map((v) => `${v} ${num}`);
}

/** ULDK zwraca powiat raz jako „powiat zgorzelecki", raz samo „bełchatowski" — ujednolicamy. */
export function powiatLabelFromUldk(county: string): string {
  const clean = county.trim();
  if (!clean) return '';
  return /^powiat\s/i.test(clean) ? clean : `powiat ${clean}`;
}
