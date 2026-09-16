// P24 Faza 2: MPZP z Krajowej Integracji MPZP (KIMPZP, GUGiK) przez WMS GetFeatureInfo.
//
// Dane przeznaczenia (nazwa planu, funkcja, symbol, maks. wysokość) są PUBLICZNE i realne dla
// wskazanego punktu, więc pokazujemy je wprost. Uczciwie: gdzie gmina nie jest zintegrowana z
// KIMPZP, usługa nic nie zwróci => piszemy „brak planu w tym punkcie", nie zgadujemy
// ([[feedback-filtry-twarde]]). Wizualnie plan pokazuje nakładka WMS na mapie raportu.
//
// Dokument planu: link WWW z krajowej usługi jest u GUGiK za autoryzacją (401), a większość gmin
// podaje tylko nazwę pliku bez adresu. Linkujemy wyłącznie PDF uchwały, który gmina podaje pełnym
// publicznym adresem (np. hosting GISON: rastry.gison.pl), patrz `resolutionUrl`.
//
// Gminy na hostingu GISON (lib/mpzpGisonGminy.ts) pytamy najpierw wprost, z pominięciem krajowej
// integracji, bo ta wisi na nich falami. Szczegóły i pomiar przy `getMpzpAtPoint`.

import { GISON_GMINY } from './mpzpGisonGminy';

export const MPZP_WMS =
  'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego';

// Warstwa rastrowa planów do nakładki na mapie (publiczna, GetMap 200).
export const MPZP_LAYER = 'plany';

// Serwer planów gminy na hostingu GISON, ten sam, który krajowa integracja odpytuje dla tych gmin
// (adres z rejestru usług GUGiK). `maska` to obrys gminy: bez niej pusta odpowiedź nie odróżnia
// „w gminie nie ma tu planu" od „ten profil nie obejmuje punktu". Zasięg planu z nazwą, uchwałą i PDF
// to warstwa APP (te same pola, co GML z krajowej integracji). Przeznaczenia terenu (symbolu, opisu)
// GISON nie wystawia w żadnej z ~600 gmin.
const GISON_WMS = 'https://rastry.gison.pl/wms/';
const GISON_WARSTWY = 'maska,app.AktPlanowaniaPrzestrzennego.MPZP';
// Warstwa GISON z rastrami arkuszy rysunków planów. Mimo tytułu „Zasięgi obowiązujących miejscowych
// planów" odpowiada w całym prostokącie arkusza, także poza granicą planu. Pomiar 2026-09-16 (107
// losowych punktów w 107 gminach GISON): 33 trafienia samego arkusza, bez zasięgu APP, i w żadnym z
// nich nie było w punkcie rysunku planu; 286 losowych punktów wewnątrz rysunków w 96 gminach miało
// zasięg APP (jeden 10 m za krawędzią). Sam arkusz nie znaczy więc, że plan obejmuje punkt.
const GISON_ARKUSZE = 'mpzp';

export type MpzpInfo = {
  planName: string | null; // nazwa planu (NAZWA_PLAN / tytul / nazwa / nazwapelnaplanu / nazwa mpzp)
  functionName: string | null; // przeznaczenie (FUN_NAZWA / opis / opis_oznac)
  functionSymbol: string | null; // symbol (FUN_SYMB / oznaczenie)
  maxHeight: string | null; // MAX_WYS (maks. wysokość zabudowy, m)
  intensity: string | null; // INTEN_ZAB (intensywność zabudowy)
  effectiveFrom: string | null; // data wejścia w życie (obowiazujeod / data / wazne_od)
  resolution: string | null; // uchwała (dokumentuchwalajacy / numer_uchwaly / numeruchwaly + data)
  status: string | null; // np. „obowiązujący": część gmin podaje wprost, czy plan wciąż działa
  // Dwa pola niżej są opcjonalne, bo raporty zapisane wcześniej w DzialkaRaport ich nie mają.
  // Publiczny PDF z tekstem uchwały, gdy gmina podaje go pełnym adresem; inaczej null.
  resolutionUrl?: string | null;
  // Serwer gminy trafił w punkcie obiekt planu, ale jego szczegóły nie przyszły (GML z limitem czasu
  // albo wyjątkiem). Plan JEST, więc to nie „brak planu"; warto zapytać o szczegóły ponownie.
  detailsUnavailable?: boolean;
};

