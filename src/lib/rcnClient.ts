// Klient usługi RCN (GUGiK): pobiera transakcje z okolicy zadanego punktu.
//
// Dlaczego tak dziwnie, przez obrazek: usługa nie ma WFS-a z ceną (powiatowe WFS-y mają tylko
// 8 pól, bez kwot), a jej WMS oddaje dane wyłącznie przez GetFeatureInfo, czyli per piksel.
// Żeby nie strzelać na oślep, najpierw pobieramy kafel GetMap, znajdujemy na nim skupiska
// nieprzezroczystych pikseli (jeden symbol transakcji to kilkanaście pikseli), i dopiero
// środek każdego skupiska odpytujemy raz. To zamienia setki zapytań w kilka.
//
// Ograniczenie usługi: warstwa `dzialki` ma MaxScaleDenominator 5001, więc kafel musi być
// ciasny (ok. 400 m). Powyżej tej skali serwer zwraca pusty obrazek i pustą odpowiedź.
//
// Usługa jest wg GUGiK „rozwiązaniem tymczasowym", dlatego wyniki trzymamy u siebie w bazie.

import sharp from 'sharp';
import { parseRcnXml, doZapisu, type RcnTransakcjaDane } from '@/lib/rcn';

const RCN_WMS = 'https://mapy.geoportal.gov.pl/wss/service/rcn';
const KAFEL_PX = 512;
/** Połowa wysokości kafla w stopniach szerokości. 0.0020 to ok. 220 m, czyli kafel ok. 440 m. */
const POL_KAFLA_LAT = 0.002;

/** Ile pikseli musi mieć skupisko, żeby uznać je za symbol, a nie za artefakt antyaliasingu. */
const MIN_PIKSELI_SKUPISKA = 4;
/** Zabezpieczenie przed gęstym śródmieściem: tyle skupisk odpytujemy z jednego kafla. */
const MAX_SKUPISK = 45;

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

/** Środki skupisk nieprzezroczystych pikseli, w układzie pikseli kafla. */
async function skupiska(png: Buffer): Promise<Array<[number, number]>> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const odwiedzone = new Uint8Array(w * h);
  const srodki: Array<[number, number]> = [];
  const alfa = (x: number, y: number) => data[(y * w + x) * channels + 3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (odwiedzone[y * w + x] || alfa(x, y) < 120) continue;
      let sumaX = 0;
      let sumaY = 0;
      let ile = 0;
      const stos: Array<[number, number]> = [[x, y]];
      odwiedzone[y * w + x] = 1;
      while (stos.length) {
        const [cx, cy] = stos.pop()!;
        sumaX += cx;
        sumaY += cy;
        ile++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (odwiedzone[ny * w + nx] || alfa(nx, ny) < 120) continue;
          odwiedzone[ny * w + nx] = 1;
          stos.push([nx, ny]);
        }
      }
      if (ile >= MIN_PIKSELI_SKUPISKA) srodki.push([Math.round(sumaX / ile), Math.round(sumaY / ile)]);
    }
  }
  return srodki;
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
        // GML tego samego punktu NIE zawiera ceny, text/plain zwraca sam identyfikator.
        INFO_FORMAT: 'text/xml', FEATURE_COUNT: '20',
      }),
    );
    if (!res.ok) throw new Error(`GetFeatureInfo HTTP ${res.status}`);
    return res.text();
  });
}

/** Piksel kafla na współrzędne geograficzne (środek symbolu transakcji). */
function pikselNaLatLng(lat: number, lng: number, i: number, j: number) {
  const b = bbox(lat, lng);
  return {
    lat: b.north - ((b.north - b.south) * j) / KAFEL_PX,
    lng: b.west + ((b.east - b.west) * i) / KAFEL_PX,
  };
}

/**
 * Transakcje RCN w okolicy punktu (kafel ok. 440 m). Zwraca rekordy już oczyszczone
 * (`doZapisu`), zdeduplikowane po kluczu naturalnym transakcja+działka.
 * `przerwaMs` reguluje tempo — to darmowa usługa publiczna, nie dobijamy jej.
 */
export async function transakcjeWOkolicy(
  lat: number,
  lng: number,
  przerwaMs = 300,
): Promise<PunktTransakcji[]> {
  const png = await pobierzKafel(lat, lng);
  if (!png) return [];

  const srodki = await skupiska(png);
  const widziane = new Set<string>();
  const out: PunktTransakcji[] = [];

  for (const [i, j] of srodki.slice(0, MAX_SKUPISK)) {
    const xml = await odpytajPiksel(lat, lng, i, j);
    if (xml) {
      const punkt = pikselNaLatLng(lat, lng, i, j);
      for (const surowy of parseRcnXml(xml)) {
        const dane = doZapisu(surowy);
        if (!dane) continue;
        const klucz = `${dane.lokalnyIdIip}|${dane.idDzialki}`;
        if (widziane.has(klucz)) continue;
        widziane.add(klucz);
        out.push({ ...dane, lat: punkt.lat, lng: punkt.lng });
      }
    }
    await new Promise((r) => setTimeout(r, przerwaMs));
  }
  return out;
}
