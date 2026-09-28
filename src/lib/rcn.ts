// Rejestr Cen Nieruchomości (RCN, GUGiK): parsowanie i oczyszczanie odpowiedzi usługi WMS.
//
// Źródło: `https://mapy.geoportal.gov.pl/wss/service/rcn`, warstwa `dzialki`, GetFeatureInfo.
// Od 2026-09-28 pobieramy `INFO_FORMAT=application/vnd.ogc.gml`: ma te same pola co text/xml
// (w tym TRAN_CENA_BRUTTO, sprawdzone na żywo; wcześniejsza notatka „GML bez ceny" jest
// nieaktualna) ORAZ obrys działki. Obrys pozwala pobierać kafel bez gubienia sąsiednich działek
// (rcnClient) i daje prawdziwe położenie działki zamiast środka plamy na obrazku.
//
// Ten moduł jest celowo bez zależności (żadnej sieci, żadnej bazy), bo to reguły liczenia:
// wyglądają na oczywiste, a cicho psują mediany. Testy w `rcn.test.ts`.

export type RcnRaw = Record<string, string>;

export type RcnTransakcjaDane = {
  lokalnyIdIip: string;
  idDzialki: string;
  teryt: string;
  dataTransakcji: Date;
  cenaBruttoPln: number;
  powierzchniaM2: number;
  cenaZaM2: number;
  rodzajTransakcji: string;
  rodzajNieruchomosci: string;
  udzial: string;
  sprzedajacy: string | null;
  kupujacy: string | null;
  przeznaczenieMpzp: string | null;
  sposobUzytkowania: string | null;
  nrDzialki: string | null;
};

/** Wyciąga rekordy `<DZIALKA>` z odpowiedzi GetFeatureInfo (text/xml). */
export function parseRcnXml(xml: string): RcnRaw[] {
  const out: RcnRaw[] = [];
  for (const blok of xml.matchAll(/<DZIALKA>([\s\S]*?)<\/DZIALKA>/g)) {
    const rec: RcnRaw = {};
    for (const pole of blok[1].matchAll(/<([A-Z_0-9]+)>([\s\S]*?)<\/\1>/g)) {
      rec[pole[1]] = pole[2].trim();
    }
    out.push(rec);
  }
  return out;
}

/** [lng, lat] w EPSG:4326, tak jak w `gml:coordinates`. */
export type RcnPunkt = [number, number];

export type RcnObiektGml = { rec: RcnRaw; obrysy: RcnPunkt[][] };

/**
 * Wyciąga obiekty `<dzialki_feature>` z odpowiedzi GetFeatureInfo w GML: pola rekordu (te same
 * nazwy co w text/xml) i pierścienie obrysu działki. Wieloczęściowa działka = kilka pierścieni.
 */