// Wersja odczytu planu. Podbijamy, gdy poprawka zamienia część wyników „brak planu" na „plan jest"
// albo „nie wiemy", żeby raporty zapisane starszym odczytem (DzialkaRaport) sprawdzić od nowa.
// 2 (2026-09-15): obiekty bez atrybutów (gminy GISON), format „@warstwa pola; wartości;" (Kraków,
// Poznań), wyjątek serwera gminy i sam rysunek planu przestały dawać „brak planu".
// 3 (2026-09-16): sam arkusz rysunku GISON (GISON_ARKUSZE, bez zasięgu APP) przestał być „planem bez
// szczegółów". To „brak planu", gdy serwer GISON pytany wprost widzi obrys gminy, albo „nie wiemy".
export const MPZP_WERSJA = 3;

// KIMPZP to federacja usług gminnych: ta sama warstwa „plany" zwraca RÓŻNE formaty zależnie od
// gminy. Rozumiemy: <ROW> (XML), „klucz = wartość" (INSPIRE app.AktPlanowaniaPrzestrzennego i
// schematy gminne, np. mpzp_meta + mpzp), sekcje „@warstwa pola; wartości;" (Kraków, Poznań) oraz
// obiekty bez atrybutów (MapServer na hostingu GISON: atrybuty są tylko w GML, więc dociągamy GML).
export type MpzpOdczyt =
  | { wynik: 'plan'; info: MpzpInfo }
  | { wynik: 'brak' }
  // Trafiony obiekt planu bez atrybutów: plan jest, szczegółów w tej odpowiedzi nie ma.
  | { wynik: 'bezAtrybutow' }
  // Odpowiedź, z której nie da się rozstrzygnąć, czy plan jest: wyjątek serwera gminy (np. Muszyna
  // „No LAYERS has been requested", Lublin, Bielsko-Biała) albo sam rysunek planu („Band 1 = …").
  | { wynik: 'nieczytelny'; powod: string };

// „klucz = wartość" z odpowiedzi text/plain (INSPIRE i schematy gminne). Pierwsza niepusta wartość
// dla danego klucza wygrywa; pomijamy null i geometrię. Pomijamy też warstwy dod_info_* (strefy
// osuwisk, otoczenie lotniska): to informacje dodatkowe, a nie przeznaczenie, a że stoją przed
// warstwą mpzp, ich `opis` wygrywał. Sękowa pokazywała „Tereny zagrożone osuwaniem się mas ziemnych
// (LS1)", choć LS1 to lasy ochronne.
function collectKeyValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let dodatkowa = false;
  for (const linia of text.split(/\r?\n/)) {
    const warstwa = linia.match(/^[ \t]*Layer[ \t]+'([^']*)'/);
    if (warstwa) {
      dodatkowa = /^dod_info/i.test(warstwa[1]);
      continue;
    }
    const m = dodatkowa ? null : linia.match(/^[ \t]*([A-Za-z_][\w.]*)[ \t]*=[ \t]*(.+?)[ \t]*$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim().replace(/^'(.*)'$/, '$1').trim();
    if (!value || value.toLowerCase() === 'null' || /^\[geometry/i.test(value)) continue;
    if (!(key in out)) out[key] = value;
  }
  return out;
}

// Format „@": cała odpowiedź w jednej linii, sekcje „@Tytuł warstwy pole1;…;poleN; w1;…;wN; @Tytuł…"
// (Kraków, Poznań, Święta Katarzyna). Znaki nowej linii zamieniono na spacje, więc nowy wiersz
// (wartości) zaczyna się od spacji po średniku, a pierwsze pole nagłówka to ostatnie słowo tytułu.
function collectSekcjeAt(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!/^\s*@/.test(text)) return out;
  for (const sekcja of text.split(/(?:^|\s)@/).slice(1)) {
    const wiersze: string[][] = [];
    sekcja
      .replace(/;\s*$/, '')
      .split(';')
      .forEach((pole, i) => {
        if (i === 0 || /^\s/.test(pole)) wiersze.push([pole.trim()]);
        else wiersze[wiersze.length - 1].push(pole.trim());
      });
    const [naglowek, ...wartosci] = wiersze;
    if (!naglowek || naglowek.length < 3) continue;
    naglowek[0] = naglowek[0].split(/\s+/).pop() ?? '';
    for (const wiersz of wartosci) {
      // Średnik albo spacja na początku wartości przesuwa kolumny: taki wiersz pomijamy.
      if (wiersz.length !== naglowek.length) continue;
      naglowek.forEach((pole, i) => {
        const key = pole.toLowerCase();
        const value = wiersz[i];
        if (!key || !value || value.toLowerCase() === 'null' || key in out) return;
        out[key] = value;
      });
    }
  }
  return out;
}

