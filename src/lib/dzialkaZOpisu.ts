/* Numer działki, który biuro samo wpisało w opis oferty („nr działki 325/8, obręb Radziwiłłów").
 *
 * Po co: oferty z CRM mają pinezkę przybliżoną do miejscowości, więc z punktu nie wolno
 * wyprowadzać działki ewidencyjnej. Co ósma oferta ma jednak numer podany przez samo biuro, a to
 * już nie zgadywanie, tylko dane ogłoszeniodawcy. Sprawdzamy je potem w ULDK
 * (lib/raportOferty.ts): ta sama gmina, blisko pinezki, zgodna powierzchnia.
 *
 * Osobny, bezzależnościowy moduł, bo to czyste reguły tekstowe: wyglądają na oczywiste i cicho
 * się psują, a testy nie mogą ciągnąć sieci ([[project-testy]]). */

import { plainText } from './formatOpis';
import { normalizeParcelNumber } from './uldkQuery';

export type NumeryZOpisu = {
  /** Pełne identyfikatory ewidencyjne (np. 143803_2.0028.325/8): najpewniejszy przypadek. */
  identyfikatory: string[];
  /** Numery działek w kolejności wystąpienia, bez powtórzeń („325/8"). */
  numery: string[];
  /** Nazwy obrębów podane w opisie („Bór Zapilski"). */
  obrebyNazwy: string[];
  /** Numery obrębów podane w opisie („0003"). */
  obrebyNumery: string[];
};

// Więcej numerów w jednym opisie to oferta kilku działek naraz; i tak nie wskażemy jednej.
const MAX = 3;

// Pełny identyfikator: WWPPGG_R.OOOO.[AR_n.]NR, np. 146510_8.0502.1/3 albo 060606_2.0014.AR_3.756.
const IDENTYFIKATOR_RE = /(?<![\d_])\d{6}_\d\.\d{4}\.(?:AR_\d+\.)?\d+(?:\/\d+)?(?![\d/])/g;

// Jeden numer działki: „325", „325/8", „12a". `(?!\d)` nie pozwala silnikowi cofnąć się w środek
// liczby, więc „775 m2" nie zamieni się w „77".
const CYFRY = String.raw`\d{1,6}(?!\d)`;
const LITERA = String.raw`(?:[a-z](?![\p{L}\d]))?`;
const JEDEN = String.raw`${CYFRY}${LITERA}(?:\s*\/\s*${CYFRY}${LITERA}){0,2}`;
// Liczba, po której stoi jednostka albo kolejny ukośnik, to nie numer działki („1500 m²", „20 x 30").
const NIE_JEDNOSTKA = String.raw`(?!\s*(?:m2|m²|m\b|mkw|ha\b|ar\b|ary\b|arów|zł|zl\b|pln|%|km\b|mb\b|x\s*\d|\/))`;
const NUMER = `${JEDEN}${NIE_JEDNOSTKA}`;
const ROZDZIELNIK = String.raw`\s*(?:,|;|\bi\b|\boraz\b)\s*`;
const LISTA = `${NUMER}(?:${ROZDZIELNIK}${NUMER})*`;

const PRZED = String.raw`(?<![\p{L}\d])`;
const EWID = String.raw`(?:(?:ewid(?:encyjn\p{L}*|\.)?|geodezyjn\p{L}*)\s*)`;
// „działka/działki/działkę" oraz liczba mnoga „działek" („Numery działek: 119/2, 130/15").
const DZIALKA = String.raw`(?:dzia[łl](?:k|ek)\p{L}*|dz\.)`;
const NR = String.raw`(?:nr|numer(?:ze|em|y|ami|ach)?)\.?`;
const SEP = String.raw`\s*[:\-–]?\s*`;

