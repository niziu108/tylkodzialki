// Kreator „najpierw działka": z działki, którą sprzedający sam wskazał (numer z dokumentów albo
// kliknięcie na mapie z granicami), składamy pola ogłoszenia i podpowiedź ceny.
//
// Zasada jak w „Sprawdź działkę": każda dana prawdziwa albo pominięta ([[feedback-filtry-twarde]]).
// Z ewidencji i planu bierzemy tylko to, co rejestry mówią o TEJ działce. Mediów, dojazdu ani
// ceny nie zgadujemy, a wszystko, co uzupełniliśmy, sprzedający może poprawić.
//
// Czyste funkcje bez sieci i bazy: to reguły, które wyglądają na oczywiste i cicho się psują,
// więc mają testy ([[project-testy]]).

import type { CenaDecision } from './raportCena';
import type { MpzpInfo } from './mpzp';
import type { RcnOkolica } from './rcnStats';
import type { PointValuation } from './seoHub';
import type { LatLng, ParcelReport } from './uldk';
import { powiatLabelFromUldk } from './uldkQuery';

export type PrzeznaczenieKod =
  | 'INWESTYCYJNA'
  | 'BUDOWLANA'
  | 'ROLNA'
  | 'LESNA'
  | 'REKREACYJNA'
  | 'SIEDLISKOWA';

/** To, czego kreator potrzebuje z odpowiedzi POST /api/sprawdz-dzialke. */
export type DaneDzialki = {
  parcel: ParcelReport;
  valuation: PointValuation;
  mpzp: MpzpInfo | null;
  rcn: RcnOkolica | null;
};

// ── Przeznaczenie z planu miejscowego ────────────────────────────────────────
// Tylko symbole, które jednoznacznie odpowiadają kategorii ogłoszenia. Zieleń, drogi, wody,
// infrastruktura i usługi publiczne (szkoła, przychodnia) nie mają odpowiednika, więc wtedy
// wybór zostaje przy sprzedającym.
const SYMBOLE: Record<string, PrzeznaczenieKod> = {
  MN: 'BUDOWLANA',
  MNU: 'BUDOWLANA',
  MW: 'BUDOWLANA',
  MWU: 'BUDOWLANA',
  MU: 'BUDOWLANA',
  MR: 'BUDOWLANA',
  M: 'BUDOWLANA',
  RM: 'SIEDLISKOWA',
  ML: 'REKREACYJNA',
  UTL: 'REKREACYJNA',
  U: 'INWESTYCYJNA',
  UC: 'INWESTYCYJNA',
  UH: 'INWESTYCYJNA',
  P: 'INWESTYCYJNA',
  PU: 'INWESTYCYJNA',
  PS: 'INWESTYCYJNA',
  R: 'ROLNA',
  RP: 'ROLNA',
  RZ: 'ROLNA',
  RL: 'ROLNA',
  RO: 'ROLNA',
  ZL: 'LESNA',
};

// Teren „MN/U" to dwie funkcje naraz; więcej niż dwie kategorie w ogłoszeniu to już szum.
const MAX_Z_PLANU = 2;

// „4MN", „MN.2", „A.1.MN", „MN/U": numer terenu i prefiks obszaru odpadają, a symbol funkcji
// stoi na końcu każdego członu. Człony łączą ukośnik, przecinek albo łącznik.
function symboleFunkcji(symbol: string): string[] {
  return symbol
    .toUpperCase()
    .split(/[/,;+&-]/)
    .map((czesc) => {
      const litery = czesc.match(/[A-ZĄĆĘŁŃÓŚŹŻ]+/g);
      return litery ? litery[litery.length - 1] : '';
    })
    .filter(Boolean);
}

// Gdy gmina nie podała symbolu albo jest nietypowy, czytamy opis terenu.
function przeznaczeniaZNazwy(nazwa: string): PrzeznaczenieKod[] {
  const n = nazwa.toLowerCase();
  const wynik: PrzeznaczenieKod[] = [];
  if (/zabudow\p{L}* mieszkaniow/u.test(n)) wynik.push('BUDOWLANA');
  if (/zagrodow/u.test(n)) wynik.push('SIEDLISKOWA');
  if (/letnisk|rekreacji indywidualnej/u.test(n)) wynik.push('REKREACYJNA');
  const uslugiKomercyjne = /usług/u.test(n) && !/publiczn|oświat|zdrowi|kultu|sakraln|sport/u.test(n);
  if (uslugiKomercyjne || /produkc|przemysł|skład|magazyn/u.test(n)) wynik.push('INWESTYCYJNA');
  if (wynik.length === 0 && /roln|upraw/u.test(n)) wynik.push('ROLNA');
  if (wynik.length === 0 && /(^|[^\p{L}])las|leśn|lesn/u.test(n)) wynik.push('LESNA');
  return wynik;
}