const XML_ENCJE: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };

// Liście XML z wartością: <numeruchwaly>…</numeruchwaly> (MapServer), <qgs:nazwa>…</qgs:nazwa>
// (QGIS). Pomijamy gml:*, bo gml:name to tytuł warstwy („Zasięgi obowiązujących miejscowych
// planów"), a nie nazwa planu.
function collectGmlValues(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<(?!gml:)((?:[\w-]+:)?([A-Za-z_][\w.-]*))(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const key = m[2].toLowerCase();
    const value = m[3]
      .replace(/&(lt|gt|quot|apos|amp);/g, (_, e: string) => XML_ENCJE[e])
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
      .trim();
    if (!value || value.toLowerCase() === 'null' || key in out) continue;
    out[key] = value;
  }
  return out;
}

const OBIEKT_RE = /^[ \t]*Feature[ \t]+\d+:?[ \t]*$/;
const WARSTWA_RE = /^[ \t]*Layer[ \t]+'([^']*)'/;
const ATRYBUT_RE = /^[ \t]*[A-Za-z_][\w.]*[ \t]*=/;

// Warstwy, w których text/plain trafił obiekt bez żadnego atrybutu („Layer 'mpzp' / Feature 0:").
// QGIS też pisze „Feature 1450", ale z atrybutami pod spodem, i to zostaje zwykłym odczytem.
function warstwyObiektowBezAtrybutow(text: string): Set<string> {
  const warstwy = new Set<string>();
  let warstwa = '';
  let wObiekcie = false;
  let atrybuty = 0;
  for (const linia of [...text.split(/\r?\n/), "Layer ''"]) {
    const obiekt = OBIEKT_RE.test(linia);
    const nowaWarstwa = linia.match(WARSTWA_RE);
    if (obiekt || nowaWarstwa) {
      if (wObiekcie && atrybuty === 0) warstwy.add(warstwa);
      if (nowaWarstwa) warstwa = nowaWarstwa[1];
      wObiekcie = obiekt;
      atrybuty = 0;
    } else if (wObiekcie && ATRYBUT_RE.test(linia)) {
      atrybuty++;
    }
  }
  return warstwy;
}

// „Uchwała Nr XXXIX/773/17 Rady Miasta … z dnia 25 stycznia 2017 r. …" -> „Nr XXXIX/773/17 z 25
// stycznia 2017". Gdy nie pasuje (np. sam numer „XXII/178/12"), zwracamy skrócony oryginał.
function shortenResolution(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/(?:Nr|nr)\s*([\w./-]+)[\s\S]*?z dnia\s*([0-9]{1,2}[^,;0-9]*?[0-9]{4})/);
  if (m) return `Nr ${m[1]} z ${m[2].trim()}`;
  return v.length > 90 ? `${v.slice(0, 90)}…` : v;
}

// Tytuł INSPIRE „Uchwała Nr LII/903/VII/2017 Rady Miasta Poznania z dnia 11 lipca 2017 roku w sprawie
// …" -> „Nr LII/903/VII/2017 z 11 lipca 2017". Bez numeru i daty null: sam tytuł to nie uchwała.
function uchwalaZTytulu(v: string | null): string | null {
  if (!v || !/^\s*uchwał/i.test(v)) return null;
  const skrot = shortenResolution(v);
  return skrot?.startsWith('Nr ') ? skrot : null;
}

const MIESIACE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

