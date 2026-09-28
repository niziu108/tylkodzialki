// Klient usługi RCN (GUGiK): pobiera transakcje z okolicy zadanego punktu.
//
// Dlaczego tak dziwnie, przez obrazek: usługa nie ma WFS-a z ceną (powiatowe WFS-y mają tylko
// 8 pól, bez kwot), a jej WMS oddaje dane wyłącznie przez GetFeatureInfo, czyli per piksel.
// Żeby nie strzelać na oślep, najpierw pobieramy kafel GetMap i patrzymy, gdzie na nim są
// narysowane działki z transakcjami (nieprzezroczyste piksele).
//
// Jak odpytujemy (od 2026-09-28): ZACHŁANNE POKRYCIE. Bierzemy pierwszy jeszcze niepokryty
// piksel działek, pytamy o niego w GML, a odpowiedź zawiera obrys działki. Cały obrys (z
// marginesem na grubość linii) oznaczamy jako pokryty i szukamy następnego niepokrytego piksela.
// Wychodzi mniej więcej jedno zapytanie na działkę.
// Wcześniej pytaliśmy tylko o środek każdej plamy, a sąsiednie działki (osiedle, podział pola
// na działki pod dom) rysują się jako JEDNA plama: pomiar na 8 kaflach dał 34 transakcje
// zamiast 62, czyli gubiliśmy ~45%, i to najczęściej właśnie działki pod dom.
//
// Ograniczenie usługi: warstwa `dzialki` ma MaxScaleDenominator 5001, więc kafel musi być
// ciasny (ok. 400 m). Powyżej tej skali serwer zwraca pusty obrazek i pustą odpowiedź.
//
// Usługa jest wg GUGiK „rozwiązaniem tymczasowym", dlatego wyniki trzymamy u siebie w bazie.

import sharp from 'sharp';
import { parseRcnGml, srodekObrysu, doZapisu, type RcnPunkt, type RcnTransakcjaDane } from '@/lib/rcn';

const RCN_WMS = 'https://mapy.geoportal.gov.pl/wss/service/rcn';
const KAFEL_PX = 512;
/** Połowa wysokości kafla w stopniach szerokości. 0.0020 to ok. 220 m, czyli kafel ok. 440 m. */
const POL_KAFLA_LAT = 0.002;

/** Próg przezroczystości: niżej to antyaliasing krawędzi, nie rysunek działki. */
const MIN_ALFA = 120;
/** Margines (px) wokół obrysu działki: linia na obrazku jest grubsza niż sama granica. */
const MARGINES_OBRYSU_PX = 2;
/** Promień (px) kwadratu oznaczanego wokół odpytanego piksela, także gdy odpowiedź była pusta. */
const OTOCZKA_PYTANIA_PX = 3;
/**
 * Bezpiecznik na jeden kafel. Typowy kafel to kilka-kilkanaście zapytań; gęste śródmieście może
 * mieć ich więcej. Przekroczenie zgłaszamy w wyniku (`urwane`), żeby było widać, a nie zgadywać.
 */
export const MAX_ZAPYTAN_KAFLA = 400;

export type PunktTransakcji = Omit<RcnTransakcjaDane, 'lat' | 'lng'> & { lat: number; lng: number };

function bbox(lat: number, lng: number) {
  // Na szerokości Polski stopień długości jest krótszy niż stopień szerokości, więc korygujemy,
  // żeby kafel był mniej więcej kwadratowy w metrach.
  const polKaflaLng = POL_KAFLA_LAT / Math.cos((lat * Math.PI) / 180);
  return {
    south: lat - POL_KAFLA_LAT,
    west: lng - polKaflaLng,
    north: lat + POL_KAFLA_LAT,
    east: lng + polKaflaLng,
  };
}

function url(params: Record<string, string>) {
  const u = new URL(RCN_WMS);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// Usługa bywa kapryśna (ECONNRESET przy szybszym tempie). Trzy podejścia z rosnącą przerwą,
// potem oddajemy null: pojedynczy nieudany punkt nie może zatrzymać całego przebiegu.
async function ponow<T>(fn: () => Promise<T>): Promise<T | null> {
  for (let proba = 0; proba < 3; proba++) {
    try {
      return await fn();
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (proba + 1)));
    }
  }
  return null;
}

