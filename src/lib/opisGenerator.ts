// Generator opisu ogłoszenia z pól, które sprzedający już wypełnił w kreatorze.
//
// Świadomie BEZ modelu językowego. Opis idzie pod nazwiskiem sprzedającego i jest
// traktowany jak informacja o konkretnej nieruchomości, więc nie może zawierać niczego,
// czego nie ma w formularzu. Model dopisałby „spokojna okolica" albo „świetna inwestycja",
// czyli zdania, za które odpowiada człowiek, a których nikt nie potwierdził.
//
// Druga zasada: zero odmiany nazw własnych. Polskie miejscownikowanie nazw miejscowości
// („w Bełchatowie", ale „w Suwałkach", „w Zakopanem") to pole minowe, więc lokalizacja
// leci jako etykieta po dwukropku, nigdy wewnątrz zdania.

export type OpisPrad =
  | 'BRAK_PRZYLACZA'
  | 'PRZYLACZE_NA_DZIALCE'
  | 'PRZYLACZE_W_DRODZE'
  | 'WARUNKI_PRZYLACZENIA_WYDANE'
  | 'MOZLIWOSC_PRZYLACZENIA';

export type OpisWoda =
  | 'BRAK_PRZYLACZA'
  | 'WODOCIAG_NA_DZIALCE'
  | 'WODOCIAG_W_DRODZE'
  | 'STUDNIA_GLEBINOWA'
  | 'MOZLIWOSC_PODLACZENIA';

export type OpisKanalizacja =
  | 'BRAK'
  | 'MIEJSKA_NA_DZIALCE'
  | 'MIEJSKA_W_DRODZE'
  | 'SZAMBO'
  | 'PRZYDOMOWA_OCZYSZCZALNIA'
  | 'MOZLIWOSC_PODLACZENIA';

export type OpisGaz = 'BRAK' | 'GAZ_NA_DZIALCE' | 'GAZ_W_DRODZE' | 'MOZLIWOSC_PODLACZENIA';

export type OpisSwiatlowod = 'BRAK' | 'W_DRODZE' | 'NA_DZIALCE' | 'MOZLIWOSC_PODLACZENIA';
type OpisDojazd =
  | 'ASFALT'
  | 'KOSTKA'
  | 'UTWARDZONA'
  | 'GRUNTOWA'
  | 'LESNA'
  | 'BRAK_DOJAZDU'
  | 'BRAK_INFORMACJI';

export type OpisInput = {
  transakcja?: 'SPRZEDAZ' | 'WYNAJEM';
  przeznaczenia?: string[];
  powierzchniaM2?: number | null;
  cenaPln?: number | null;
  locationLabel?: string | null;
  locationFull?: string | null;
  prad?: OpisPrad;
  woda?: OpisWoda;
  kanalizacja?: OpisKanalizacja;
  gaz?: OpisGaz;
  swiatlowod?: OpisSwiatlowod;
  dojazd?: OpisDojazd;
  wzWydane?: boolean;
  mpzp?: boolean;
  projektDomu?: boolean;
  klasaZiemi?: string | null;
  wymiary?: string | null;
  ksiegaWieczysta?: string | null;
};

const PRZEZNACZENIE_PRZYMIOTNIK: Record<string, string> = {
  INWESTYCYJNA: 'inwestycyjna',
  BUDOWLANA: 'budowlana',
  ROLNA: 'rolna',
  LESNA: 'leśna',
  REKREACYJNA: 'rekreacyjna',
  SIEDLISKOWA: 'siedliskowa',
};