// Numer i data uchwalenia w osobnych polach (GISON, Kraków): „XXXI/148/2026" + „2026-03-25" ->
// „Nr XXXI/148/2026 z 25 marca 2026", w tym samym zapisie co `shortenResolution`.
function uchwalaZNumeru(numer: string | null, data: string | null): string | null {
  if (!numer) return null;
  const [rok, miesiac, dzien] = (isoDate(data) ?? '').split('-').map(Number);
  const nazwaMiesiaca = MIESIACE[miesiac - 1];
  return nazwaMiesiaca && dzien ? `Nr ${numer} z ${dzien} ${nazwaMiesiaca} ${rok}` : numer;
}

// „obowiazujacy" w różnych wariantach zapisu -> jedna, czytelna etykieta. Wartości spoza
// słownika pokazujemy tak, jak przyszły z gminy, o ile nie są technicznym śmieciem.
function statusLabel(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (/^obowi|^prawnie wiąż/.test(t)) return 'obowiązujący';
  if (/^nieobowi|uchylon|wygas/.test(t)) return 'nieobowiązujący';
  if (/^projekt|przystapien|przystąpien/.test(t)) return 'w opracowaniu';
  return t.length <= 40 ? v.trim() : null;
}

// „2014-01-15" (większość gmin) albo „04.09.2011" (Kraków) -> „RRRR-MM-DD".
function isoDate(v: string | null): string | null {
  if (!v) return null;
  const iso = v.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const pl = v.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  return pl ? `${pl[3]}-${pl[2]}-${pl[1]}` : null;
}

// „Miejscowy plan zagospodarowania przestrzennego obrębu Skawinki na terenie gminy Lanckorona
// (uchwała nr XXXI/148/2026)" -> „obrębu Skawinki na terenie gminy Lanckorona". Raport sam pisze
// „obowiązuje miejscowy plan zagospodarowania", a uchwała, gdy ją znamy, ma własną rubrykę.
function ladnaNazwaPlanu(v: string | null, znamyUchwale: boolean): string | null {
  if (!v) return null;
  let nazwa = v.trim();
  if (znamyUchwale) {
    nazwa = nazwa
      .replace(/\s*\(\s*uchwał[aą][^)]*\)\s*$/i, '')
      .replace(/^uchwał[aą]\s[\s\S]*?\sw sprawie\s+(?:uchwalenia\s+)?(?=miejscow)/i, '')
      .trim();
  }
  const reszta = nazwa
    .replace(/^(?:miejscow\S*\s+plan\S*\s+zagospodarowania(?:\s+przestrzennego)?|mpzp)\s+/i, '')
    .trim();
  return reszta.length >= 3 ? reszta : nazwa || v;
}

