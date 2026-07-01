// P24: klient ULDK (GUGiK) — publiczna, darmowa usługa lokalizacji działek ewidencyjnych.
//
// Cała komunikacja po stronie serwera (CORS + niezawodność). Zasada uczciwości
// ([[feedback-filtry-twarde]]): pokazujemy tylko dane, które ULDK realnie zwróci dla punktu
// wskazanego DOKŁADNIE przez użytkownika (pinezka/adres/numer). Zero zgadywania.
//
// Precyzja bierze się stąd, że współrzędne podaje użytkownik na SWOJEJ działce — nie z naszych
// przybliżonych geo ofert (to była blokada P23).
//
// Reprojekcję załatwiamy dwoma wywołaniami ULDK (bez proj4/turf):
//   1) GetParcelByXY w SRID 2180 (metry) -> identyfikator, nazwy administracyjne + geometria,
//      z której liczymy powierzchnię w m² (shoelace na metrach).
//   2) GetParcelById w SRID 4326 (WGS84) -> geometria do narysowania obrysu na Google Maps.

import { isInPoland } from '@/lib/geo';

const ULDK_BASE = 'https://uldk.gugik.gov.pl/';

// Geometria trzyma współrzędne w kolejności [x, y]. W 2180 to [easting, northing] (metry),
// w 4326 to [lng, lat] (stopnie) — ULDK zwraca WKT w kolejności osi X,Y.
type XY = [number, number];
type Ring = XY[];

export type LatLng = { lat: number; lng: number };

export type ParcelReport = {
  id: string; // pełny identyfikator ewidencyjny, np. 146510_8.0502.1/3
  parcelNumber: string; // numer działki (po ostatniej kropce), np. 1/3
  voivodeship: string; // np. mazowieckie
  county: string; // np. powiat Warszawa
  commune: string; // np. Warszawa (miasto)
  region: string; // obręb ewidencyjny, np. 5-05-02
  areaM2: number; // powierzchnia z geometrii 2180 (metry)
  rings: LatLng[][]; // obrys(y) w WGS84 do mapy (kolejno: kontur zewnętrzny + ewentualne otwory)
  center: LatLng; // środek do wycentrowania mapy
};

export class UldkError extends Error {}

// ── Parsowanie odpowiedzi ULDK ───────────────────────────────────────────────
// Format: pierwsza linia = status ("0" = OK, "-1 brak wyników" itp.), kolejne linie = wiersze
// wyników rozdzielone „|" w kolejności pól z parametru `result`.
function parseUldkRows(body: string): string[] {
  const lines = body.split('\n').map((l) => l.replace(/\r$/, ''));
  const status = (lines[0] ?? '').trim();
  if (status.startsWith('-')) return []; // -1 brak wyników / błąd
  return lines.slice(1).filter((l) => l.trim().length > 0);
}

async function uldkFetch(params: Record<string, string>): Promise<string> {
  const url = new URL(ULDK_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // Geometria działki jest praktycznie statyczna — cache długo, jesteśmy grzeczni dla GUGiK.
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) throw new UldkError(`ULDK HTTP ${res.status}`);
  return res.text();
}

// ── Parser WKT (POLYGON / MULTIPOLYGON) ──────────────────────────────────────
// Wyciąga wszystkie pierścienie (grupy współrzędnych w najgłębszych nawiasach), zachowując
// kolejność. Dla POLYGON pierwszy pierścień to kontur, kolejne to otwory; dla MULTIPOLYGON
// wszystkie kontury i otwory po kolei — do liczenia pola i tak używamy pola ZE ZNAKIEM.
function parseWktRings(wkt: string): Ring[] {
  const clean = wkt.replace(/^SRID=\d+;/i, '').trim();
  const rings: Ring[] = [];
  const groups = clean.match(/\(([^()]+)\)/g);
  if (!groups) return rings;

  for (const g of groups) {
    const inner = g.slice(1, -1);
    const ring: Ring = inner
      .split(',')
      .map((pair) => {
        const [a, b] = pair.trim().split(/\s+/).map(Number);
        return [a, b] as XY;
      })
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

// Pole metodą Gaussa (shoelace) ZE ZNAKIEM. Sumujemy po wszystkich pierścieniach: przy poprawnej
// geometrii z PostGIS kontur zewnętrzny i otwory mają przeciwne nawinięcie, więc suma znakowa daje
// pole netto (kontur minus otwory), a dla wieloczęściowych działek dodaje kolejne kawałki.
function ringsAreaM2(rings: Ring[]): number {
  let sum = 0;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      a += x1 * y2 - x2 * y1;
    }
    sum += a / 2;
  }
  return Math.abs(Math.round(sum));
}

