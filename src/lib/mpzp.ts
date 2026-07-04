// P24 Faza 2: MPZP z Krajowej Integracji MPZP (KIMPZP, GUGiK) przez WMS GetFeatureInfo.
//
// Dane przeznaczenia (nazwa planu, funkcja, symbol, maks. wysokość) są PUBLICZNE i realne dla
// wskazanego punktu, więc pokazujemy je wprost. Uczciwie: gdzie gmina nie jest zintegrowana z
// KIMPZP, usługa nic nie zwróci => piszemy „brak planu w tym punkcie", nie zgadujemy
// ([[feedback-filtry-twarde]]). Wizualnie plan pokazuje nakładka WMS na mapie raportu.
//
// Uwaga: sam dokument planu (link WWW z usługi) jest u GUGiK za autoryzacją (401), więc go nie
// linkujemy — substancją jest przeznaczenie z GetFeatureInfo + podgląd na mapie.

export const MPZP_WMS =
  'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego';

// Warstwa rastrowa planów do nakładki na mapie (publiczna, GetMap 200).
export const MPZP_LAYER = 'plany';

export type MpzpInfo = {
  planName: string | null; // NAZWA_PLAN
  functionName: string | null; // FUN_NAZWA (przeznaczenie)
  functionSymbol: string | null; // FUN_SYMB
  maxHeight: string | null; // MAX_WYS (maks. wysokość zabudowy, m)
  intensity: string | null; // INTEN_ZAB (intensywność zabudowy)
};

// WGS84 (lat/lng) -> Web Mercator (EPSG:3857), którego używa WMS i kafle Google.
function to3857(lat: number, lng: number): { x: number; y: number } {
  const R = 20037508.34;
  const x = (lng * R) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * R) / 180;
  return { x, y };
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  const v = m?.[1]?.trim();
  if (!v || v.toLowerCase() === 'null') return null;
  return v;
}

/**
 * Przeznaczenie MPZP w punkcie (środek działki). Zwraca `null`, gdy w tym miejscu nie ma planu w
 * KIMPZP (gmina niezintegrowana albo teren bez planu) albo usługa nie odpowie.
 */
export async function getMpzpAtPoint(lat: number, lng: number): Promise<MpzpInfo | null> {
  try {
    const { x, y } = to3857(lat, lng);
    const d = 100; // metry — mały prostokąt wokół punktu; środek piksela = nasz punkt
    const url = new URL(MPZP_WMS);
    const params: Record<string, string> = {
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: MPZP_LAYER,
      QUERY_LAYERS: MPZP_LAYER,
      STYLES: '',
      CRS: 'EPSG:3857',
      BBOX: `${x - d},${y - d},${x + d},${y + d}`,
      WIDTH: '256',
      HEIGHT: '256',
      I: '128',
      J: '128',
      INFO_FORMAT: 'text/plain',
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;

    const xml = await res.text();
    const rowMatch = xml.match(/<ROW\b[\s\S]*?<\/ROW>/);
    if (!rowMatch) return null; // pusty wynik = brak planu w tym punkcie

    const row = rowMatch[0];
    // MAX_WYS / INTEN_ZAB bywają "0" dla terenów bez zabudowy (drogi) — traktuj "0" jak brak.
    const nonZero = (v: string | null) => (v && v !== '0' && v !== '0,0' ? v : null);

    const info: MpzpInfo = {
      planName: tag(row, 'NAZWA_PLAN'),
      functionName: tag(row, 'FUN_NAZWA'),
      functionSymbol: tag(row, 'FUN_SYMB'),
      maxHeight: nonZero(tag(row, 'MAX_WYS')),
      intensity: nonZero(tag(row, 'INTEN_ZAB')),
    };

    // Gdyby usługa zwróciła wiersz bez sensownej treści — traktuj jak brak.
    if (!info.planName && !info.functionName && !info.functionSymbol) return null;
    return info;
  } catch {
    return null;
  }
}
