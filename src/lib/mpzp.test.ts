// Odczyt planu miejscowego z krajowej integracji (KIMPZP). Bez sieci: karmimy parser prawdziwymi
// odpowiedziami usługi zapisanymi 2026-09-15. Stawka jak w pog.test.ts: odpowiedź, której parser nie
// rozumie, NIE może zamienić się w „brak planu" ([[feedback-filtry-twarde]]). Ten błąd żył długo, bo
// wygląda jak zwykła, uczciwa odpowiedź.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MPZP_WERSJA,
  getMpzpAtPoint,
  parseMpzpGml,
  parseMpzpText,
  ponowOdczytMpzp,
  type MpzpInfo,
  type MpzpOdczyt,
} from './mpzp';

// Lanckorona (hosting GISON): text/plain trafia obiekty planu, ale bez żadnego atrybutu.
const GISON_TXT = `GetFeatureInfo results:

Layer 'mpzp'
  Feature 0:

Layer 'app.AktPlanowaniaPrzestrzennego.MPZP'
  Feature 0:
`;

// Ten sam punkt w GML: pełne dane planu i publiczny PDF uchwały.
const GISON_GML = `<?xml version="1.0" encoding="UTF-8"?>

<msGMLOutput
	 xmlns:gml="http://www.opengis.net/gml"
	 xmlns:xlink="http://www.w3.org/1999/xlink"
	 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<mpzp_layer>
	<gml:name>Zasięgi obowiązujących miejscowych planów</gml:name>
		<mpzp_feature>
			<gml:boundedBy>
				<gml:Box srsName="EPSG:3857">
					<gml:coordinates>2194242.213723,6414619.108925 2194242.213723,6414619.108925</gml:coordinates>
				</gml:Box>
			</gml:boundedBy>
		</mpzp_feature>
	</mpzp_layer>
	<app.AktPlanowaniaPrzestrzennego.MPZP_layer>
	<gml:name>app.AktPlanowaniaPrzestrzennego.MPZP</gml:name>
		<app.AktPlanowaniaPrzestrzennego.MPZP_feature>
			<gml:boundedBy>
				<gml:Box srsName="EPSG:3857">
					<gml:coordinates>2191187.293290,6412331.948028 2196540.843413,6417636.680083</gml:coordinates>
				</gml:Box>
			</gml:boundedBy>
			<guid>f5283750-2954-439a-8f48-f97ac47fee37</guid>
			<nazwaskroconaplanu>2026_148_XXXI</nazwaskroconaplanu>
			<nazwapelnaplanu>Miejscowy plan zagospodarowania przestrzennego obrębu Skawinki na terenie gminy Lanckorona (uchwała nr XXXI/148/2026)</nazwapelnaplanu>
			<numeruchwaly>XXXI/148/2026</numeruchwaly>
			<datauchwalenia>2026-03-25</datauchwalenia>
			<typ>MPZP</typ>
			<legenda>https://rastry.gison.pl/mpzp-public/lanckorona/legendy/Z01_2026_148_XXXI_legenda.png</legenda>
			<uchwala>https://rastry.gison.pl/mpzp-public/lanckorona/uchwaly/U_2026_148_XXXI.pdf</uchwala>
			<profil>lanckorona</profil>
		</app.AktPlanowaniaPrzestrzennego.MPZP_feature>
	</app.AktPlanowaniaPrzestrzennego.MPZP_layer>
</msGMLOutput>
`;

// Gmina GISON, która także w GML wystawia sam zasięg obowiązującego planu (51.1779, 17.0385).
const GISON_GML_ZASIEG = `<?xml version="1.0" encoding="UTF-8"?>

<msGMLOutput
	 xmlns:gml="http://www.opengis.net/gml"
	 xmlns:xlink="http://www.w3.org/1999/xlink"
	 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<mpzp_layer>
	<gml:name>Zasięgi obowiązujących miejscowych planów</gml:name>
		<mpzp_feature>
			<gml:boundedBy>
				<gml:Box srsName="EPSG:3857">
					<gml:coordinates>1896717.527714,6652822.324514 1896717.527714,6652822.324514</gml:coordinates>
				</gml:Box>
			</gml:boundedBy>
		</mpzp_feature>
	</mpzp_layer>
</msGMLOutput>
`;