function extractId(row: string): string {
  return (row.split('|')[0] ?? '').trim();
}

function parcelNumberFromId(id: string): string {
  const parts = id.split('.');
  return parts[parts.length - 1] || id;
}

// Geometria 4326 z ULDK ma współrzędne [lng, lat] — zamieniamy na {lat,lng} pod Google Maps.
function ringsToLatLng(rings: Ring[]): LatLng[][] {
  return rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
}

function centerOfRings(rings: LatLng[][]): LatLng {
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const ring of rings) {
    for (const p of ring) {
      sumLat += p.lat;
      sumLng += p.lng;
      n++;
    }
  }
  if (n === 0) return { lat: 52.0, lng: 19.0 };
  return { lat: sumLat / n, lng: sumLng / n };
}

// Dokleja geometrię WGS84 (SRID 4326) po identyfikatorze i buduje pełny raport.
async function buildReport(base: Omit<ParcelReport, 'rings' | 'center'>): Promise<ParcelReport> {
  const geomBody = await uldkFetch({
    request: 'GetParcelById',
    id: base.id,
    result: 'geom_wkt',
    srid: '4326',
  });
  const geomRows = parseUldkRows(geomBody);
  const wkt4326 = geomRows[0] ?? '';
  const rings = ringsToLatLng(parseWktRings(wkt4326));
  if (rings.length === 0) {
    throw new UldkError('Brak geometrii działki (WGS84).');
  }

  return { ...base, rings, center: centerOfRings(rings) };
}

// Wspólne: z wiersza „id|woj|powiat|gmina|obreb|geom_wkt(2180)" zbuduj bazę raportu (bez geometrii
// do mapy, którą dokłada buildReport z SRID 4326).
function baseFromRow2180(row: string): Omit<ParcelReport, 'rings' | 'center'> {
  const cols = row.split('|');
  const id = (cols[0] ?? '').trim();
  if (!id) throw new UldkError('ULDK nie zwrócił identyfikatora działki.');

  const wkt2180 = cols[5] ?? '';
  const areaM2 = ringsAreaM2(parseWktRings(wkt2180));

  return {
    id,
    parcelNumber: parcelNumberFromId(id),
    voivodeship: (cols[1] ?? '').trim(),
    county: (cols[2] ?? '').trim(),
    commune: (cols[3] ?? '').trim(),
    region: (cols[4] ?? '').trim(),
    areaM2,
  };
}

const RESULT_2180 = 'id,voivodeship,county,commune,region,geom_wkt';

/**
 * Działka pod punktem WGS84 (lat/lng). Punkt musi być dokładny (pinezka użytkownika / geokodowanie
 * adresu). Zwraca `null`, gdy w danym miejscu nie ma działki ewidencyjnej (np. środek jeziora) —
 * wołający pokazuje wtedy „przesuń pinezkę", nie crash.
 */
export async function getParcelByXY(lat: number, lng: number): Promise<ParcelReport | null> {
  if (!isInPoland(lat, lng)) {
    throw new UldkError('Punkt jest poza granicami Polski.');
  }

  const body = await uldkFetch({
    request: 'GetParcelByXY',
    // ULDK: kolejność X,Y = lng,lat dla 4326. `srid` = układ WYJŚCIOWEJ geometrii (2180 -> metry).
    xy: `${lng},${lat},4326`,
    result: RESULT_2180,
    srid: '2180',
  });

  const rows = parseUldkRows(body);
  if (rows.length === 0) return null;

  return buildReport(baseFromRow2180(rows[0]));
}

/**
 * Działka po pełnym identyfikatorze ewidencyjnym (np. „146510_8.0502.1/3"). Zwraca `null`, gdy
 * ULDK nie zna takiego identyfikatora.
 */
export async function getParcelById(id: string): Promise<ParcelReport | null> {
  const clean = id.trim();
  if (!clean) return null;

  const body = await uldkFetch({
    request: 'GetParcelById',
    id: clean,
    result: RESULT_2180,
    srid: '2180',
  });

  const rows = parseUldkRows(body);
  if (rows.length === 0) return null;

  // GetParcelById nie zawsze echo-uje `id` w wyniku — podeprzyj się wejściowym identyfikatorem.
  const row = rows[0];
  const base = baseFromRow2180(extractId(row) ? row : `${clean}|${row}`);
  return buildReport(base);
}