/**
 * Kategorie ogłoszenia wynikające z planu miejscowego w środku działki. Pusta lista = plan nie
 * mówi nic, co da się uczciwie przełożyć na kategorię (albo planu nie ma).
 */
export function przeznaczeniaZPlanu(
  plan: Pick<MpzpInfo, 'functionSymbol' | 'functionName'> | null
): PrzeznaczenieKod[] {
  if (!plan) return [];
  const zSymbolu = symboleFunkcji(plan.functionSymbol ?? '')
    .map((s) => SYMBOLE[s])
    .filter((p): p is PrzeznaczenieKod => Boolean(p));
  const wynik = zSymbolu.length > 0 ? zSymbolu : przeznaczeniaZNazwy(plan.functionName ?? '');
  return [...new Set(wynik)].slice(0, MAX_Z_PLANU);
}

// ── Nazwy z ewidencji ────────────────────────────────────────────────────────

/** Ewidencja pisze nazwy wersalikami („DOMIECHOWICE"); w ogłoszeniu ma być „Domiechowice". */
export function ladnaNazwa(nazwa: string): string {
  const s = nazwa.trim();
  if (!/\p{L}/u.test(s) || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_m, przed: string, litera: string) => przed + litera.toUpperCase());
}

/** „Zelów (miasto)", „Kleszczów - obszar wiejski" → „Zelów", „Kleszczów". */
export function czystaNazwaGminy(commune: string): string {
  return commune
    .replace(/\s*\((?:miasto|gmina[^)]*|obszar wiejski)\)\s*$/i, '')
    .replace(/\s+[-–]\s+(?:miasto|obszar wiejski|gmina wiejska|gmina miejska)\s*$/i, '')
    .trim();
}

// Cyfra po podkreślniku w identyfikatorze to rodzaj gminy z TERYT: 1 gmina miejska, 4 miasto w
// gminie miejsko-wiejskiej, 8 dzielnica Warszawy, 9 delegatura. Pewniejsze niż zgadywanie z nazwy.
function wMiescie(parcelId: string): boolean {
  const rodzaj = parcelId.match(/^\d{6}_(\d)/)?.[1];
  return rodzaj === '1' || rodzaj === '4' || rodzaj === '8' || rodzaj === '9';
}

/**
 * Miejscowość do ogłoszenia. Na wsi obręb nazywa się jak wieś („Domiechowice"), więc bierzemy
 * obręb. W mieście obręby mają numery („0008") albo nazwy części miasta, a kupujący szuka miasta,
 * więc bierzemy gminę.
 */
export function nazwaMiejscowosci(p: Pick<ParcelReport, 'id' | 'region' | 'commune'>): string {
  const gmina = ladnaNazwa(czystaNazwaGminy(p.commune));
  const obrebToNazwa = /\p{L}{3,}/u.test(p.region) && !/\d/.test(p.region);
  if (!wMiescie(p.id) && obrebToNazwa) return ladnaNazwa(p.region);
  return gmina || ladnaNazwa(p.region);
}

/**
 * Pełna ścieżka do `locationFull`. Ostatni człon to samo województwo („łódzkie"), bo strona oferty
 * rozpoznaje je po ostatnim tokenie (dane strukturalne addressRegion).
 */
export function lokalizacjaPelna(
  p: Pick<ParcelReport, 'id' | 'region' | 'commune' | 'county' | 'voivodeship'>
): string {
  const czesci = [nazwaMiejscowosci(p)];
  const gmina = ladnaNazwa(czystaNazwaGminy(p.commune));
  if (gmina) czesci.push(`gmina ${gmina}`);
  if (p.county.trim()) czesci.push(powiatLabelFromUldk(p.county));
  if (p.voivodeship.trim()) czesci.push(p.voivodeship.trim().toLowerCase());
  return czesci.join(', ');
}

/** Opis działki ewidencyjnej do `parcelText` (trafia też do wyszukiwarki ofert). */
export function opisDzialkiEwidencyjnej(p: Pick<ParcelReport, 'region' | 'parcelNumber'>): string {
  const obreb = ladnaNazwa(p.region);
  return obreb ? `obręb ${obreb}, działka ${p.parcelNumber}` : `działka ${p.parcelNumber}`;
}

// ── Pinezka ──────────────────────────────────────────────────────────────────

/**
 * Czy punkt leży w działce. Parzystość przecięć po wszystkich pierścieniach, więc otwory w działce
 * liczą się same. Kreator sprawdza tym, czy pinezka nadal stoi na działce, której dane uzupełnił.
 */
export function punktWDzialce(punkt: LatLng, rings: LatLng[][]): boolean {
  return wDzialce(punkt, rings);
}

