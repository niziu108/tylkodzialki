/**
 * Wspólna walidacja współrzędnych geograficznych dla WSZYSTKICH źródeł lokalizacji
 * (importy CRM: ASARI / domy.pl / EstiCRM oraz ręczne geokodowanie z formularza).
 *
 * Cel: na mapę trafiają wyłącznie współrzędne leżące w Polsce. Zabezpiecza przed
 * pomyłką pól w feedzie (np. wymiary działki zamiast geo), zamianą osi czy błędnym
 * geokodowaniem, które wrzucały piny poza granice kraju.
 */

// Zgrubna obwiednia kraju — szybki odsiew rzeczy oczywiście nie z tej planety
// (zamienione osie, wymiary działki w polu geo itp.).
export const POLAND_BBOX = {
  latMin: 48.9,
  latMax: 55.05,
  lngMin: 13.95,
  lngMax: 24.25,
} as const;

/**
 * Polska jako suma prostokątów województw. Sam POLAND_BBOX to za mało: w jego rogach
 * mieści się obwód kaliningradzki oraz pasy Białorusi, Ukrainy, Słowacji, Czech i Niemiec.
 * Realny przypadek (08.2026): geokoder zapytany o „Brzeźno" zwrócił Brzeźno pod
 * Królewcem (54,98 / 20,50), przeszedł przez bramkę i wylądował na mapie jako pin
 * pośrodku Bałtyku, mimo że oferta opisowo siedzi w wielkopolskim.
 *
 * Suma prostokątów przybliża kształt kraju znacznie ciaśniej. Audyt na 8 272 aktywnych
 * ofertach ze współrzędnymi: odrzuca DOKŁADNIE tę jedną błędną i ani jednej poprawnej
 * (wynik identyczny dla marginesu 0 i 0,05 stopnia, więc bramka nie stoi na granicy).
 *
 * Prostokąty są celowo osobną kopią względem VOIVODESHIPS w `dzialkiSearch.ts`: tamte
 * służą do WYSZUKIWANIA („pokaż mazowieckie") i mogą być hojne, te służą do WALIDACJI
 * i mają być ciasne. Mieszanie obu celów w jednej liście prędzej czy później rozluźniłoby
 * bramkę przy okazji poprawiania wyszukiwarki.
 */
const POLAND_PARTS: ReadonlyArray<readonly [number, number, number, number]> = [
  // [latMin, latMax, lngMin, lngMax]
  [50.05, 51.85, 14.75, 17.85], // dolnośląskie
  [52.25, 53.85, 17.20, 19.75], // kujawsko-pomorskie
  [50.15, 52.35, 21.60, 24.20], // lubelskie
  [51.35, 53.15, 14.50, 16.45], // lubuskie
  [50.80, 52.40, 18.05, 20.75], // łódzkie
  [49.15, 50.55, 19.05, 21.45], // małopolskie
  [51.00, 53.50, 19.25, 23.15], // mazowieckie
  [49.95, 51.25, 16.85, 18.70], // opolskie
  [49.00, 50.85, 21.15, 23.65], // podkarpackie
  [52.25, 54.45, 21.55, 23.95], // podlaskie
  [53.45, 54.85, 16.70, 19.85], // pomorskie
  [49.35, 51.25, 18.00, 19.95], // śląskie
  [50.15, 51.35, 19.70, 21.75], // świętokrzyskie
  [53.15, 54.55, 19.10, 22.80], // warmińsko-mazurskie
  [51.05, 53.65, 15.75, 18.75], // wielkopolskie
  [52.55, 54.85, 14.10, 16.95], // zachodniopomorskie
];

/** Czy para liczb jest w ogóle poprawnymi współrzędnymi (skończone, w zakresie globalnym). */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Czy współrzędne leżą w granicach Polski (bbox). */
export function isInPoland(lat: number, lng: number): boolean {
  if (!isValidLatLng(lat, lng)) return false;
  if (
    lat < POLAND_BBOX.latMin ||
    lat > POLAND_BBOX.latMax ||
    lng < POLAND_BBOX.lngMin ||
    lng > POLAND_BBOX.lngMax
  ) {
    return false;
  }
  return POLAND_PARTS.some(
    ([latMin, latMax, lngMin, lngMax]) =>
      lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax
  );
}

/**
 * Bramka jakości. Zwraca współrzędne TYLKO gdy są poprawne i leżą w Polsce.
 * W przeciwnym razie `null` — wołający powinien przejść na fallback
 * (geokodowanie adresu / oznaczenie do weryfikacji / brak pinu).
 */
export function sanitizePlCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  if (!isValidLatLng(lat, lng)) return null;
  if (!isInPoland(lat as number, lng as number)) return null;
  return { lat: lat as number, lng: lng as number };
}