// Kraków (Bronowice): jedna linia, sekcje „@warstwa pola; wartości;". Dwie z trzech skal.
const KRAKOW_TXT =
  '@Przeznaczenia MPZP skala od 1:2000 id_pg;gdb_id;Uchwalenie;Data uchwalenia;Ogłoszenie;Data DUWM;Data obowiązywania;Oznaczenie;Nazwa MPZP;WWW;Rodzaj oznaczenia;opis_oznac;Shape;Data zasilenia; 4811;5825A80FC122EF52E0630D0A1EAC2F98;LIX/813/12;24.10.2012;2012.5524;06.11.2012;07.12.2012;MN/U.2.6;BRONOWICE MAŁE - TETMAJERA;http://www.bip.krakow.pl/?dok_id=53703;MN/U;Tereny Zabudowy Mieszkaniowej Jednorodzinnej;Polygon;2026-09-14; @Przeznaczenia MPZP skala od 1:1000 - 1:2000 id_pg;gdb_id;Uchwalenie;Data uchwalenia;Ogłoszenie;Data DUWM;Data obowiązywania;Oznaczenie;Nazwa MPZP;WWW;Rodzaj oznaczenia;opis_oznac;Shape;Data zasilenia; 4811;5825A80FC122EF52E0630D0A1EAC2F98;LIX/813/12;24.10.2012;2012.5524;06.11.2012;07.12.2012;MN/U.2.6;BRONOWICE MAŁE - TETMAJERA;http://www.bip.krakow.pl/?dok_id=53703;MN/U;Tereny Zabudowy Mieszkaniowej Jednorodzinnej;Polygon;2026-09-14; ';

// Ten sam punkt w GML: serwer Krakowa odpowiada wyjątkiem.
const KRAKOW_GML = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!DOCTYPE ServiceExceptionReport SYSTEM "http://schemas.opengis.net/wms/1.1.1/exception_1_1_1.dtd">
<ServiceExceptionReport version="1.1.1">
  <ServiceException code="InvalidXslTemplate">
Can't template xml document.
  </ServiceException>
</ServiceExceptionReport>`;

// Poznań: układ „@" z polami INSPIRE (tytuł uchwały, tytuł alternatywny, obowiązuje od).
const POZNAN_TXT = `@app.AktPlanowaniaPrzestrzennego.MPZP OBJECTID;Shape;gml_id;identifier_codeSpace;identifier;przestrzenNazw;lokalnyId;wersjaId;poczatekWersjiObiektu;tytul;tytulAlternatywny;typPlanu_title;typPlanu_href;poziomHierarchii_title;poziomHierarchii_href;obowiazujeOd;status_title;status_href;data;referencja;dokumentPrzystepujacy_href;dokumentUchwalajacy_href;rysunek_href;dokumentUchylajacy_href;dokumentUniewazniajacy_href;obowiazujeDo;Shape_Length;Shape_Area;dokument_href; 295;Polygon;PL.ZIPPZP.4177_306401-MPZP_P_Mau_20221103T000000;https://www.gov.pl/zagospodarowanieprzestrzenne/app;https://www.gov.pl/zagospodarowanieprzestrzenne/app/AktPlanowaniaPrzestrzennego/PL.ZIPPZP.4177/306401-MPZP/P_Mau/20221103T000000;PL.ZIPPZP.4177/306401-MPZP;P_Mau;20221103T000000;2022-11-03T00:00:00;Uchwała Nr LII/903/VII/2017 Rady Miasta Poznania z dnia 11 lipca 2017 roku w sprawie miejscowego planu zagospodarowania przestrzennego obszaru "Morasko-Radojewo-Umultowo" część jezioro Umultowskie w Poznaniu;Mpzp obszaru "Morasko-Radojewo-Umultowo" część jezioro Umultowskie w Poznaniu;miejscowy plan zagospodarowania przestrzennego;https://www.gov.pl/static/zagospodarowanieprzestrzenne/codelist/TypAktuPlanowaniaPrzestrzennegoKod/miejscowyPlanZagospodarowaniaPrzestrzennego;sublokalny;http://inspire.ec.europa.eu/codelist/LevelOfSpatialPlanValue/infraLocal;2017-08-19;prawnie wiążący lub realizowany;http://inspire.ec.europa.eu/codelist/ProcessStepGeneralValue/legalForce;["2008-07-18"];["mapa zasadnicza"];["https://www.gov.pl/zagospodarowanieprzestrzenne/app/DokumentFormalny/PL.ZIPPZP.4177/306401-MPZP/Doc_PMa"];https://www.gov.pl/zagospodarowanieprzestrzenne/app/DokumentFormalny/PL.ZIPPZP.4177/306401-MPZP/Doc_Mau;https://www.gov.pl/zagospodarowanieprzestrzenne/app/RysunekAktuPlanowaniaPrzestrzennego/PL.ZIPPZP.4177/306401-MPZP/Rys_Mau/20221103T000000;Null;Null;Null;4274,615223;900068,68115;Null; `;