// „nr działki 43", „numer działki ewidencyjnej: 1660", „nr ewid. działki 12/3", „nr dz. 184/3"
const WZOR_A = String.raw`${PRZED}${NR}\s*${EWID}?${DZIALKA}\s*${EWID}?(?:nr\.?\s*)?${SEP}`;
// „działka nr 12", „działki nr 105/10 i 105/12", „działka o numerze ewidencyjnym 7/2", „dz. nr 5"
const WZOR_B = String.raw`${PRZED}${DZIALKA}\s*(?:ewidencyjn\p{L}*\s*)?(?:o\s+)?${NR}\s*${EWID}?${SEP}`;
// „nr ewid. 12/3", „numer ewidencyjny: 450/2"
const WZOR_C = String.raw`${PRZED}${NR}\s*ewid(?:encyjn\p{L}*|\.)${SEP}`;

const NUMERY_RE = new RegExp(`(?:${WZOR_A}|${WZOR_B}|${WZOR_C})(${LISTA})`, 'giu');

// Obręb: nazwa tylko z wielkiej litery (bez flagi `i`, bo z nią \p{Lu} łapie też małe litery),
// dlatego słowo kluczowe ma wypisane oba warianty liter. „w obrębie działki" nie da nazwy.
const SLOWO = String.raw`\p{Lu}\p{L}*(?:-\p{Lu}\p{L}*)?`;
const OBREB_RE = new RegExp(
  String.raw`(?<![\p{L}\d])(?:[oO][bB][rR][ęĘeE][bB](?:ie|IE|u|U|em|EM)?|[oO][bB][rR]\.)` +
    String.raw`(?:\s+(?:[eE][wW][iI][dD]|[gG][eE][oO][dD])\p{L}*\.?)?\s*(?:[nN][rR]\.?\s*)?[:\-–]?\s*` +
    String.raw`(\d{1,4}(?!\d))?\s*(${SLOWO}(?:\s+${SLOWO}){0,2})?`,
  'gu'
);

// Słowa, na których nazwa obrębu na pewno się skończyła („obręb Kania Gmina Somianka").
const KONIEC_NAZWY = new Set([
  'gmina', 'gminie', 'gm', 'powiat', 'pow', 'województwo', 'woj', 'działka', 'działki', 'działek', 'dz',
  'nr', 'numer', 'ul', 'ulica', 'miejscowość', 'miejscowości', 'cena', 'powierzchnia', 'mpzp', 'kw',
]);

function bezPowtorzen(lista: string[]): string[] {
  const widziane = new Set<string>();
  const out: string[] = [];
  for (const s of lista) {
    const k = s.toLowerCase();
    if (widziane.has(k)) continue;
    widziane.add(k);
    out.push(s);
  }
  return out;
}

function przytnijNazwe(nazwa: string): string {
  const slowa: string[] = [];
  for (const slowo of nazwa.split(/\s+/)) {
    if (KONIEC_NAZWY.has(slowo.replace(/\.$/, '').toLowerCase())) break;
    slowa.push(slowo);
  }
  return slowa.join(' ');
}

export function numeryZOpisu(opis: string | null | undefined): NumeryZOpisu {
  const tekst = plainText(opis);
  const wynik: NumeryZOpisu = { identyfikatory: [], numery: [], obrebyNazwy: [], obrebyNumery: [] };
  if (!tekst) return wynik;

  wynik.identyfikatory = bezPowtorzen(tekst.match(IDENTYFIKATOR_RE) ?? []).slice(0, MAX);
  // Identyfikator sam w sobie kończy się numerem działki. Wycinamy go przed szukaniem numerów,
  // żeby „numer działki 143803_2.0028.325/8" nie dał przy okazji fałszywego numeru.
  const bezIdentyfikatorow = tekst.replace(IDENTYFIKATOR_RE, ' ');

  const numery: string[] = [];
  for (const m of bezIdentyfikatorow.matchAll(NUMERY_RE)) {
    for (const czesc of m[1].split(new RegExp(ROZDZIELNIK, 'u'))) {
      const numer = normalizeParcelNumber(czesc).toLowerCase();
      if (numer) numery.push(numer);
    }
  }
  wynik.numery = bezPowtorzen(numery).slice(0, MAX);

  const nazwy: string[] = [];
  const numeryObrebow: string[] = [];
  for (const m of tekst.matchAll(OBREB_RE)) {
    if (m[1]) numeryObrebow.push(m[1]);
    const nazwa = m[2] ? przytnijNazwe(m[2]) : '';
    if (nazwa) nazwy.push(nazwa);
  }
  wynik.obrebyNazwy = bezPowtorzen(nazwy).slice(0, MAX);
  wynik.obrebyNumery = bezPowtorzen(numeryObrebow).slice(0, MAX);

  return wynik;
}