// Tylko pełny adres http(s) do PDF. Nazwy plików bez adresu („XLII_384_2014_tekst.pdf") i inne
// schematy odpadają, bo wartość trafia wprost do href na stronie.
function pickPdf(kv: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = kv[k]?.trim();
    if (v && /^https?:\/\/[^\s"'<>]+\.pdf(?:[?#][^\s"'<>]*)?$/i.test(v)) return v;
  }
  return null;
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  const v = m?.[1]?.trim();
  if (!v || v.toLowerCase() === 'null') return null;
  return v;
}

function zbudujInfo(kv: Record<string, string>, row = ''): MpzpInfo {
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = kv[k.toLowerCase()];
      if (v) return v;
    }
    return null;
  };

  // MAX_WYS / INTEN_ZAB bywają "0" dla terenów bez zabudowy (drogi) — traktuj "0" jak brak.
  const nonZero = (v: string | null) => (v && v !== '0' && v !== '0,0' ? v : null);

  // Aliasy pól: KIMPZP to federacja usług gminnych i te same informacje jeżdżą pod różnymi
  // nazwami. Pomiar na 60 punktach z naszej podaży pokazał, co realnie wystawiają gminy:
  // nazwa / nazwa_pelna_plan / nr_plan, numer_uchwaly / nr_uchwala / uchwala,
  // data / wazne_od / data_uchwalenie. Pomiar 2026-09-15 (272 punkty) dołożył GISON w GML
  // (nazwapelnaplanu, numeruchwaly, datauchwalenia, uchwala = adres PDF), Kraków (nazwa mpzp,
  // opis_oznac, uchwalenie), Poznań (tytulAlternatywny, tytul), Świętą Katarzynę (Nazwaplanu,
  // Numeruchwały, Datawejściawżycie) i Szczecin (nazwa_plan, nr_uch_uch, data_uch_u, data_obow).
  const resolution =
    shortenResolution(pick('dokumentuchwalajacy', 'numer_uchwaly', 'nr_uchwala', 'uchwala_nr')) ??
    uchwalaZNumeru(
      pick('numeruchwaly', 'numeruchwały', 'uchwalenie', 'nr_uch_uch'),
      pick('datauchwalenia', 'data uchwalenia', 'data_uch_u')
    ) ??
    uchwalaZTytulu(pick('tytul'));
  return {
    planName: ladnaNazwaPlanu(
      tag(row, 'NAZWA_PLAN') ??
        pick(
          'tytulalternatywny',
          'tytul',
          'name',
          'mpzp_opis',
          'nazwa',
          'nazwa_pelna_plan',
          'nazwapelnaplanu',
          'nazwaplanu',
          'nazwa_plan',
          'nazwa mpzp',
          'nr_plan'
        ),
      !!resolution
    ),
    functionName:
      tag(row, 'FUN_NAZWA') ?? pick('opis', 'fun_nazwa', 'przeznaczenie', 'funkcja', 'opis_oznac'),
    functionSymbol: tag(row, 'FUN_SYMB') ?? pick('oznaczenie', 'fun_symb', 'symbol'),
    maxHeight: nonZero(tag(row, 'MAX_WYS') ?? pick('max_wys', 'maks_wys', 'wysokosc')),
    intensity: nonZero(tag(row, 'INTEN_ZAB') ?? pick('inten_zab', 'intensywnosc')),
    effectiveFrom: isoDate(
      tag(row, 'DATA') ??
        pick(
          'obowiazujeod',
          'data',
          'wazne_od',
          'data_uchwalenie',
          'data_ogloszenie',
          'datawejściawżycie',
          'data_obow',
          'data obowiązywania'
        )
    ),
    resolution,
    status: statusLabel(pick('status', 'status_title')),
    resolutionUrl: pickPdf(kv, 'uchwala', 'link_uchwala', 'link', 'dokumentuchwalajacy'),
  };
}

/** Odczyt odpowiedzi text/plain. Wydzielony, żeby dało się go testować na zapisanych odpowiedziach. */
export function parseMpzpText(text: string): MpzpOdczyt {
  // Format <ROW> (XML) — jeśli jest, ma pierwszeństwo dla swoich pól.
  const row = text.match(/<ROW\b[\s\S]*?<\/ROW>/)?.[0] ?? '';
  const info = zbudujInfo({ ...collectSekcjeAt(text), ...collectKeyValues(text) }, row);
  if (info.planName || info.functionName || info.functionSymbol) return { wynik: 'plan', info };

  // Kolejność ma znaczenie: przy punkcie na granicy gmin jedna może odpowiedzieć „brak wyniku",
  // a druga obiektem planu. Liczy się to, co wiemy, a nie to, czego jedna z gmin nie znalazła.
  const bezAtrybutow = warstwyObiektowBezAtrybutow(text);
  if ([...bezAtrybutow].some((w) => w !== GISON_ARKUSZE)) return { wynik: 'bezAtrybutow' };
  // Sam arkusz rysunku GISON nie mówi, czy plan obejmuje punkt, a zasięgu planu (warstwy APP)
  // integracja nie pyta dla każdej gminy GISON: w Kornowacu prawdziwy plan wyglądał dokładnie tak samo.
  if (bezAtrybutow.size > 0) return { wynik: 'nieczytelny', powod: 'sam arkusz rysunku planu GISON, bez zasięgu planu' };

  // Wyjątek to awaria serwera gminy (np. zła konfiguracja warstw), a nie odpowiedź „tu nie ma planu".
  if (/ServiceException/i.test(text)) {
    const tresc = text.match(/<ServiceException\b[^>]*>([\s\S]*?)<\/ServiceException>/i)?.[1]?.trim();
    return { wynik: 'nieczytelny', powod: `wyjątek serwera gminy${tresc ? `: ${tresc.slice(0, 160)}` : ''}` };
  }
  // Plan wystawiony jako sam skan rysunku: usługa oddaje kolor piksela, nie dane planu.
  if (/^[ \t]*Band[ \t]+\d+[ \t]*=/m.test(text)) {
    return { wynik: 'nieczytelny', powod: 'serwer gminy podaje tylko rysunek planu' };
  }
  // „<gmina>: brak wyniku dla wskazanego obszaru", „brak serwisu…", „no features were found",
  // warstwy bez obiektów. Uwaga: przy wiszącym serwerze gminy to samo „brak wyniku" przychodzi
  // dopiero po ~60 s, dlatego `rzucajBledy` ma limit czasu krótszy niż to czekanie.
  return { wynik: 'brak' };
}