function liczbaZeSpacjami(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// „a, b i c" — spójnik przed ostatnim elementem, bez przecinka przed „i".
function polaczI(czesci: string[]): string {
  if (czesci.length <= 1) return czesci[0] ?? '';
  return czesci.slice(0, -1).join(', ') + ' i ' + czesci[czesci.length - 1];
}

export function buildOpisZDanych(input: OpisInput): string {
  const akapity: string[] = [];

  // 1. Co to jest i gdzie leży.
  const zdaniaWstep: string[] = [];

  const przymiotniki = (input.przeznaczenia ?? [])
    .map((p) => PRZEZNACZENIE_PRZYMIOTNIK[p])
    .filter(Boolean);

  const powierzchnia =
    typeof input.powierzchniaM2 === 'number' && input.powierzchniaM2 > 0
      ? `${liczbaZeSpacjami(input.powierzchniaM2)} m²`
      : null;

  const czym = przymiotniki.length ? `Działka ${polaczI(przymiotniki)}` : 'Działka';
  zdaniaWstep.push(powierzchnia ? `${czym} o powierzchni ${powierzchnia}.` : `${czym}.`);

  // locationFull ma pełną ścieżkę administracyjną („miasto, gmina, powiat, województwo"),
  // locationLabel samą miejscowość. Bierzemy pełną, jeśli jest.
  const lokalizacja = (input.locationFull || input.locationLabel || '').trim();
  if (lokalizacja) zdaniaWstep.push(`Lokalizacja: ${lokalizacja}.`);

  if (input.wymiary?.trim()) zdaniaWstep.push(`Wymiary: ${input.wymiary.trim()}.`);

  akapity.push(zdaniaWstep.join(' '));

  // 2. Cena. Przy sprzedaży dokładamy przelicznik na metr, bo to pierwsza rzecz,
  // którą kupujący i tak liczy w głowie.
  if (typeof input.cenaPln === 'number' && input.cenaPln > 0) {
    const najem = input.transakcja === 'WYNAJEM';
    const etykieta = najem ? 'Cena najmu' : 'Cena';
    const zaMetr =
      !najem && typeof input.powierzchniaM2 === 'number' && input.powierzchniaM2 > 0
        ? ` (około ${liczbaZeSpacjami(input.cenaPln / input.powierzchniaM2)} zł/m²)`
        : '';

    akapity.push(`${etykieta}: ${liczbaZeSpacjami(input.cenaPln)} zł${zaMetr}.`);
  }

  // 3. Uzbrojenie — pogrupowane po stanie, nie po mediach, żeby kupujący od razu
  // widział, co jest gotowe, a co dopiero możliwe.
  const naDzialce: string[] = [];
  const wDrodze: string[] = [];
  const mozliwosc: string[] = [];
  const osobne: string[] = [];

  if (input.prad === 'PRZYLACZE_NA_DZIALCE') naDzialce.push('prąd');
  if (input.prad === 'PRZYLACZE_W_DRODZE') wDrodze.push('prąd');
  if (input.prad === 'MOZLIWOSC_PRZYLACZENIA') mozliwosc.push('prąd');
  if (input.prad === 'WARUNKI_PRZYLACZENIA_WYDANE') osobne.push('Dla prądu wydano warunki przyłączenia.');

  if (input.woda === 'WODOCIAG_NA_DZIALCE') naDzialce.push('woda');
  if (input.woda === 'WODOCIAG_W_DRODZE') wDrodze.push('woda');
  if (input.woda === 'MOZLIWOSC_PODLACZENIA') mozliwosc.push('woda');
  if (input.woda === 'STUDNIA_GLEBINOWA') osobne.push('Na działce jest studnia głębinowa.');

  if (input.kanalizacja === 'MIEJSKA_NA_DZIALCE') naDzialce.push('kanalizacja miejska');
  if (input.kanalizacja === 'MIEJSKA_W_DRODZE') wDrodze.push('kanalizacja miejska');
  if (input.kanalizacja === 'MOZLIWOSC_PODLACZENIA') mozliwosc.push('kanalizacja');
  if (input.kanalizacja === 'SZAMBO') osobne.push('Na działce jest szambo.');
  if (input.kanalizacja === 'PRZYDOMOWA_OCZYSZCZALNIA')
    osobne.push('Na działce jest przydomowa oczyszczalnia ścieków.');

  if (input.gaz === 'GAZ_NA_DZIALCE') naDzialce.push('gaz');
  if (input.gaz === 'GAZ_W_DRODZE') wDrodze.push('gaz');
  if (input.gaz === 'MOZLIWOSC_PODLACZENIA') mozliwosc.push('gaz');

  if (input.swiatlowod === 'NA_DZIALCE') naDzialce.push('światłowód');
  if (input.swiatlowod === 'W_DRODZE') wDrodze.push('światłowód');
  if (input.swiatlowod === 'MOZLIWOSC_PODLACZENIA') mozliwosc.push('światłowód');

  const zdaniaMedia: string[] = [];
  if (naDzialce.length) zdaniaMedia.push(`Na działce: ${naDzialce.join(', ')}.`);
  if (wDrodze.length) zdaniaMedia.push(`W drodze: ${wDrodze.join(', ')}.`);
  if (mozliwosc.length) zdaniaMedia.push(`Możliwość podłączenia: ${mozliwosc.join(', ')}.`);
  zdaniaMedia.push(...osobne);

  // Brak jakiejkolwiek informacji o mediach to też informacja, i to ważna dla kupującego.
  if (!zdaniaMedia.length) zdaniaMedia.push('Działka nieuzbrojona.');

  akapity.push(zdaniaMedia.join(' '));

  // 4. Plan, dokumenty, grunt.
  const zdaniaFormalne: string[] = [];
  // Dojazd zaraz na poczatku akapitu o cechach: kupujacy pyta o niego tuz po cenie i mediach,
  // a przy dzialkach rekreacyjnych bywa wazniejszy niz plan. BRAK_INFORMACJI pomijamy - lepiej
  // nie napisac nic, niz napisac "brak informacji o dojezdzie" w ogloszeniu.
  if (input.dojazd === 'ASFALT') zdaniaFormalne.push('Dojazd drogą asfaltową.');
  if (input.dojazd === 'KOSTKA') zdaniaFormalne.push('Dojazd drogą z kostki brukowej.');
  if (input.dojazd === 'UTWARDZONA') zdaniaFormalne.push('Dojazd drogą utwardzoną.');
  if (input.dojazd === 'GRUNTOWA') zdaniaFormalne.push('Dojazd drogą gruntową.');
  if (input.dojazd === 'LESNA') zdaniaFormalne.push('Dojazd drogą leśną.');
  if (input.dojazd === 'BRAK_DOJAZDU') zdaniaFormalne.push('Działka bez urządzonego dojazdu.');
  if (input.mpzp) zdaniaFormalne.push('Działka objęta miejscowym planem zagospodarowania przestrzennego.');
  if (input.wzWydane) zdaniaFormalne.push('Wydane warunki zabudowy.');
  if (input.projektDomu) zdaniaFormalne.push('Do działki dołączony jest projekt domu.');
  if (input.klasaZiemi?.trim()) zdaniaFormalne.push(`Klasa gruntu: ${input.klasaZiemi.trim()}.`);
  // Numer księgi zostaje w polu formularza — w opisie wystarczy sama informacja, że jest.
  if (input.ksiegaWieczysta?.trim()) zdaniaFormalne.push('Dla działki prowadzona jest księga wieczysta.');

  if (zdaniaFormalne.length) akapity.push(zdaniaFormalne.join(' '));

  return akapity.join('\n\n');
}
