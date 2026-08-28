// Plan ogólny gminy (POG) z usługi GUGiK: strefa planistyczna + obszar uzupełnienia zabudowy.
//
// Po co, skoro mamy MPZP: plan miejscowy jest dobrowolny i na naszej podaży odpowiada „co tu
// można zbudować" dla ok. 5% działek. Plan ogólny jest OBOWIĄZKOWY dla każdej gminy i obejmuje
// cały jej obszar, więc gdy gmina prześle dane, odpowiedź dostaje każda działka w gminie naraz.
// Termin uchwalenia minął 31.08.2026 (w sierpniu 519 gmin z 2479 miało go uchwalonego, 1160
// kolejnych trzymało projekt w wyłożeniu), więc pokrycie rośnie samo, bez pracy z naszej strony.
//
// Najważniejsza rzecz w całym pliku to OBSZAR UZUPEŁNIENIA ZABUDOWY: po reformie działka bez
// planu miejscowego i poza tym obszarem co do zasady nie dostanie warunków zabudowy, czyli domu
// się na niej nie postawi. Tego nie mówi dziś żaden portal ogłoszeniowy.
//
// Uczciwie ([[feedback-filtry-twarde]]): brak strefy w odpowiedzi = gmina nie ma jeszcze danych
// w usłudze, więc MILCZYMY. Nie mylimy „gmina nie przysłała" z „działka poza obszarem".

export const POG_WMS = 'https://mapy.geoportal.gov.pl/wss/ext/PlanyOgolneGmin';

const LAYERS = 'strefaPlanistyczna,obszarUzupelnieniaZabudowy,obszarZabSrodmiejskiej';

// 13 stref z rozporządzenia w sprawie projektu planu ogólnego gminy (załącznik nr 2).
export const STREFY: Record<string, string> = {
  SW: 'strefa wielofunkcyjna z zabudową mieszkaniową wielorodzinną',
  SJ: 'strefa wielofunkcyjna z zabudową mieszkaniową jednorodzinną',
  SZ: 'strefa wielofunkcyjna z zabudową zagrodową',
  SU: 'strefa usługowa',
  SH: 'strefa handlu wielkopowierzchniowego',
  SP: 'strefa gospodarcza',
  SR: 'strefa produkcji rolniczej',
  SI: 'strefa infrastrukturalna',
  SN: 'strefa zieleni i rekreacji',
  SC: 'strefa cmentarzy',
  SG: 'strefa górnictwa',
  SO: 'strefa otwarta',
  SK: 'strefa komunikacyjna',
};

// Strefy, w których zabudowa mieszkaniowa jest przewidziana wprost. Reszta nie znaczy „nic nie
// zbudujesz", tylko „nie to". Używamy tego wyłącznie do tonu komunikatu, nie do wyroków.
const STREFY_MIESZKANIOWE = new Set(['SW', 'SJ', 'SZ']);

export type PogStrefa = {
  symbol: string; // SW, SJ, SO...
  nazwa: string | null; // rozwinięcie symbolu ze słownika
  oznaczenie: string | null; // np. 1429SW (numer strefy w planie)
  mieszkaniowa: boolean;
  obowiazujeOd: string | null;
  maksWysokoscZabudowy: string | null; // metry
  maksUdzialPowierzchniZabudowy: string | null; // %
  minUdzialPowierzchniBiologicznieCzynnej: string | null; // %
  maksNadziemnaIntensywnoscZabudowy: string | null;
};

export type PogInfo = {
  strefa: PogStrefa;
  // czy punkt leży w obszarze uzupełnienia zabudowy (warunek wydania WZ poza planem miejscowym)
  ouz: boolean;
  // obszar zabudowy śródmiejskiej (luźniejsze standardy urbanistyczne)
  srodmiejska: boolean;
};

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  const v = m?.[1]?.trim();
  return v && v.toLowerCase() !== 'null' ? v : null;
}

// „2025/12/18" -> „2025-12-18"; puste zostaje puste.
function isoDate(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Parsowanie odpowiedzi GML z usługi POG. Wydzielone, żeby dało się testować bez sieci. */
export function parsePogGml(text: string): PogInfo | null {
  const strefaBlok = text.match(/<strefaPlanistyczna_feature>[\s\S]*?<\/strefaPlanistyczna_feature>/)?.[0];
  if (!strefaBlok) return null;

  const symbol = (tag(strefaBlok, 'symbol') ?? '').toUpperCase();
  if (!symbol) return null;

  return {
    strefa: {
      symbol,
      nazwa: STREFY[symbol] ?? null,
      oznaczenie: tag(strefaBlok, 'oznaczenie'),
      mieszkaniowa: STREFY_MIESZKANIOWE.has(symbol),
      obowiazujeOd: isoDate(tag(strefaBlok, 'obowiazujeOd')),
      maksWysokoscZabudowy: tag(strefaBlok, 'maksWysokoscZabudowy'),
      maksUdzialPowierzchniZabudowy: tag(strefaBlok, 'maksUdzialPowierzchniZabudowy'),
      minUdzialPowierzchniBiologicznieCzynnej: tag(
        strefaBlok,
        'minUdzialPowierzchniBiologicznieCzynnej'
      ),
      maksNadziemnaIntensywnoscZabudowy: tag(strefaBlok, 'maksNadziemnaIntensywnoscZabudowy'),
    },
    ouz: /<obszarUzupelnieniaZabudowy_feature>/.test(text),
    srodmiejska: /<obszarZabSrodmiejskiej_feature>/.test(text),
  };
}

// WGS84 -> Web Mercator (EPSG:3857), którego używa usługa.
function to3857(lat: number, lng: number): { x: number; y: number } {
  const R = 20037508.34;
  const x = (lng * R) / 180;
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);
  return { x, y };
}

/**
 * Plan ogólny w punkcie (środek działki). `null`, gdy gmina nie ma jeszcze danych w usłudze
 * albo usługa nie odpowie — wtedy raport o planie ogólnym po prostu nie wspomina.
 */
export async function getPogAtPoint(lat: number, lng: number): Promise<PogInfo | null> {
  try {
    const { x, y } = to3857(lat, lng);
    const d = 60; // metry — mały prostokąt wokół punktu, środek piksela = nasz punkt
    const url = new URL(POG_WMS);
    const params: Record<string, string> = {
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: LAYERS,
      QUERY_LAYERS: LAYERS,
      STYLES: '',
      CRS: 'EPSG:3857',
      BBOX: `${x - d},${y - d},${x + d},${y + d}`,
      WIDTH: '256',
      HEIGHT: '256',
      I: '128',
      J: '128',
      INFO_FORMAT: 'application/vnd.ogc.gml',
      FEATURE_COUNT: '5',
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;
    return parsePogGml(await res.text());
  } catch {
    return null;
  }
}