/**
 * Odczyt GML dla punktu, w którym text/plain trafił obiekt planu bez atrybutów. `plan`, gdy jest
 * cokolwiek o planie (nazwa, uchwała, adres PDF); `bezAtrybutow`, gdy poprawny dokument GML ma sam
 * zasięg planu; `nieczytelny`, gdy przyszedł wyjątek albo coś innego niż dokument GML.
 */
export function parseMpzpGml(text: string): MpzpOdczyt {
  if (/ServiceException/i.test(text)) return { wynik: 'nieczytelny', powod: 'wyjątek serwera gminy w GML' };
  if (!/<(?:[\w-]+:)?(?:msGMLOutput|FeatureCollection)\b/.test(text)) {
    return { wynik: 'nieczytelny', powod: 'odpowiedź bez dokumentu GML' };
  }
  const info = zbudujInfo(collectGmlValues(text));
  const cokolwiek =
    info.planName || info.functionName || info.functionSymbol || info.resolution || info.resolutionUrl;
  return cokolwiek ? { wynik: 'plan', info } : { wynik: 'bezAtrybutow' };
}

/**
 * Odczyt GML wprost z serwera gminy na hostingu GISON (warstwy GISON_WARSTWY). Plan tylko z zasięgu
 * APP; `brak`, gdy punkt leży w obrysie gminy, a żaden zasięg planu go nie obejmuje. Pusta odpowiedź
 * bez obrysu to `nieczytelny`: profil nie obejmuje punktu (np. gmina zmieniła dostawcę po
 * wygenerowaniu tabeli).
 */
export function parseGisonGml(text: string): MpzpOdczyt {
  const odczyt = parseMpzpGml(text);
  if (odczyt.wynik === 'nieczytelny') return odczyt;
  if (!/<maska_feature>/.test(text)) {
    return { wynik: 'nieczytelny', powod: 'punkt poza obrysem gminy w usłudze GISON' };
  }
  if (!/<app\.AktPlanowaniaPrzestrzennego\.MPZP_feature>/.test(text)) return { wynik: 'brak' };
  return odczyt;
}

/**
 * Czy zapisany odczyt planu (raport pod ofertą) trzeba powtórzyć. „teraz": „brak planu" zapisany
 * starszą wersją odczytu, która brała plany GISON, format „@" i awarie serwerów gmin za brak planu,
 * albo plan bez żadnych danych z wersji 2, który bywał samym arkuszem rysunku GISON.
 * „pozniej": plan jest, ale jego szczegóły nie przyszły.
 */
export function ponowOdczytMpzp(mpzp: MpzpInfo | null, wersja: number | undefined): 'teraz' | 'pozniej' | null {
  const w = wersja ?? 1;
  if (mpzp) {
    const bezDanych = !mpzp.planName && !mpzp.functionName && !mpzp.functionSymbol && !mpzp.resolution;
    if (w < 3 && bezDanych) return 'teraz';
    return mpzp.detailsUnavailable ? 'pozniej' : null;
  }
  return w < MPZP_WERSJA ? 'teraz' : null;
}

// WGS84 (lat/lng) -> Web Mercator (EPSG:3857), którego używa WMS i kafle Google.
function to3857(lat: number, lng: number): { x: number; y: number } {
  const R = 20037508.34;
  const x = (lng * R) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * R) / 180;
  return { x, y };
}

