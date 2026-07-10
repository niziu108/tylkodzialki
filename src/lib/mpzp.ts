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
  planName: string | null; // nazwa planu (NAZWA_PLAN / tytul / name / nazwa)
  functionName: string | null; // przeznaczenie (FUN_NAZWA / opis)
  functionSymbol: string | null; // symbol (FUN_SYMB / oznaczenie)
  maxHeight: string | null; // MAX_WYS (maks. wysokość zabudowy, m)
  intensity: string | null; // INTEN_ZAB (intensywność zabudowy)
  effectiveFrom: string | null; // data wejścia w życie (obowiazujeod / data)
  resolution: string | null; // uchwała (dokumentuchwalajacy / numer_uchwaly)
};

// KIMPZP to federacja usług gminnych — ta sama warstwa „plany" zwraca RÓŻNE formaty zależnie
// od gminy: format <ROW> (XML), INSPIRE „klucz = wartość" (app.AktPlanowaniaPrzestrzennego) oraz
// własne schematy gmin (np. warstwy mpzp_meta + mpzp). Stary parser rozumiał tylko <ROW>, więc
// dla większości Polski mówił „brak planu" mimo istniejącego planu. Poniżej obsługujemy oba.

const NO_RESULT_RE =
  /brak wyniku|brak serwisu|no results|Search returned no results|ServiceException/i;

// „klucz = wartość" z odpowiedzi text/plain (INSPIRE i schematy gminne). Pierwsza niepusta
// wartość dla danego klucza wygrywa; pomijamy null i geometrię.
function collectKeyValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^[ \t]*([A-Za-z_][\w.]*)[ \t]*=[ \t]*(.+?)[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2].trim().replace(/^'(.*)'$/, '$1').trim();
    if (!value || value.toLowerCase() === 'null' || /^\[geometry/i.test(value)) continue;
    if (!(key in out)) out[key] = value;
  }
  return out;
}

// „Uchwała Nr XXXIX/773/17 Rady Miasta … z dnia 25 stycznia 2017 r. …" -> „Nr XXXIX/773/17 z 25
// stycznia 2017". Gdy nie pasuje (np. sam numer „XXII/178/12"), zwracamy skrócony oryginał.
function shortenResolution(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/(?:Nr|nr)\s*([\w./-]+)[\s\S]*?z dnia\s*([0-9]{1,2}[^,;0-9]*?[0-9]{4})/);
  if (m) return `Nr ${m[1]} z ${m[2].trim()}`;
  return v.length > 90 ? `${v.slice(0, 90)}…` : v;
}

function isoDate(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

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

    const text = await res.text();

    // Jawny komunikat „brak wyniku"/wyjątek usługi (bez wiersza ROW) = brak planu w tym punkcie.
    if (NO_RESULT_RE.test(text) && !/<ROW\b/.test(text)) return null;

    // Format <ROW> (XML) — jeśli jest, ma pierwszeństwo dla swoich pól.
    const row = text.match(/<ROW\b[\s\S]*?<\/ROW>/)?.[0] ?? '';
    // Format „klucz = wartość" (INSPIRE + schematy gminne).
    const kv = collectKeyValues(text);
    const pick = (...keys: string[]): string | null => {
      for (const k of keys) {
        const v = kv[k.toLowerCase()];
        if (v) return v;
      }
      return null;
    };

    // MAX_WYS / INTEN_ZAB bywają "0" dla terenów bez zabudowy (drogi) — traktuj "0" jak brak.
    const nonZero = (v: string | null) => (v && v !== '0' && v !== '0,0' ? v : null);

    const info: MpzpInfo = {
      planName: tag(row, 'NAZWA_PLAN') ?? pick('tytul', 'name', 'nazwa'),
      functionName: tag(row, 'FUN_NAZWA') ?? pick('opis', 'fun_nazwa', 'przeznaczenie'),
      functionSymbol: tag(row, 'FUN_SYMB') ?? pick('oznaczenie', 'fun_symb'),
      maxHeight: nonZero(tag(row, 'MAX_WYS') ?? pick('max_wys')),
      intensity: nonZero(tag(row, 'INTEN_ZAB') ?? pick('inten_zab')),
      effectiveFrom: isoDate(tag(row, 'DATA') ?? pick('obowiazujeod', 'data')),
      resolution: shortenResolution(pick('dokumentuchwalajacy', 'numer_uchwaly')),
    };

    // Gdyby usługa zwróciła treść bez planu/przeznaczenia — traktuj jak brak.
    if (!info.planName && !info.functionName && !info.functionSymbol) return null;
    return info;
  } catch {
    return null;
  }
}