export function parseRcnGml(gml: string): RcnObiektGml[] {
  const out: RcnObiektGml[] = [];
  for (const blok of gml.matchAll(/<dzialki_feature>([\s\S]*?)<\/dzialki_feature>/g)) {
    const tresc = blok[1];
    const geometria = tresc.match(/<GEOMETRIA>([\s\S]*?)<\/GEOMETRIA>/)?.[1] ?? '';
    const obrysy: RcnPunkt[][] = [];
    for (const c of geometria.matchAll(/<gml:coordinates>([\s\S]*?)<\/gml:coordinates>/g)) {
      const pierscien = c[1]
        .trim()
        .split(/\s+/)
        .map((para) => para.split(',').map(Number) as RcnPunkt)
        .filter((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (pierscien.length >= 3) obrysy.push(pierscien);
    }
    // Pola rekordu: bez geometrii i bez znaczników gml:, żeby nie złapać współrzędnych jako pola.
    const rec: RcnRaw = {};
    for (const pole of tresc.replace(/<GEOMETRIA>[\s\S]*?<\/GEOMETRIA>/, '').matchAll(/<([A-Z_0-9]+)>([\s\S]*?)<\/\1>/g)) {
      rec[pole[1]] = pole[2].trim();
    }
    out.push({ rec, obrysy });
  }
  return out;
}

/** Środek działki: średnia wierzchołków najdłuższego pierścienia (bez powtórzonego domknięcia). */
export function srodekObrysu(obrysy: RcnPunkt[][]): { lat: number; lng: number } | null {
  const glowny = [...obrysy].sort((a, b) => b.length - a.length)[0];
  if (!glowny) return null;
  const pkt =
    glowny.length > 1 && glowny[0][0] === glowny.at(-1)![0] && glowny[0][1] === glowny.at(-1)![1]
      ? glowny.slice(0, -1)
      : glowny;
  return {
    lng: pkt.reduce((s, p) => s + p[0], 0) / pkt.length,
    lat: pkt.reduce((s, p) => s + p[1], 0) / pkt.length,
  };
}

// Powyżej tego progu traktujemy liczbę jako metry, poniżej jako hektary.
// Powód: jednostka jest NIESPÓJNA między powiatami (zmierzone 2026-09-02) — większość podaje
// hektary („0.1713"), ale np. powiat 2464 podaje metry („15013"). Próg 50 rozdziela je
// bezpiecznie: 50 ha to 500 000 m², czyli działka spoza obrotu detalicznego, a 50 m² to
// powierzchnia mniejsza niż jakakolwiek realna działka, więc żadna interpretacja nie jest sporna.
const PROG_HEKTARY = 50;

/** Sprowadza `NIER_POW_GRUNTU` do metrów kwadratowych. Zwraca null przy wartości bez sensu. */
export function normalizujPowierzchnieM2(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const v = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  const m2 = v < PROG_HEKTARY ? v * 10000 : v;
  return Math.round(m2);
}

// Widełki zdrowego rozsądku dla ceny gruntu. Poza nimi rekord jest albo błędem rejestru,
// albo transakcją, której nie umiemy zinterpretować (np. cena za udział wpisana jak za całość).
// Lepiej odrzucić niż zatruć medianę: uczciwy filtr bije więcej wyników.
export const MIN_ZL_M2 = 1;
export const MAX_ZL_M2 = 20000;

/**
 * Zamienia surowy rekord na dane do zapisu. Zwraca null, gdy rekordu nie da się rzetelnie
 * policzyć. ŚWIADOMIE nie filtrujemy tu po rodzaju transakcji, udziale ani dacie: to reguły
 * odczytu, które będziemy chcieli zmieniać bez ponownego ściągania całej Polski.
 */
export function doZapisu(rec: RcnRaw): Omit<RcnTransakcjaDane, 'lat' | 'lng'> | null {
  const lokalnyIdIip = rec.TRAN_LOKALNY_ID_IIP?.trim();
  const idDzialki = rec.DZI_ID_DZIALKI?.trim();
  const teryt = rec.TERYT?.trim();
  if (!lokalnyIdIip || !idDzialki || !teryt) return null;

  const cena = Number(rec.TRAN_CENA_BRUTTO);
  if (!Number.isFinite(cena) || cena <= 0) return null;

  const powierzchniaM2 = normalizujPowierzchnieM2(rec.NIER_POW_GRUNTU);
  if (!powierzchniaM2) return null;

  const cenaZaM2 = cena / powierzchniaM2;
  if (cenaZaM2 < MIN_ZL_M2 || cenaZaM2 > MAX_ZL_M2) return null;

  // „2024-08-21 02:00:00+02" — bierzemy samą datę, godzina jest artefaktem strefy.
  const dzien = (rec.DOK_DATA ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dzien)) return null;
  const dataTransakcji = new Date(`${dzien}T12:00:00Z`);
  if (Number.isNaN(dataTransakcji.getTime())) return null;

  const pusteNaNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

  return {
    lokalnyIdIip,
    idDzialki,
    teryt,
    dataTransakcji,
    cenaBruttoPln: Math.round(cena),
    powierzchniaM2,
    cenaZaM2,
    rodzajTransakcji: rec.TRAN_RODZAJ_TRANS?.trim() || 'nieznany',
    rodzajNieruchomosci: rec.NIER_RODZAJ?.trim() || 'nieznany',
    udzial: rec.NIER_UDZIAL?.trim() || 'nieznany',
    sprzedajacy: pusteNaNull(rec.TRAN_SPRZEDAJACY),
    kupujacy: pusteNaNull(rec.TRAN_KUPUJACY),
    przeznaczenieMpzp: pusteNaNull(rec.DZI_PRZEZN_WMPZP),
    sposobUzytkowania: pusteNaNull(rec.DZI_SPOSOB_UZYT),
    nrDzialki: pusteNaNull(rec.DZI_NR_DZIALKI),
  };
}

/** Mediana z listy liczb. Pusta lista daje null. */
export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