const CACHE_S = 60 * 60 * 24 * 7;
// Przy `rzucajBledy` jeden limit na cały odczyt: serwer GISON, text/plain i ewentualne dociągnięcie GML.
const LIMIT_MS = 20_000;
// Własne limity kroków w gminach GISON (zawsze, także bez `rzucajBledy`). Serwer GISON wprost
// odpowiadał w pomiarze w medianie po 0,16 s, najwolniej po 4,3 s; limit dłuższy niż potwierdzenie, bo
// przy wolnym serwerze GISON integracja nie pomoże (pyta ten sam serwer). Integracja, gdy nie wisiała,
// odpowiadała w medianie po 0,35 s, ale na krańcach fali po 10-16 s, a każda sekunda potwierdzenia to
// sekunda czekania na „brak planu" w trakcie fali.
const GISON_LIMIT_MS = 8_000;
const POTWIERDZENIE_MS = 3_000;

function adresZapytania(
  lat: number,
  lng: number,
  infoFormat: string,
  usluga = MPZP_WMS,
  warstwy = MPZP_LAYER
): string {
  const { x, y } = to3857(lat, lng);
  const d = 100; // metry — mały prostokąt wokół punktu; środek piksela = nasz punkt
  const url = new URL(usluga);
  const params: Record<string, string> = {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: warstwy,
    QUERY_LAYERS: warstwy,
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: `${x - d},${y - d},${x + d},${y + d}`,
    WIDTH: '256',
    HEIGHT: '256',
    I: '128',
    J: '128',
    INFO_FORMAT: infoFormat,
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function odczytGml(lat: number, lng: number, limit: AbortSignal | undefined): Promise<MpzpOdczyt> {
  try {
    const res = await fetch(adresZapytania(lat, lng, 'application/vnd.ogc.gml'), {
      next: { revalidate: CACHE_S },
      signal: limit ?? AbortSignal.timeout(LIMIT_MS),
    });
    if (!res.ok) return { wynik: 'nieczytelny', powod: `GML HTTP ${res.status}` };
    return parseMpzpGml(await res.text());
  } catch (err) {
    return { wynik: 'nieczytelny', powod: err instanceof Error ? err.name : 'błąd GML' };
  }
}

// Limit kroku, a przy `rzucajBledy` także limit całego odczytu, gdy ten skończy się wcześniej.
function zLimitem(limit: AbortSignal | undefined, ms: number): AbortSignal {
  return limit ? AbortSignal.any([limit, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
}

async function odczytGison(
  profil: string,
  lat: number,
  lng: number,
  limit: AbortSignal | undefined
): Promise<MpzpOdczyt> {
  try {
    const res = await fetch(
      adresZapytania(lat, lng, 'application/vnd.ogc.gml', GISON_WMS + profil, GISON_WARSTWY),
      { next: { revalidate: CACHE_S }, signal: zLimitem(limit, GISON_LIMIT_MS) }
    );
    if (!res.ok) return { wynik: 'nieczytelny', powod: `HTTP ${res.status}` };
    return parseGisonGml(await res.text());
  } catch (err) {
    return { wynik: 'nieczytelny', powod: err instanceof Error ? err.name : 'błąd zapytania' };
  }
}

// Plan obejmuje punkt, ale bez nazwy i uchwały. `ponowic`: szczegóły nie przyszły przez chwilową
// awarię (limit czasu, wyjątek), więc warto zapytać znowu; poprawny GML z samym zasięgiem to nie awaria.
function planBezSzczegolow(ponowic: boolean): MpzpInfo {
  return {
    planName: null,
    functionName: null,
    functionSymbol: null,
    maxHeight: null,
    intensity: null,
    effectiveFrom: null,
    resolution: null,
    status: null,
    resolutionUrl: null,
    ...(ponowic ? { detailsUnavailable: true } : {}),
  };
}

/**
 * Przeznaczenie MPZP w punkcie (środek działki). Zwraca `null`, gdy w tym miejscu nie ma planu w
 * KIMPZP (gmina niezintegrowana albo teren bez planu) albo usługa nie odpowie.
 */
// `rzucajBledy`: raport zapisywany na stałe przy ofercie (lib/raportOferty.ts) i narzędzie muszą
// odróżnić „brak planu" od „nie wiemy" (usługa nie odpowiedziała, wyjątek serwera gminy, sam
// rysunek planu), inaczej awaria zostałaby pokazana albo zapisana jako brak planu.
//
// `teryt` (6 cyfr gminy, początek identyfikatora działki z ULDK): gminy GISON pytamy najpierw wprost.
// Krajowa integracja bierze ich plany z tego samego serwera, ale ta droga wisi falami, wszystkie gminy
// GISON naraz: integracja czeka ~60 s i odpowiada „<gmina>: brak wyniku", tak jak przy prawdziwym
// braku planu. Pomiar 2026-09-16, 20:52-22:09, trzy fale po 20-30 min z kilkuminutowymi przerwami
// (187 par zapytań w tej samej chwili, 12 punktów w planach 11 gmin): integracja wisiała w 156 parach
// (83%), a serwer GISON wprost oddał plan we wszystkich 187. Gminy spoza GISON (Kraków, Poznań,
// Wieliczka) nie zawisły w integracji ani razu.
// Poza falą, w 107 losowych punktach 107 gmin GISON, serwer wprost rozstrzygnął każdy punkt (54 plany,
// 53 braki). Integracja przepuszcza sam arkusz rysunku (GISON_ARKUSZE) i nie każdej gminie zadaje
// pytanie o zasięg APP, więc przez nią 31 z tych punktów to „nie wiemy" (wersja 2 brała 30 z nich
// za plan bez szczegółów).
//  - plan z serwera GISON: gotowe, jedno zapytanie zamiast dwóch;
//  - „brak planu" z serwera GISON: potwierdzamy w integracji, ale najwyżej POTWIERDZENIE_MS. Gdy
//    integracja wisi albo odpowiada nieczytelnie, zostaje „brak planu" od serwera gminy. Gdy znajdzie
//    plan (np. gmina zmieniła dostawcę po wygenerowaniu tabeli), wygrywa plan;
//  - każda inna odpowiedź GISON (limit czasu, wyjątek, punkt poza obrysem gminy): jak dotąd, sama
//    integracja, w pozostałym czasie odczytu.
export async function getMpzpAtPoint(
  lat: number,
  lng: number,
  opts: { rzucajBledy?: boolean; teryt?: string | null } = {}
): Promise<MpzpInfo | null> {
  const limit = opts.rzucajBledy ? AbortSignal.timeout(LIMIT_MS) : undefined;

  const profil = opts.teryt ? GISON_GMINY[opts.teryt.slice(0, 6)] : undefined;
  const gison = profil ? await odczytGison(profil, lat, lng, limit) : null;
  if (gison?.wynik === 'plan') return gison.info;
  if (gison?.wynik === 'bezAtrybutow') return planBezSzczegolow(false);
  // Do logu, bo to albo awaria GISON, albo nieaktualna tabela gmin, albo blokada naszych serwerów.
  if (gison?.wynik === 'nieczytelny') console.warn('MPZP_GISON_NIECZYTELNY', profil, gison.powod);
  const brakWGminie = gison?.wynik === 'brak';
  const sygnal = brakWGminie ? zLimitem(limit, POTWIERDZENIE_MS) : limit;

  try {
    const res = await fetch(adresZapytania(lat, lng, 'text/plain'), {
      next: { revalidate: CACHE_S },
      ...(sygnal ? { signal: sygnal } : {}),
    });
    if (!res.ok) {
      if (opts.rzucajBledy) throw new Error(`MPZP HTTP ${res.status}`);
      return null;
    }

    const odczyt = parseMpzpText(await res.text());
    if (odczyt.wynik === 'plan') return odczyt.info;
    if (odczyt.wynik === 'brak') return null;
    if (odczyt.wynik === 'nieczytelny') throw new Error(`MPZP: ${odczyt.powod}`);

    // Obiekt planu bez atrybutów: plan jest, a szczegóły ten sam serwer podaje tylko w GML. Jeśli GML
    // nie przyjdzie, zostaje plan bez szczegółów, bo to, że plan obejmuje punkt, już wiemy.
    const gml = await odczytGml(lat, lng, limit);
    if (gml.wynik === 'plan') return gml.info;
    return planBezSzczegolow(gml.wynik === 'nieczytelny');
  } catch (err) {
    // Integracja nie potwierdziła w czasie (fala wiszenia GISON) albo odpowiedziała nieczytelnie, a
    // serwer planów gminy sam odpowiedział, że w jej obrysie żaden plan nie obejmuje punktu.
    if (brakWGminie) return null;
    if (opts.rzucajBledy) throw err;
    return null;
  }
}