/**
 * Odcisk tego, co opis mówi o działce. Zapisany przy raporcie: gdy biuro zmieni numer w opisie,
 * klucz się zmieni i działkę ustalamy od nowa. `null` = w opisie nie ma numeru działki.
 */
export function kluczZOpisu(z: NumeryZOpisu): string | null {
  if (z.identyfikatory.length === 0 && z.numery.length === 0) return null;
  return [z.identyfikatory, z.numery, z.obrebyNazwy, z.obrebyNumery].map((l) => l.join(',')).join('|');
}

/**
 * Pod jakimi nazwami obrębu pytać ULDK o numer z opisu: najpierw obręb podany przez biuro, potem
 * miejscowość oferty (na wsi obręb zwykle nazywa się tak samo), na końcu numer obrębu.
 */
export function regionyDoSzukania(z: NumeryZOpisu, miejscowosc: string | null): string[] {
  return bezPowtorzen(
    [...z.obrebyNazwy, miejscowosc ?? '', ...z.obrebyNumery].map((s) => s.trim()).filter(Boolean)
  ).slice(0, MAX);
}

/** Miejscowość z etykiety lokalizacji oferty („Radziwiłłów, Puszcza Mariańska" → „Radziwiłłów"). */
export function miejscowoscZEtykiety(etykieta: string | null | undefined): string | null {
  const czesci = plainText(etykieta)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Etykieta bywa „ul. Dworska 5, Sieradz": człon z ulicą albo numerem domu to nie miejscowość.
  const miejscowosc = czesci.find(
    (c) => !/^(ul\.?|ulica|al\.|aleja|os\.|osiedle|pl\.)\s/i.test(c) && !/\d/.test(c)
  );
  if (!miejscowosc || /^(gmina|gm\.|powiat|pow\.|woj)/i.test(miejscowosc)) return null;
  return miejscowosc;
}

/** Ewidencja zapisuje obręby wersalikami („RADZIWIŁŁÓW"); na stronie pokazujemy „Radziwiłłów". */
export function ladnaNazwaObrebu(nazwa: string): string {
  const s = nazwa.trim();
  if (!/\p{L}/u.test(s) || s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, przed: string, litera: string) => przed + litera.toUpperCase());
}

/** Najdalej od pinezki oferty (km). Pinezka z CRM to zwykle środek miejscowości, więc kilka km to norma. */
export const MAX_KM_OD_PINEZKI = 5;

/**
 * Ile razy powierzchnia działki w ewidencji może różnić się od tej z ogłoszenia (w obie strony).
 * Pomiar 2026-09-15 na 60 losowych ofertach: 40 z 47 dopasowanych działek mieściło się w 0,9-1,1.
 * Dalej to zwykle część większej działki albo kilka działek w jednej ofercie, a pokazanie złej
 * działki pod ogłoszeniem kosztuje więcej niż brak raportu.
 */
export const MAX_ROZNICA_POWIERZCHNI = 1.2;

/**
 * Ostatnia bramka: działka z ewidencji musi pasować do oferty. Chroni przed źle przeczytanym
 * numerem („działka nr 3 z 5") i przed ofertą, która sprzedaje część działki albo kilka naraz.
 * Bez powierzchni w ogłoszeniu nie ma czym potwierdzić, więc wtedy raportu nie pokazujemy.
 */
export function pasujeDoOferty(
  dzialka: { areaM2: number; km: number | null },
  powierzchniaOferty: number | null | undefined
): boolean {
  if (dzialka.km != null && dzialka.km > MAX_KM_OD_PINEZKI) return false;
  if (!powierzchniaOferty || powierzchniaOferty <= 0 || !(dzialka.areaM2 > 0)) return false;
  const stosunek = dzialka.areaM2 / powierzchniaOferty;
  return stosunek <= MAX_ROZNICA_POWIERZCHNI && stosunek >= 1 / MAX_ROZNICA_POWIERZCHNI;
}