function wDzialce(punkt: LatLng, rings: LatLng[][]): boolean {
  let wewnatrz = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (
        a.lat > punkt.lat !== b.lat > punkt.lat &&
        punkt.lng < ((b.lng - a.lng) * (punkt.lat - a.lat)) / (b.lat - a.lat) + a.lng
      ) {
        wewnatrz = !wewnatrz;
      }
    }
  }
  return wewnatrz;
}

/**
 * Punkt na pinezkę oferty, który na pewno leży W działce. Średnia wierzchołków działki w kształcie
 * litery L albo długiego łuku potrafi wypaść u sąsiada, a z pinezki oferty ustalamy później działkę
 * do raportu (lib/raportOferty.ts), więc pudło przypisałoby ogłoszeniu cudzą działkę.
 */
export function punktWewnatrzDzialki(rings: LatLng[][]): LatLng | null {
  const punkty = rings.flat();
  if (punkty.length === 0) return null;

  const srodek = {
    lat: punkty.reduce((s, p) => s + p.lat, 0) / punkty.length,
    lng: punkty.reduce((s, p) => s + p.lng, 0) / punkty.length,
  };
  if (wDzialce(srodek, rings)) return srodek;

  // Pozioma linia przez środek: przecięcia z krawędziami wyznaczają odcinki leżące w działce.
  // Bierzemy środek najdłuższego z nich.
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a.lat > srodek.lat !== b.lat > srodek.lat) {
        xs.push(a.lng + ((srodek.lat - a.lat) * (b.lng - a.lng)) / (b.lat - a.lat));
      }
    }
  }
  xs.sort((a, b) => a - b);

  let najdluzszy: [number, number] | null = null;
  for (let k = 0; k + 1 < xs.length; k += 2) {
    if (!najdluzszy || xs[k + 1] - xs[k] > najdluzszy[1] - najdluzszy[0]) {
      najdluzszy = [xs[k], xs[k + 1]];
    }
  }
  return najdluzszy ? { lat: srodek.lat, lng: (najdluzszy[0] + najdluzszy[1]) / 2 } : srodek;
}

// ── Tytuł ────────────────────────────────────────────────────────────────────

// W tytule jedna kategoria: ta, której kupujący szuka najczęściej i za którą płaci najwięcej.
const KOLEJNOSC_W_TYTULE: PrzeznaczenieKod[] = [
  'BUDOWLANA',
  'SIEDLISKOWA',
  'REKREACYJNA',
  'INWESTYCYJNA',
  'ROLNA',
  'LESNA',
];

const PRZYMIOTNIK: Record<PrzeznaczenieKod, string> = {
  BUDOWLANA: 'budowlana',
  SIEDLISKOWA: 'siedliskowa',
  REKREACYJNA: 'rekreacyjna',
  INWESTYCYJNA: 'inwestycyjna',
  ROLNA: 'rolna',
  LESNA: 'leśna',
};

export const MAX_TYTUL = 90;