async function pobierzKafel(lat: number, lng: number): Promise<Buffer | null> {
  const b = bbox(lat, lng);
  return ponow(async () => {
    const res = await fetch(
      url({
        SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap',
        LAYERS: 'dzialki', STYLES: '', CRS: 'EPSG:4326',
        BBOX: `${b.south},${b.west},${b.north},${b.east}`,
        WIDTH: String(KAFEL_PX), HEIGHT: String(KAFEL_PX),
        FORMAT: 'image/png', TRANSPARENT: 'TRUE',
      }),
    );
    if (!res.ok) throw new Error(`GetMap HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
}

/** Maska narysowanych działek: 1 = piksel do pokrycia. */
async function maskaDzialek(png: Buffer): Promise<Uint8Array> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const maska = new Uint8Array(info.width * info.height);
  for (let p = 0; p < maska.length; p++) maska[p] = data[p * info.channels + 3] >= MIN_ALFA ? 1 : 0;
  return maska;
}

async function odpytajPiksel(lat: number, lng: number, i: number, j: number): Promise<string | null> {
  const b = bbox(lat, lng);
  return ponow(async () => {
    const res = await fetch(
      url({
        SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
        LAYERS: 'dzialki', QUERY_LAYERS: 'dzialki', STYLES: '', CRS: 'EPSG:4326',
        BBOX: `${b.south},${b.west},${b.north},${b.east}`,
        WIDTH: String(KAFEL_PX), HEIGHT: String(KAFEL_PX),
        I: String(i), J: String(j),
        // GML: te same pola co text/xml plus obrys działki (patrz lib/rcn.ts).
        INFO_FORMAT: 'application/vnd.ogc.gml', FEATURE_COUNT: '50',
      }),
    );
    if (!res.ok) throw new Error(`GetFeatureInfo HTTP ${res.status}`);
    return res.text();
  });
}

function wWielokacie(x: number, y: number, pierscien: Array<[number, number]>): boolean {
  let w = false;
  for (let a = 0, b = pierscien.length - 1; a < pierscien.length; b = a++) {
    const [xa, ya] = pierscien[a];
    const [xb, yb] = pierscien[b];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) w = !w;
  }
  return w;
}

/**
 * Oznacza jako pokryte piksele kafla leżące w obrysie działki albo do MARGINES_OBRYSU_PX od niego.
 * Czyste i eksportowane dla testów: to od tej funkcji zależy, czy zapytamy o każdą działkę.
 */
export function pokryjObrys(
  pokryte: Uint8Array,
  obrys: RcnPunkt[],
  kafel: { south: number; west: number; north: number; east: number },
  px = KAFEL_PX,
): void {
  const naPiksel = obrys.map(
    ([lng, lat]) =>
      [((lng - kafel.west) / (kafel.east - kafel.west)) * px, ((kafel.north - lat) / (kafel.north - kafel.south)) * px] as [
        number,
        number,
      ],
  );
  const m = MARGINES_OBRYSU_PX;
  const x0 = Math.max(0, Math.floor(Math.min(...naPiksel.map((p) => p[0])) - m));
  const x1 = Math.min(px - 1, Math.ceil(Math.max(...naPiksel.map((p) => p[0])) + m));
  const y0 = Math.max(0, Math.floor(Math.min(...naPiksel.map((p) => p[1])) - m));
  const y1 = Math.min(px - 1, Math.ceil(Math.max(...naPiksel.map((p) => p[1])) + m));
  const probki: Array<[number, number]> = [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m], [m, m], [m, -m], [-m, m], [-m, -m]];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pokryte[y * px + x]) continue;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (probki.some(([dx, dy]) => wWielokacie(cx + dx, cy + dy, naPiksel))) pokryte[y * px + x] = 1;
    }
  }
}

function pokryjKwadrat(pokryte: Uint8Array, i: number, j: number, r: number, px = KAFEL_PX) {
  for (let y = Math.max(0, j - r); y <= Math.min(px - 1, j + r); y++) {
    for (let x = Math.max(0, i - r); x <= Math.min(px - 1, i + r); x++) pokryte[y * px + x] = 1;
  }
}

export type WynikKafla = { transakcje: PunktTransakcji[]; zapytan: number; urwane: boolean };

/**
 * Transakcje RCN w kaflu ok. 440 m wokół punktu. Rekordy oczyszczone (`doZapisu`),
 * zdeduplikowane po kluczu transakcja+działka, z położeniem środka działki z obrysu.
 * `przerwaMs` reguluje tempo: to darmowa usługa publiczna, nie dobijamy jej.
 */
export async function transakcjeKafla(lat: number, lng: number, przerwaMs = 300): Promise<WynikKafla> {
  const png = await pobierzKafel(lat, lng);
  if (!png) return { transakcje: [], zapytan: 0, urwane: false };

  const kafel = bbox(lat, lng);
  const maska = await maskaDzialek(png);
  const pokryte = new Uint8Array(KAFEL_PX * KAFEL_PX);
  const widziane = new Set<string>();
  const out: PunktTransakcji[] = [];
  let zapytan = 0;

  for (let p = 0; p < maska.length; p++) {
    if (!maska[p] || pokryte[p]) continue;
    if (zapytan >= MAX_ZAPYTAN_KAFLA) return { transakcje: out, zapytan, urwane: true };

    const i = p % KAFEL_PX;
    const j = Math.floor(p / KAFEL_PX);
    const gml = await odpytajPiksel(lat, lng, i, j);
    zapytan++;
    // Zawsze oznaczamy otoczkę pytanego piksela: pusta odpowiedź (krawędź linii) nie może
    // wracać w pętli, a jedna działka nie może kosztować wielu zapytań.
    pokryjKwadrat(pokryte, i, j, OTOCZKA_PYTANIA_PX);

    for (const { rec, obrysy } of gml ? parseRcnGml(gml) : []) {
      for (const obrys of obrysy) pokryjObrys(pokryte, obrys, kafel);
      const dane = doZapisu(rec);
      if (!dane) continue;
      const klucz = `${dane.lokalnyIdIip}|${dane.idDzialki}`;
      if (widziane.has(klucz)) continue;
      widziane.add(klucz);
      // Położenie: środek działki z obrysu. Awaryjnie odpytany piksel.
      const b = kafel;
      const srodek = srodekObrysu(obrysy) ?? {
        lat: b.north - ((b.north - b.south) * (j + 0.5)) / KAFEL_PX,
        lng: b.west + ((b.east - b.west) * (i + 0.5)) / KAFEL_PX,
      };
      out.push({ ...dane, lat: srodek.lat, lng: srodek.lng });
    }
    await new Promise((r) => setTimeout(r, przerwaMs));
  }
  return { transakcje: out, zapytan, urwane: false };
}

/** Zgodność wstecz: same transakcje kafla. */
export async function transakcjeWOkolicy(lat: number, lng: number, przerwaMs = 300): Promise<PunktTransakcji[]> {
  return (await transakcjeKafla(lat, lng, przerwaMs)).transakcje;
}