// Święta Katarzyna pod Wrocławiem: „@1" i nazwy pól sklejone bez spacji.
const SWIETA_KATARZYNA_TXT = `@1 OBJECTID;Symbol;Nazwaplanu;Numeruchwały;Datauchwalenia;Numeruchwałyoprzystąpieniu;Dataprzystąpienia;Dataogłoszenia;Datawejściawżycie;Datawygaśnięcia;SymbolGUSgminy;Skalarysunkuplanu;Obszar;Nazwaskrócona;Numerobrębu;Numerdziennikawojewódzkiego;STATUS;PRZESTRZEN_NAZW;IDENTYFIKATOR;NR_PORZADK;SkargiWojewodyWojewódzkiSądAdministracyjny;Shape;SHAPE.AREA;SHAPE.LEN; 26323;RAE-1;MPZP obrębu Radomierzyce, gmina Święta Katarzyna oraz zmiana MPZP wsi Żerniki Wrocławskie – teren „B” obejmującej działkę nr 51/2, gmina Święta Katarzyna;X/93/03;28.08.2003;XXXII/284/01;02.02.2001;03.12.2003;17.12.2003;Null;0223085;1:5000;obejmujący obręb Radomierzyce;Radomierzyce Cały;022308_5.0011;Nr 219 poz. 3156;uchwalony, obowiązujący w części;PL.ZIPPZP.2637;PL.ZIPPZP.2637.150;150;Null;Polygon;1238468,931885;7847,449802; `;

// Sękowa (schemat mpzp_meta + dod_info + mpzp): warstwa dodatkowa stoi przed przeznaczeniem.
const SEKOWA_TXT = `GetFeatureInfo results

Layer 'mpzp_meta'
Feature 246
oid = '246'
nazwa = 'GMINY SĘKOWA'
numer = 'NULL'
numer_uchwaly = 'XXXV/370/2022'
data = '2022-08-28'
status = 'obowiazujacy'
raster = 'NULL'
uchwala = 'XXXV_370_2022_tekst.pdf'
metadane = ''
app_gml = 'APP_XXXV_370_2022_PWLR_v3_0.gml'
app_raster = 'NULL'
app_legenda = 'NULL'
inne = ''
lp = 'NULL'

Layer 'dod_info_pkt'

Layer 'dod_info_lin'

Layer 'dod_info_pow'
Feature 166
id = '166'
symbol = 'NULL'
opis = 'Tereny zagrożone osuwaniem się mas ziemnych'
uchwala = 'XVII_112_2004'
raster = 'nr_XVII_112_2004'
wazne_od = 'NULL'
wazne_do = 'NULL'
pow_metr_2 = '2908632.15'
s_standard = 'NULL'
s_oryginal = 'NULL'

Layer 'mpzp'
Feature 7977
oid = '7977'
oznaczenie = 'LS1'
opis = 'Tereny leśne Skarbu Państwa (lasy ochronne)'
numer = 'NULL'
plan_oid = 'NULL'
color = 'L'
numer_uchwaly = 'XVII/112/2004'
`;

// Gdów: pełny adres PDF uchwały w polu link.
const GDOW_TXT = `GetFeatureInfo results

Layer 'MPZP_gdow'
Legenda: = 'no data'
MPZP: = '<a href="https://gdow.e-mpzp.pl/tekst/IX_52_2007.pdf" target="_blank">Link do tekstu uchwały</a>'
Nazwa: = 'MPZP sołectwa Wiatowice, uchwała nr IX/52/2007'
Sołectwo: = 'Wiatowice'
area = '2837.89608952'
fid = '20'
id = '28'
link = 'http://www.gdow.e-mpzp.pl/tekst/IX_52_2007.pdf'
mpzp_id = 'no data'
mpzp_opis = 'MPZP sołectwa Wiatowice, uchwała nr IX/52/2007'
tekst = 'ZL14'
uchwala = 'IX/52/2007'
Band 1 = '249'
Band 2 = '248'
Band 3 = '190'
Nazwa = 'Gdów'
TERYT = '121902_2'
`;