function liczbaZeSpacjami(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** „1 200 m²", a od hektara w górę „2,35 ha", bo tak piszą o dużych działkach wszyscy. */
export function powierzchniaDoTytulu(m2: number): string {
  if (m2 >= 10_000) {
    const ha = Math.round((m2 / 10_000) * 100) / 100;
    return `${String(ha).replace('.', ',')} ha`;
  }
  return `${liczbaZeSpacjami(m2)} m²`;
}

export function tytulAutomatyczny(dane: {
  przeznaczenia: string[];
  powierzchniaM2: number;
  miejscowosc: string;
}): string {
  const glowne = KOLEJNOSC_W_TYTULE.find((p) => dane.przeznaczenia.includes(p));
  let tytul = glowne ? `Działka ${PRZYMIOTNIK[glowne]}` : 'Działka';
  if (Number.isFinite(dane.powierzchniaM2) && dane.powierzchniaM2 > 0) {
    tytul += ` ${powierzchniaDoTytulu(dane.powierzchniaM2)}`;
  }
  const miejscowosc = dane.miejscowosc.trim();
  if (miejscowosc) tytul += `, ${miejscowosc}`;
  return tytul.slice(0, MAX_TYTUL);
}

// ── Podpowiedź ceny ──────────────────────────────────────────────────────────

export type PodpowiedzCeny = {
  // ceny z ogłoszeń w okolicy; ta sama pula i te same bramki pewności co w raporcie (lib/raportCena)
  ogloszenia: {
    etykieta: string;
    mediana: number;
    low: number;
    high: number;
    // rozrzut za duży na jedną liczbę: pokazujemy tylko widełki
    widelki: boolean;
    // pula zawężona do działek zbliżonej powierzchni; tylko wtedy wolno liczyć kwotę i procenty
    podobnaWielkosc: boolean;
    liczba: number;
    promienKm: number;
  } | null;
  // kwoty z aktów notarialnych (RCN); pomijamy, gdy najbliższe akty są już w innych miejscowościach
  transakcje: {
    mediana: number;
    low: number;
    high: number;
    liczba: number;
    promienKm: number;
    odRoku: number;
    doRoku: number;
    rolne: boolean;
  } | null;
};

// Od tego promienia raport sam ostrzega, że akty są już z innych miejscowości. W podpowiedzi dla
// sprzedającego taka liczba bardziej myli, niż pomaga.
export const RCN_MAX_KM = 35;

export function podpowiedzCeny(
  decyzja: CenaDecision,
  promienKm: number,
  rcn: RcnOkolica | null
): PodpowiedzCeny | null {
  const ogloszenia =
    decyzja.lead && decyzja.value
      ? {
          etykieta: decyzja.lead.label,
          mediana: decyzja.value.median,
          low: decyzja.value.low,
          high: decyzja.value.high,
          widelki: decyzja.mixed,
          podobnaWielkosc: decyzja.lead.kind === 'similar',
          liczba: decyzja.lead.stat.sampleCount,
          promienKm,
        }
      : null;

  const transakcje =
    rcn && rcn.liczba > 0 && rcn.promienKm < RCN_MAX_KM
      ? {
          mediana: rcn.medianaZlM2,
          low: rcn.low,
          high: rcn.high,
          liczba: rcn.liczba,
          promienKm: rcn.promienKm,
          odRoku: rcn.odRoku,
          doRoku: rcn.doRoku,
          rolne: rcn.klasa === 'rolna',
        }
      : null;

  if (!ogloszenia && !transakcje) return null;
  return { ogloszenia, transakcje };
}

// Różnica, przy której mówimy „mniej więcej tyle samo", zamiast straszyć procentem.
export const PROG_TYLE_SAMO_PROC = 5;

/**
 * Jak cena sprzedającego ma się do okolicy. Porównujemy wyłącznie z medianą ogłoszeń działek
 * podobnej wielkości: cena za metr spada z powierzchnią mocniej niż cokolwiek innego, więc hektar
 * zestawiony z działkami pod dom (albo z aktami działek każdej wielkości) wyszedłby „za tani".
 * `null` = nie ma uczciwego punktu odniesienia.
 */
export function porownanieCeny(zlM2: number, podpowiedz: PodpowiedzCeny): { procent: number } | null {
  if (!Number.isFinite(zlM2) || zlM2 <= 0) return null;
  const o = podpowiedz.ogloszenia;
  if (!o || o.widelki || !o.podobnaWielkosc || o.mediana <= 0) return null;
  return { procent: Math.round(((zlM2 - o.mediana) / o.mediana) * 100) };
}

/** Kwota za całą działkę z mediany zł/m², zaokrąglona tak, jak ludzie myślą o cenie. */
export function kwotaOrientacyjna(zlM2: number, m2: number): number {
  const kwota = zlM2 * m2;
  const krok = kwota >= 50_000 ? 1000 : 100;
  return Math.round(kwota / krok) * krok;
}

// ── Stan kreatora ────────────────────────────────────────────────────────────

/** Wskazana działka zapisywana w wersji roboczej ogłoszenia (localStorage), bez surowej odpowiedzi API. */
export type ZapisanaDzialka = {
  id: string;
  parcelNumber: string;
  region: string;
  commune: string;
  county: string;
  voivodeship: string;
  areaM2: number;
  rings: LatLng[][];
  plan: { symbol: string | null; nazwa: string | null } | null;
  przeznaczeniaZPlanu: PrzeznaczenieKod[];
  podpowiedz: PodpowiedzCeny | null;
};

/**
 * Działka do kreatora albo na stronę wyceny: dane z ewidencji, plan i podpowiedź ceny. Decyzję,
 * którą pulą cen prowadzimy, liczy wołający (lib/raportCena), żeby ten moduł nie ciągnął bazy.
 */
export function zapisanaDzialka(dane: DaneDzialki, decyzja: CenaDecision): ZapisanaDzialka {
  const p = dane.parcel;
  return {
    id: p.id,
    parcelNumber: p.parcelNumber,
    region: p.region,
    commune: p.commune,
    county: p.county,
    voivodeship: p.voivodeship,
    areaM2: p.areaM2,
    rings: p.rings,
    plan: dane.mpzp ? { symbol: dane.mpzp.functionSymbol, nazwa: dane.mpzp.functionName } : null,
    przeznaczeniaZPlanu: przeznaczeniaZPlanu(dane.mpzp),
    podpowiedz: podpowiedzCeny(decyzja, dane.valuation.radiusKm, dane.rcn),
  };
}
