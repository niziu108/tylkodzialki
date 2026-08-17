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
type Part = { name: string; latMin: number; latMax: number; lngMin: number; lngMax: number };

const POLAND_PARTS: ReadonlyArray<Part> = [
  { name: 'dolnoslaskie', latMin: 50.05, latMax: 51.85, lngMin: 14.75, lngMax: 17.85 },
  { name: 'kujawsko-pomorskie', latMin: 52.25, latMax: 53.85, lngMin: 17.20, lngMax: 19.75 },
  { name: 'lubelskie', latMin: 50.15, latMax: 52.35, lngMin: 21.60, lngMax: 24.20 },
  { name: 'lubuskie', latMin: 51.35, latMax: 53.15, lngMin: 14.50, lngMax: 16.45 },
  { name: 'lodzkie', latMin: 50.80, latMax: 52.40, lngMin: 18.05, lngMax: 20.75 },
  { name: 'malopolskie', latMin: 49.15, latMax: 50.55, lngMin: 19.05, lngMax: 21.45 },
  { name: 'mazowieckie', latMin: 51.00, latMax: 53.50, lngMin: 19.25, lngMax: 23.15 },
  { name: 'opolskie', latMin: 49.95, latMax: 51.25, lngMin: 16.85, lngMax: 18.70 },
  { name: 'podkarpackie', latMin: 49.00, latMax: 50.85, lngMin: 21.15, lngMax: 23.65 },
  { name: 'podlaskie', latMin: 52.25, latMax: 54.45, lngMin: 21.55, lngMax: 23.95 },
  { name: 'pomorskie', latMin: 53.45, latMax: 54.85, lngMin: 16.70, lngMax: 19.85 },
  { name: 'slaskie', latMin: 49.35, latMax: 51.25, lngMin: 18.00, lngMax: 19.95 },
  { name: 'swietokrzyskie', latMin: 50.15, latMax: 51.35, lngMin: 19.70, lngMax: 21.75 },
  { name: 'warminsko-mazurskie', latMin: 53.15, latMax: 54.55, lngMin: 19.10, lngMax: 22.80 },
  { name: 'wielkopolskie', latMin: 51.05, latMax: 53.65, lngMin: 15.75, lngMax: 18.75 },
  { name: 'zachodniopomorskie', latMin: 52.55, latMax: 54.85, lngMin: 14.10, lngMax: 16.95 },
];

/** Do porównań tekstowych: małe litery, bez polskich znaków, znormalizowane odstępy. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l') // ł nie rozkłada się przez NFD
    .replace(/\s+/g, ' ')
    .trim();
}

/* Nazwy województw zawierają się w sobie („wielk-OPOLSK-ie", „zachodni-OPOMORSK-ie",
 * „kujawsko-POMORSK-ie”), więc dopasowanie MUSI iść od najdłuższej nazwy. Inaczej oferta
 * z Wielkopolski byłaby sprawdzana prostokątem Opolszczyzny i wypadałaby jako błędna. */
const PARTS_BY_NAME_LENGTH = [...POLAND_PARTS].sort((a, b) => b.name.length - a.name.length);

/* Prostokąty województw są zgrubne i ręcznie zaokrąglone, więc przy porównaniu
 * z deklarowanym województwem dokładamy bufor. 0,15 stopnia to ok. 17 km — dość,
 * by nie karać działek tuż przy granicy województwa, a wciąż o rząd wielkości mniej
 * niż odległość do miejscowości-imienniczki w innym końcu kraju. */
const VOIVODESHIP_TOLERANCE = 0.15;

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
    (p) => lat >= p.latMin && lat <= p.latMax && lng >= p.lngMin && lng <= p.lngMax
  );
}

/**
 * Czy współrzędne zgadzają się z województwem wypisanym w opisie lokalizacji.
 *
 * Po co: w Polsce mnóstwo miejscowości nosi tę samą nazwę (dwa Łagowy, kilka Rędzin,
 * kilkanaście Brzeźn). Geokoder pytany o samą nazwę wsi trafia w losową z nich, a feed
 * biura potrafi podać współrzędne z zupełnie innego powiatu. Pin ląduje wtedy 300 km od
 * działki i to jest gorsze niż brak pinu: kupujący jedzie w złe miejsce.
 *
 * Ścieżka administracyjna z feedu (`locationFull`: ulica, miasto, gmina, powiat,
 * województwo) powstaje NIEZALEŻNIE od współrzędnych, więc nadaje się na kontrolę
 * krzyżową. Jeśli oba źródła się kłócą, ufamy opisowi i odrzucamy współrzędne, bo opis
 * pisał człowiek znający działkę, a punkt wybrała maszyna zgadująca z nazwy.
 *
 * Gdy w tekście nie ma województwa, zwracamy `true` — brak danych to nie jest dowód błędu.
 */
export function coordsMatchLocationText(
  lat: number,
  lng: number,
  locationText: string | null | undefined,
): boolean {
  if (!isValidLatLng(lat, lng)) return false;

  const text = normalize(locationText ?? '');
  if (!text) return true;

  const part = PARTS_BY_NAME_LENGTH.find((p) => text.includes(p.name));
  if (!part) return true;

  const t = VOIVODESHIP_TOLERANCE;
  return (
    lat >= part.latMin - t &&
    lat <= part.latMax + t &&
    lng >= part.lngMin - t &&
    lng <= part.lngMax + t
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
  /** Opis lokalizacji z feedu (locationFull). Podany, włącza kontrolę krzyżową
   *  z województwem — patrz `coordsMatchLocationText`. */
  locationText?: string | null,
): { lat: number; lng: number } | null {
  if (!isValidLatLng(lat, lng)) return null;
  if (!isInPoland(lat as number, lng as number)) return null;
  if (locationText !== undefined && !coordsMatchLocationText(lat as number, lng as number, locationText)) {
    return null;
  }
  return { lat: lat as number, lng: lng as number };
}