// Muszyna: serwer gminy źle skonfigurowany, krajowa integracja przekazuje jego wyjątek.
const MUSZYNA_TXT = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE ServiceExceptionReport SYSTEM "https://sip.muszyna.pl/geoserver/schemas/wms/1.1.1/WMS_exception_1_1_1.dtd"> <ServiceExceptionReport version="1.1.1" >   <ServiceException code="org.geoserver.wms.featureinfo.GetFeatureInfoKvpReader$GetFeatureInfoKvpRequestReader">
      No LAYERS has been requested
</ServiceException></ServiceExceptionReport>`;

// Michałowice: plan wystawiony jako skan rysunku, usługa oddaje kolor piksela.
const MICHALOWICE_TXT = `GetFeatureInfo results

Layer 'MPZP_-_Micha_owice_Po_noc'

Layer 'MPZP_-_Micha_owice_Po_udnie'
Band 1 = '140'
Band 2 = '116'
Band 3 = '94'
Band 4 = '255'

Layer 'MPZP'
Band 1 = '90'
Band 2 = '64'
Band 3 = '47'
Band 4 = '255'
`;

// Prawdziwe odpowiedzi „tu nie ma planu" z kilku typów serwerów.
const BRAKI = [
  'm. Kraków: brak wyniku dla wskazanego obszaru',
  'brak serwisu dla wskazanego obszaru',
  'no features were found',
  `<?xml version="1.0" encoding="UTF-8"?>
<GetFeatureInfo_Result>
  <ROWSET name="MPZP_PRZEZNACZENIE_TERENU" >
  </ROWSET>
</GetFeatureInfo_Result>`,
  `GetFeatureInfo results

Layer 'mpzp_meta'

Layer 'dod_info_pkt'

