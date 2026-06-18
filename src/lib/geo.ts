/**
 * Wspólna walidacja współrzędnych geograficznych dla WSZYSTKICH źródeł lokalizacji
 * (importy CRM: ASARI / domy.pl / EstiCRM oraz ręczne geokodowanie z formularza).
 *
 * Cel: na mapę trafiają wyłącznie współrzędne leżące w Polsce. Zabezpiecza przed
 * pomyłką pól w feedzie (np. wymiary działki zamiast geo), zamianą osi czy błędnym
 * geokodowaniem, które wrzucały piny poza granice kraju.
 */

// Bounding box Polski z marginesem na krańce kraju.
// Empirycznie (audyt 06.2026): 0 legalnych ofert PL wypada poza ten prostokąt,
// a 100% błędnych pinów leżało poza nim -> bezpieczna, zerowa liczba false-positive.
export const POLAND_BBOX = {
  latMin: 48.9,
  latMax: 55.05,
  lngMin: 13.95,
  lngMax: 24.25,
} as const;

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
  return (
    isValidLatLng(lat, lng) &&
    lat >= POLAND_BBOX.latMin &&
    lat <= POLAND_BBOX.latMax &&
    lng >= POLAND_BBOX.lngMin &&
    lng <= POLAND_BBOX.lngMax
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
