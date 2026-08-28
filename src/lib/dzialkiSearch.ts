// Wspólna logika dopasowania ofert do zapytania wyszukiwarki (geo + tekst).
//
// Wyniesione z `app/api/dzialki/route.ts`, żeby DOKŁADNIE ta sama logika obsługiwała:
//   1) wyszukiwarkę (`GET /api/dzialki`),
//   2) silnik alertów e-mail (`src/lib/alertEmails.ts`).
// Jedno źródło prawdy — wyniki wyszukiwania i dopasowania alertu nie mogą się rozjechać
// (lekcja z P3: komparator liczony raz, tu: kryteria liczone raz, w jednym miejscu).

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const IGNORED_QUERY_WORDS = new Set([
  'polska',
  'poland',
  'wojewodztwo',
  'województwo',
  'woj',
  'powiat',
  'gmina',
  'miasto',
  'okolice',
  'okolicy',
  'dzialki',
  'dzialka',
]);

export function cleanSearchQuery(value: string) {
  const ignored = IGNORED_QUERY_WORDS;

  return normalizeText(value.replace(/\b\d{2}-\d{3}\b/g, ' ').replace(/\b\d{5}\b/g, ' '))
    .split(/[\s-]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .filter((x) => !ignored.has(x))
    .filter((x) => !/^\d+$/.test(x));
}

export type BBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

// Minimalny strukturalny kształt oferty potrzebny do dopasowania (Dzialka spełnia go z nadmiarem).
export type GeoOffer = {
  lat?: number | null;
  lng?: number | null;
  locationLabel?: string | null;
  locationFull?: string | null;
  parcelText?: string | null;
};

export type SearchArea = {
  type: 'city' | 'voivodeship';
  key: string;
  label: string;
  aliases: string[];
  bbox: BBox;
};

export const VOIVODESHIPS: SearchArea[] = [
  { type: 'voivodeship', key: 'dolnoslaskie', label: 'dolnośląskie', aliases: ['dolnoslask', 'dolnoslaskie'], bbox: { minLat: 50.05, maxLat: 51.85, minLng: 14.75, maxLng: 17.85 } },
  { type: 'voivodeship', key: 'kujawsko-pomorskie', label: 'kujawsko-pomorskie', aliases: ['kujawsko', 'kujawsko pomorsk', 'kujawsko-pomorsk', 'pomorskie kujaw'], bbox: { minLat: 52.25, maxLat: 53.85, minLng: 17.20, maxLng: 19.75 } },
  { type: 'voivodeship', key: 'lubelskie', label: 'lubelskie', aliases: ['lubelsk', 'lubelskie'], bbox: { minLat: 50.15, maxLat: 52.35, minLng: 21.60, maxLng: 24.20 } },
  { type: 'voivodeship', key: 'lubuskie', label: 'lubuskie', aliases: ['lubusk', 'lubuskie'], bbox: { minLat: 51.35, maxLat: 53.15, minLng: 14.50, maxLng: 16.45 } },
  { type: 'voivodeship', key: 'lodzkie', label: 'łódzkie', aliases: ['lodzk', 'lodzkie'], bbox: { minLat: 50.80, maxLat: 52.40, minLng: 18.05, maxLng: 20.75 } },
  { type: 'voivodeship', key: 'malopolskie', label: 'małopolskie', aliases: ['malopolsk', 'malopolskie'], bbox: { minLat: 49.15, maxLat: 50.55, minLng: 19.05, maxLng: 21.45 } },
  { type: 'voivodeship', key: 'mazowieckie', label: 'mazowieckie', aliases: ['mazowieck', 'mazowieckie'], bbox: { minLat: 51.00, maxLat: 53.50, minLng: 19.25, maxLng: 23.15 } },
  { type: 'voivodeship', key: 'opolskie', label: 'opolskie', aliases: ['opolsk', 'opolskie'], bbox: { minLat: 49.95, maxLat: 51.25, minLng: 16.85, maxLng: 18.70 } },
  { type: 'voivodeship', key: 'podkarpackie', label: 'podkarpackie', aliases: ['podkarpack', 'podkarpackie'], bbox: { minLat: 49.00, maxLat: 50.85, minLng: 21.15, maxLng: 23.65 } },
  { type: 'voivodeship', key: 'podlaskie', label: 'podlaskie', aliases: ['podlask', 'podlaskie'], bbox: { minLat: 52.25, maxLat: 54.45, minLng: 21.55, maxLng: 23.95 } },
  { type: 'voivodeship', key: 'pomorskie', label: 'pomorskie', aliases: ['pomorsk', 'pomorskie'], bbox: { minLat: 53.45, maxLat: 54.85, minLng: 16.70, maxLng: 19.85 } },
  { type: 'voivodeship', key: 'slaskie', label: 'śląskie', aliases: ['slask', 'slaskie'], bbox: { minLat: 49.35, maxLat: 51.25, minLng: 18.00, maxLng: 19.95 } },
  { type: 'voivodeship', key: 'swietokrzyskie', label: 'świętokrzyskie', aliases: ['swietokrzysk', 'swietokrzyskie'], bbox: { minLat: 50.15, maxLat: 51.35, minLng: 19.70, maxLng: 21.75 } },
  { type: 'voivodeship', key: 'warminsko-mazurskie', label: 'warmińsko-mazurskie', aliases: ['warminsko', 'mazursk', 'warminsko mazursk', 'warminsko-mazursk'], bbox: { minLat: 53.15, maxLat: 54.55, minLng: 19.10, maxLng: 22.80 } },
  { type: 'voivodeship', key: 'wielkopolskie', label: 'wielkopolskie', aliases: ['wielkopolsk', 'wielkopolskie'], bbox: { minLat: 51.05, maxLat: 53.65, minLng: 15.75, maxLng: 18.75 } },
  { type: 'voivodeship', key: 'zachodniopomorskie', label: 'zachodniopomorskie', aliases: ['zachodniopomorsk', 'zachodnio pomorsk', 'zachodnio-pomorsk'], bbox: { minLat: 52.55, maxLat: 54.85, minLng: 14.10, maxLng: 16.95 } },
];

const CITY_AREAS: SearchArea[] = [
  { type: 'city', key: 'wroclaw', label: 'Wrocław', aliases: ['wroclaw', 'wrocław'], bbox: { minLat: 51.015, maxLat: 51.215, minLng: 16.780, maxLng: 17.205 } },
  { type: 'city', key: 'warszawa', label: 'Warszawa', aliases: ['warszawa', 'warsaw'], bbox: { minLat: 52.095, maxLat: 52.370, minLng: 20.780, maxLng: 21.270 } },
  { type: 'city', key: 'krakow', label: 'Kraków', aliases: ['krakow', 'kraków'], bbox: { minLat: 49.965, maxLat: 50.130, minLng: 19.790, maxLng: 20.220 } },
  { type: 'city', key: 'lodz', label: 'Łódź', aliases: ['lodz', 'łódź'], bbox: { minLat: 51.685, maxLat: 51.855, minLng: 19.320, maxLng: 19.640 } },
  { type: 'city', key: 'poznan', label: 'Poznań', aliases: ['poznan', 'poznań'], bbox: { minLat: 52.300, maxLat: 52.510, minLng: 16.735, maxLng: 17.070 } },
  { type: 'city', key: 'gdansk', label: 'Gdańsk', aliases: ['gdansk', 'gdańsk'], bbox: { minLat: 54.250, maxLat: 54.465, minLng: 18.450, maxLng: 18.950 } },
  { type: 'city', key: 'szczecin', label: 'Szczecin', aliases: ['szczecin'], bbox: { minLat: 53.300, maxLat: 53.560, minLng: 14.380, maxLng: 14.820 } },
  { type: 'city', key: 'bydgoszcz', label: 'Bydgoszcz', aliases: ['bydgoszcz'], bbox: { minLat: 53.040, maxLat: 53.220, minLng: 17.850, maxLng: 18.210 } },
  { type: 'city', key: 'lublin', label: 'Lublin', aliases: ['lublin'], bbox: { minLat: 51.145, maxLat: 51.340, minLng: 22.430, maxLng: 22.700 } },
  { type: 'city', key: 'bialystok', label: 'Białystok', aliases: ['bialystok', 'białystok'], bbox: { minLat: 53.060, maxLat: 53.210, minLng: 23.040, maxLng: 23.300 } },
  { type: 'city', key: 'katowice', label: 'Katowice', aliases: ['katowice'], bbox: { minLat: 50.150, maxLat: 50.335, minLng: 18.850, maxLng: 19.150 } },
  { type: 'city', key: 'rzeszow', label: 'Rzeszów', aliases: ['rzeszow', 'rzeszów'], bbox: { minLat: 49.940, maxLat: 50.115, minLng: 21.890, maxLng: 22.120 } },
  { type: 'city', key: 'torun', label: 'Toruń', aliases: ['torun', 'toruń'], bbox: { minLat: 52.950, maxLat: 53.080, minLng: 18.460, maxLng: 18.750 } },
  { type: 'city', key: 'olsztyn', label: 'Olsztyn', aliases: ['olsztyn'], bbox: { minLat: 53.700, maxLat: 53.850, minLng: 20.330, maxLng: 20.620 } },
  { type: 'city', key: 'kielce', label: 'Kielce', aliases: ['kielce'], bbox: { minLat: 50.790, maxLat: 50.950, minLng: 20.500, maxLng: 20.780 } },
  { type: 'city', key: 'opole', label: 'Opole', aliases: ['opole'], bbox: { minLat: 50.600, maxLat: 50.760, minLng: 17.790, maxLng: 18.060 } },
  { type: 'city', key: 'zielona-gora', label: 'Zielona Góra', aliases: ['zielona gora', 'zielona-gora', 'zielona góra'], bbox: { minLat: 51.840, maxLat: 52.020, minLng: 15.350, maxLng: 15.700 } },
  { type: 'city', key: 'gorzow-wielkopolski', label: 'Gorzów Wielkopolski', aliases: ['gorzow', 'gorzow wielkopolski', 'gorzów', 'gorzów wielkopolski'], bbox: { minLat: 52.650, maxLat: 52.820, minLng: 15.100, maxLng: 15.360 } },
];

function getLocationHaystack(d: GeoOffer) {
  return normalizeText([d.locationLabel, d.locationFull, d.parcelText].filter(Boolean).join(' '));
}

/* Nazwy województw zawierają się w sobie: „wielk-OPOLSK-ie" zawiera alias opolskiego,
 * a „zachodni-OPOMORSK-ie" oraz „kujawsko-POMORSK-ie" zawierają alias pomorskiego.
 * Szukanie „pierwszego pasującego w kolejności listy" oddawało więc zapytanie
 * o Wielkopolskę Opolszczyźnie, a o Pomorze Zachodnie Pomorzu (potwierdzone testem).
 * Indeks jest posortowany od NAJDŁUŻSZEGO aliasu, więc bardziej szczegółowe dopasowanie
 * zawsze wygrywa z ogólniejszym, niezależnie od kolejności wpisów w tablicy. */
function buildAliasIndex(areas: SearchArea[]) {
  return areas
    .flatMap((area) => area.aliases.map((alias) => ({ alias: normalizeText(alias), area })))
    .filter((entry) => entry.alias.length > 0)
    .sort((a, b) => b.alias.length - a.alias.length);
}

const VOIVODESHIP_ALIAS_INDEX = buildAliasIndex(VOIVODESHIPS);
const CITY_ALIAS_INDEX = buildAliasIndex(CITY_AREAS);

/* Słowa doklejane do nazwy obszaru, które nie zmieniają tego, JAKIEGO obszaru dotyczy
 * zapytanie („działki mazowieckie" to wciąż zapytanie o mazowieckie). */
const AREA_NOISE_WORDS = new Set([
  ...IGNORED_QUERY_WORDS,
  'dzialke', 'dzialek', 'dzialkami',
  'grunt', 'grunty', 'gruntow', 'dzialkowe',
  'budowlana', 'budowlane', 'budowlany', 'budowlanych',
  'rolna', 'rolne', 'rolny', 'rolnych',
  'lesna', 'lesne', 'rekreacyjna', 'rekreacyjne',
  'inwestycyjna', 'inwestycyjne', 'siedliskowa', 'siedliskowe',
  'na', 'sprzedaz', 'wynajem', 'oferty', 'oferta', 'tanie', 'tanio', 'szukam',
]);

/* Czy `core` to CAŁA nazwa obszaru, a nie jej kawałek doklejony do czegoś innego.
 * Dopuszczamy wyłącznie doklejenie końcówki fleksyjnej („dolnoslask" + „ie"),
 * nigdy dodatkowych słów ani liter z przodu. */
function isWholeAreaName(core: string, alias: string): boolean {
  if (core === alias) return true;
  if (!core.startsWith(alias)) return false;
  const rest = core.slice(alias.length);
  return rest.length <= 4 && /^[a-z]+$/.test(rest);
}

/**
 * Województwo rozpoznajemy TYLKO wtedy, gdy zapytanie jest w istocie nazwą województwa
 * (po odsianiu słów typu „działki", „na sprzedaż", „woj.").
 *
 * Wcześniej wystarczyło, że alias gdziekolwiek się zawierał, i to sypało trafnością,
 * bo polskie nazwy miast noszą przymiotniki regionalne albo przypadkiem zawierają cudzy
 * rdzeń. Zmierzone na produkcji: „Kłodzko" wykrywało łódzkie (k-ŁODZK-o), „Biała Podlaska"
 * podlaskie zamiast lubelskiego, „Sokołów Podlaski" podlaskie zamiast mazowieckiego,
 * „Środa Śląska" śląskie zamiast dolnośląskiego. Skutek był dotkliwy, bo dopasowanie do
 * województwa ląduje w grupie 1: szukający działki pod Kłodzkiem dostawał na samej górze
 * całe województwo łódzkie.
 *
 * `detectCity` celowo zostaje przy dopasowaniu częściowym: prostokąt miasta jest mały,
 * więc fałszywe trafienie kosztuje niewiele, a częściowe dopasowanie jest tam potrzebne
 * (np. „Warszawa Wilanów"). Przy województwie fałszywe trafienie rozlewa wyniki
 * na jedną szesnastą kraju, więc próg musi być ostrzejszy.
 */
export function detectVoivodeship(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  const core = normalized
    .split(' ')
    .filter((word) => word && !AREA_NOISE_WORDS.has(word))
    .join(' ');
  if (!core) return null;

  return VOIVODESHIP_ALIAS_INDEX.find((entry) => isWholeAreaName(core, entry.alias))?.area ?? null;
}

export function detectCity(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  return CITY_ALIAS_INDEX.find((entry) => normalized.includes(entry.alias))?.area ?? null;
}

// Hub SEO (P13): odczyt bboxa województwa po kluczu (slug) — ta sama prostokątna definicja,
// której używa wyszukiwarka (voivodeshipAreaMatch), więc liczba ofert na stronie województwa
// pokrywa się 1:1 z listą.
export function getVoivodeshipByKey(key: string): SearchArea | null {
  return VOIVODESHIPS.find((area) => area.key === key) ?? null;
}

function kmToLatDegrees(km: number) {
  return km / 111.32;
}

function kmToLngDegrees(km: number, atLat: number) {
  const cos = Math.cos((atLat * Math.PI) / 180);
  if (Math.abs(cos) < 0.01) return km / 111.32;
  return km / (111.32 * cos);
}

function expandBBoxByKm(bbox: BBox, km: number): BBox {
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const latPad = kmToLatDegrees(km);
  const lngPad = kmToLngDegrees(km, midLat);

  return {
    minLat: bbox.minLat - latPad,
    maxLat: bbox.maxLat + latPad,
    minLng: bbox.minLng - lngPad,
    maxLng: bbox.maxLng + lngPad,
  };
}

function coordsInBBox(d: GeoOffer, bbox: BBox) {
  return hasCoords(d) && d.lat! >= bbox.minLat && d.lat! <= bbox.maxLat && d.lng! >= bbox.minLng && d.lng! <= bbox.maxLng;
}

/* Końcówki, o które nazwa miejscowości może się różnić i wciąż być TĄ SAMĄ nazwą — czyli
 * polska odmiana przez przypadki („Gdansk" → „Gdanska", „Radom" → „Radomiu", „Poznan" →
 * „Poznania"). Zapis po normalizacji, więc bez ogonków. Zamknięta lista, a nie „dowolne dwie
 * litery", bo doklejka spoza odmiany robi z miasta INNE miasto: „Radom" + „in" = Radomin
 * (280 km dalej), „Radom" + „sko" = Radomsko. */
const INFLECTION_SUFFIXES = new Set([
  'a', 'e', 'i', 'o', 'u', 'y',
  'ia', 'ie', 'iu', 'ej', 'em', 'om', 'ow', 'ym',
  // Przymiotnik od nazwy miasta, czyli jak w danych zapisany jest powiat i gmina:
  // „Ostrow" → „ostrowski", „Radom" → „radomski". locationFull to ścieżka administracyjna
  // (ulica, miejscowość, gmina, powiat, województwo), więc bez tego zapytanie o miasto
  // nie trafia w oferty z sąsiednich wsi tego samego powiatu.
  // Świadomie BEZ „kie": „lodz" + „kie" to województwo łódzkie, nie miasto Łódź — a od tego
  // zaczęła się cała ta historia (zapytanie o miasto zwracające jedną szesnastą kraju).
  // Tylko forma męska, w jakiej zapisany jest POWIAT („ostrowski", „radomski"). Formy „skie"/
  // „ska" odpadły po teście na żywych danych: „Strzałków" łapało wtedy „Miszewko Strzałkowskie"
  // spod Płocka, bo przymiotnik jest też częścią nazw samych wsi.
  'ski', 'cki',
]);

/* Najkrótszy rdzeń, dla którego w ogóle dopuszczamy doklejenie końcówki. Poniżej tego progu
 * wymagamy dokładnego słowa: krótkie kawałki („r." z adresu, inicjały, „os.") pasowałyby do
 * setek nazw. Cztery litery, bo tyle ma „Lodz" — bez tego „Łodzi" nie trafia w „Łódź". */
const MIN_STEM_LENGTH = 4;

/* Czy token z oferty i fraza z zapytania to ta sama nazwa.
 *
 * REGRESJA (błąd żył na produkcji): warunek był „którekolwiek jest prefiksem drugiego", bez
 * limitu długości doklejki. Skutki zmierzone na żywej bazie: zapytanie „Radomsko" zwracało
 * działki w RADOMIU (bo „radomsko".startsWith("radom")), a oferta z adresem „Powstańców 1863 r.,
 * Nałęczów" trafiała do KAŻDEGO zapytania na literę „r" (token „r" jest prefiksem „radomsko”).
 * Dopasowanie podciągiem w gołym tekście (`haystack.includes`) robiło to samo w drugą stronę:
 * „Radom" wciągał Radomsko, Radomierz i Radomyśl. */
function tokenMatchesTerm(token: string, term: string) {
  if (token === term) return true;

  const [longer, shorter] = token.length >= term.length ? [token, term] : [term, token];
  if (shorter.length < MIN_STEM_LENGTH) return false;
  if (!longer.startsWith(shorter)) return false;

  return INFLECTION_SUFFIXES.has(longer.slice(shorter.length));
}

function matchesLocationText(d: GeoOffer, terms: string[]) {
  if (!terms.length) return false;

  const haystack = getLocationHaystack(d);
  if (!haystack) return false;

  const tokens = haystack
    .split(/[\s-]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (!tokens.length) return false;

  return terms.every((term) => tokens.some((token) => tokenMatchesTerm(token, term)));
}

export type SearchContext = {
  query: string;
  terms: string[];
  city: SearchArea | null;
  voivodeship: SearchArea | null;
  cityBBox: BBox | null;
  latParam: number;
  lngParam: number;
  radiusParam: number;
  hasRadiusSearch: boolean;
};

// Liczone RAZ na zapytanie (nie zależy od pojedynczej oferty): wykrycie miasta/województwa,
// rozszerzony bbox miasta i oczyszczone frazy. Wcześniej te same skany leciały dla każdej oferty.
export function buildSearchContext(
  query: string,
  latParam: number,
  lngParam: number,
  radiusParam: number,
  hasRadiusSearch: boolean
): SearchContext {
  const city = query ? detectCity(query) : null;
  const voivodeship = query ? detectVoivodeship(query) : null;

  const cityBBox =
    city && hasRadiusSearch
      ? expandBBoxByKm(city.bbox, radiusParam)
      : city
        ? city.bbox
        : null;

  return {
    query,
    terms: query ? cleanSearchQuery(query) : [],
    city,
    voivodeship,
    cityBBox,
    latParam,
    lngParam,
    radiusParam,
    hasRadiusSearch,
  };
}

// Prostokąt-nadzbiór wszystkich trafień GEO dla wyszukiwania z promieniem — do pre-filtra w SQL.
//
// Gdy `hasRadiusSearch`, oferta ZE współrzędnymi trafia wyłącznie geograficznie (patrz
// getSearchMatchInfo: dla takiej oferty `textFallbackMatch` = false). Wszystkie takie trafienia
// leżą w sumie prostokątów: koło promienia (± radius wokół punktu) ∪ bbox miasta ∪ bbox
// województwa. Zwracamy jeden prostokąt obejmujący tę sumę — baza odsiewa oferty ze współrzędnymi
// poza nim (nie mogą trafić), a JS dalej liczy dokładny `anyMatch`. To NADZBIÓR: nigdy nie gubi
// trafienia, co najwyżej przepuści kilka rekordów za dużo (odrzuci je precyzyjny JS).
//
// Oferty BEZ współrzędnych trafiają tekstem (textFallbackMatch) — obsługiwane osobno przez
// `OR lat IS NULL` po stronie zapytania. Bez promienia (czysty tekst) zwracamy null: tekst może
// pasować gdziekolwiek, więc bezpiecznego prostokąta nie ma.
export function computeGeoPrefilterBBox(ctx: SearchContext): BBox | null {
  if (!ctx.hasRadiusSearch) return null;

  const latPad = kmToLatDegrees(ctx.radiusParam);
  const lngPad = kmToLngDegrees(ctx.radiusParam, ctx.latParam);

  const boxes: BBox[] = [
    {
      minLat: ctx.latParam - latPad,
      maxLat: ctx.latParam + latPad,
      minLng: ctx.lngParam - lngPad,
      maxLng: ctx.lngParam + lngPad,
    },
  ];

  if (ctx.cityBBox) boxes.push(ctx.cityBBox);
  if (ctx.voivodeship) boxes.push(ctx.voivodeship.bbox);

  return {
    minLat: Math.min(...boxes.map((b) => b.minLat)),
    maxLat: Math.max(...boxes.map((b) => b.maxLat)),
    minLng: Math.min(...boxes.map((b) => b.minLng)),
    maxLng: Math.max(...boxes.map((b) => b.maxLng)),
  };
}

export function getSearchMatchInfo(d: GeoOffer, ctx: SearchContext) {
  const {
    query,
    terms,
    city,
    voivodeship,
    cityBBox,
    latParam,
    lngParam,
    radiusParam,
    hasRadiusSearch,
  } = ctx;

  const radiusDistance = hasRadiusSearch && hasCoords(d)
    ? haversineKm(latParam, lngParam, d.lat!, d.lng!)
    : null;

  const pointRadiusMatch = radiusDistance !== null && radiusDistance <= radiusParam;

  const cityAreaMatch = cityBBox ? coordsInBBox(d, cityBBox) : false;
  const voivodeshipAreaMatch = voivodeship ? coordsInBBox(d, voivodeship.bbox) : false;

  const textMatch = query ? matchesLocationText(d, terms) : false;
  const textFallbackMatch = query && (!hasRadiusSearch || !hasCoords(d)) ? textMatch : false;

  const anyMatch =
    voivodeshipAreaMatch ||
    cityAreaMatch ||
    pointRadiusMatch ||
    textFallbackMatch;

  let group = 99;

  if (voivodeshipAreaMatch) group = 1;
  else if (cityAreaMatch) group = 1;
  else if (pointRadiusMatch) group = 2;
  else if (textFallbackMatch) group = 3;

  return {
    city,
    voivodeship,
    radiusDistance,
    pointRadiusMatch,
    cityAreaMatch,
    voivodeshipAreaMatch,
    textMatch,
    textFallbackMatch,
    anyMatch,
    group,
  };
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 =
    Math.cos((aLat * Math.PI) / 180) *
    Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

export function hasCoords(d: GeoOffer) {
  return typeof d.lat === 'number' && typeof d.lng === 'number';
}