Layer 'mpzp'
`,
];

function plan(o: MpzpOdczyt): MpzpInfo {
  if (o.wynik !== 'plan') throw new Error(`oczekiwano planu, jest: ${o.wynik}`);
  return o.info;
}

describe('parseMpzpText', () => {
  it('obiekty planu bez atrybutów (GISON) to nie brak planu', () => {
    expect(parseMpzpText(GISON_TXT)).toEqual({ wynik: 'bezAtrybutow' });
  });

  it('czyta format „@" Krakowa', () => {
    const info = plan(parseMpzpText(KRAKOW_TXT));
    expect(info.planName).toBe('BRONOWICE MAŁE - TETMAJERA');
    expect(info.functionSymbol).toBe('MN/U.2.6');
    expect(info.functionName).toBe('Tereny Zabudowy Mieszkaniowej Jednorodzinnej');
    expect(info.resolution).toBe('Nr LIX/813/12 z 24 października 2012');
    expect(info.effectiveFrom).toBe('2012-12-07');
    // WWW prowadzi do strony BIP, nie do PDF: nie podpisujemy tego jako tekstu uchwały.
    expect(info.resolutionUrl).toBeNull();
  });

  it('format „@" z polami INSPIRE (Poznań): krótka nazwa, uchwała z tytułu, status', () => {
    const info = plan(parseMpzpText(POZNAN_TXT));
    expect(info.planName).toBe('obszaru "Morasko-Radojewo-Umultowo" część jezioro Umultowskie w Poznaniu');
    expect(info.resolution).toBe('Nr LII/903/VII/2017 z 11 lipca 2017');
    expect(info.effectiveFrom).toBe('2017-08-19');
    expect(info.status).toBe('obowiązujący');
    expect(info.functionName).toBeNull();
  });

  it('format „@" ze sklejonymi nazwami pól (Święta Katarzyna)', () => {
    const info = plan(parseMpzpText(SWIETA_KATARZYNA_TXT));
    expect(info.functionSymbol).toBe('RAE-1');
    expect(info.planName?.startsWith('obrębu Radomierzyce, gmina Święta Katarzyna')).toBe(true);
    expect(info.resolution).toBe('Nr X/93/03 z 28 sierpnia 2003');
    expect(info.effectiveFrom).toBe('2003-12-17');
  });

  it('warstwa dod_info nie podmienia przeznaczenia terenu', () => {
    const info = plan(parseMpzpText(SEKOWA_TXT));
    expect(info.planName).toBe('GMINY SĘKOWA');
    expect(info.functionSymbol).toBe('LS1');
    expect(info.functionName).toBe('Tereny leśne Skarbu Państwa (lasy ochronne)');
    // Sama nazwa pliku bez adresu to nie link.
    expect(info.resolutionUrl).toBeNull();
  });

  it('sama warstwa dod_info, bez warstwy planu, to nie plan', () => {
    const dodatkowe = SEKOWA_TXT.slice(SEKOWA_TXT.indexOf("Layer 'dod_info_pkt'"), SEKOWA_TXT.indexOf("Layer 'mpzp'\n"));
    expect(parseMpzpText(`GetFeatureInfo results\n\n${dodatkowe}`)).toEqual({ wynik: 'brak' });
  });

  it('bierze pełny adres PDF uchwały, gdy gmina go podaje (Gdów)', () => {
    const info = plan(parseMpzpText(GDOW_TXT));
    expect(info.resolutionUrl).toBe('http://www.gdow.e-mpzp.pl/tekst/IX_52_2007.pdf');
    expect(info.planName).toBe('sołectwa Wiatowice, uchwała nr IX/52/2007');
  });

  it('adres uchwały trafia do href, więc tylko http(s) i tylko PDF', () => {
    const z = (uchwala: string) => plan(parseMpzpText(`nazwa = 'Plan'\nuchwala = '${uchwala}'`)).resolutionUrl;
    expect(z('javascript:alert(1)//x.pdf')).toBeNull();
    expect(z('https://bip.gmina.pl/uchwala-12')).toBeNull();
    expect(z('https://rastry.gison.pl/mpzp-public/x/uchwaly/U_1.pdf')).toBe('https://rastry.gison.pl/mpzp-public/x/uchwaly/U_1.pdf');
  });

  it('wyjątek serwera gminy to „nie wiemy", a nie brak planu', () => {
    const o = parseMpzpText(MUSZYNA_TXT);
    expect(o.wynik).toBe('nieczytelny');
    expect(o.wynik === 'nieczytelny' && o.powod).toContain('No LAYERS has been requested');
  });

  it('sam rysunek planu (kolor piksela) to „nie wiemy", a nie brak planu', () => {
    expect(parseMpzpText(MICHALOWICE_TXT).wynik).toBe('nieczytelny');
  });

  it('prawdziwy brak planu zostaje brakiem', () => {
    for (const tekst of BRAKI) expect(parseMpzpText(tekst)).toEqual({ wynik: 'brak' });
  });
});

describe('parseMpzpGml', () => {
  it('GISON: nazwa bez powtórzeń, numer i data uchwały, publiczny PDF', () => {
    const info = plan(parseMpzpGml(GISON_GML));
    expect(info.planName).toBe('obrębu Skawinki na terenie gminy Lanckorona');
    expect(info.resolution).toBe('Nr XXXI/148/2026 z 25 marca 2026');
    expect(info.resolutionUrl).toBe('https://rastry.gison.pl/mpzp-public/lanckorona/uchwaly/U_2026_148_XXXI.pdf');
    // Data uchwalenia to nie data wejścia w życie, a przeznaczenia GISON nie podaje.
    expect(info.effectiveFrom).toBeNull();
    expect(info.functionName).toBeNull();
    // Tytuł warstwy (gml:name) nie może udawać nazwy planu.
    expect(JSON.stringify(info)).not.toContain('Zasięgi');
  });

  it('dopisek o uchwale znika z nazwy także w skrócie „(uchwała n …)" (Skawina)', () => {
    const skawina = GISON_GML.replace(
      /<nazwapelnaplanu>[^<]*<\/nazwapelnaplanu>/,
      '<nazwapelnaplanu>Zmiana miejscowego planu zagospodarowania przestrzennego Gminy Skawina w jej granicach administracyjnych - etap I (uchwała n XVII/217/16)</nazwapelnaplanu>'
    );
    expect(plan(parseMpzpGml(skawina)).planName).toBe(
      'Zmiana miejscowego planu zagospodarowania przestrzennego Gminy Skawina w jej granicach administracyjnych - etap I'
    );
  });

  it('sam zasięg planu w poprawnym GML to plan bez szczegółów', () => {
    expect(parseMpzpGml(GISON_GML_ZASIEG)).toEqual({ wynik: 'bezAtrybutow' });
  });

  it('wyjątek albo „brak wyniku" zamiast dokumentu GML to „nie wiemy"', () => {
    expect(parseMpzpGml(KRAKOW_GML).wynik).toBe('nieczytelny');
    expect(parseMpzpGml('Czarny Dunajec: brak wyniku dla wskazanego obszaru').wynik).toBe('nieczytelny');
  });
});

describe('getMpzpAtPoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Kolejne odpowiedzi usługi; Error = zapytanie się nie udało (np. limit czasu).
  function odpowiedzi(...kolejne: (string | Error)[]) {
    const fetchMock = vi.fn(async (_url: string) => {
      const nastepna = kolejne.shift();
      if (nastepna instanceof Error) throw nastepna;
      return new Response(nastepna ?? '');
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const limitCzasu = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

  it('GISON: dociąga GML i zwraca nazwę, uchwałę i PDF', async () => {
    const fetchMock = odpowiedzi(GISON_TXT, GISON_GML);
    const info = await getMpzpAtPoint(49.81686, 19.71121, { rzucajBledy: true });
    expect(info?.planName).toBe('obrębu Skawinki na terenie gminy Lanckorona');
    expect(info?.resolutionUrl).toContain('U_2026_148_XXXI.pdf');
    expect(info?.detailsUnavailable).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('INFO_FORMAT=application%2Fvnd.ogc.gml');
  });

  it('gdy GML nie przyjdzie, zostaje plan bez szczegółów, a nie „brak planu"', async () => {
    odpowiedzi(GISON_TXT, limitCzasu());
    const info = await getMpzpAtPoint(49.81686, 19.71121, { rzucajBledy: true });
    expect(info).not.toBeNull();
    expect(info?.detailsUnavailable).toBe(true);
    expect(info?.planName).toBeNull();
    expect(ponowOdczytMpzp(info, MPZP_WERSJA)).toBe('pozniej');
  });

  it('GML z samym zasięgiem: plan bez szczegółów, bez ponawiania', async () => {
    odpowiedzi(GISON_TXT, GISON_GML_ZASIEG);
    const info = await getMpzpAtPoint(51.1779, 17.0385, { rzucajBledy: true });
    expect(info).not.toBeNull();
    expect(info?.detailsUnavailable).toBeUndefined();
    expect(ponowOdczytMpzp(info, MPZP_WERSJA)).toBeNull();
  });

  it('wyjątek serwera gminy: rzuca przy rzucajBledy, bez tego null', async () => {
    odpowiedzi(MUSZYNA_TXT);
    await expect(getMpzpAtPoint(49.35, 20.95, { rzucajBledy: true })).rejects.toThrow('wyjątek serwera gminy');
    odpowiedzi(MUSZYNA_TXT);
    await expect(getMpzpAtPoint(49.35, 20.95)).resolves.toBeNull();
  });

  it('brak planu: jedno zapytanie i null', async () => {
    const fetchMock = odpowiedzi('m. Kraków: brak wyniku dla wskazanego obszaru');
    await expect(getMpzpAtPoint(50.0167, 19.9667, { rzucajBledy: true })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('ponowOdczytMpzp', () => {
  const pelny: MpzpInfo = {
    planName: 'STARE MIASTO',
    functionName: 'Tereny placów miejskich',
    functionSymbol: 'KP.1',
    maxHeight: null,
    intensity: null,
    effectiveFrom: '2011-06-17',
    resolution: 'Nr XII/131/11 z 13 kwietnia 2011',
    status: null,
  };

  it('„brak planu" zapisany starszym odczytem sprawdzamy od razu, nowym już nie', () => {
    expect(ponowOdczytMpzp(null, undefined)).toBe('teraz');
    expect(ponowOdczytMpzp(null, MPZP_WERSJA)).toBeNull();
  });

  it('plan z danymi zostaje, plan bez szczegółów ponawiamy później', () => {
    expect(ponowOdczytMpzp(pelny, undefined)).toBeNull();
    expect(ponowOdczytMpzp({ ...pelny, planName: null, detailsUnavailable: true }, MPZP_WERSJA)).toBe('pozniej');
  });
});
