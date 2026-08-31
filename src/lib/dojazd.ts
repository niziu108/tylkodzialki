// Jedno źródło prawdy o dojeździe do działki: normalizacja tego, co przysyłają CRM-y, etykiety
// dla UI i definicja „dojazdu twardego" dla filtra.
//
// Po co normalizacja: w feedach to samo znaczy „asfaltowa", „asfalt", „ASFALTOWA",
// „asfaltowa/betonowa", a obok tego lecą wartości, które o nawierzchni nie mówią nic
// („cicha ulica", „lokalna droga", „główna droga"). Filtr z piętnastoma wariantami jest
// bezużyteczny, więc sprowadzamy wszystko do czterech stanów plus „nie wiadomo".
//
// Zasada jak przy mediach: filtrujemy TWARDO. Oferta bez potwierdzonej nawierzchni nigdy nie
// wpada do wyników „dojazd utwardzony". Lepiej pokazać mniej, niż obiecać asfalt, którego nie ma.
//
// `import type` (nie wartości), bo etykiety trafiają na karty ofert, czyli do bundla klienta.

import type { DojazdStatus } from '@prisma/client';

// Rodzaj męski, bo mówimy „dojazd asfaltowy", nie „dojazd asfaltowa".
export const DOJAZD_LABEL = {
  ASFALT: 'Asfaltowy',
  KOSTKA: 'Kostka',
  UTWARDZONA: 'Utwardzony',
  GRUNTOWA: 'Gruntowy',
  LESNA: 'Leśny',
  BRAK_DOJAZDU: 'Brak dojazdu',
  BRAK_INFORMACJI: 'Brak informacji',
} as const satisfies Record<DojazdStatus, string>;

// Krótsze warianty na karty ofert, gdzie liczy się każdy znak.
export const DOJAZD_LABEL_KROTKI = {
  ASFALT: 'asfalt',
  KOSTKA: 'kostka',
  UTWARDZONA: 'utwardzona',
  GRUNTOWA: 'gruntowa',
  LESNA: 'leśna',
  BRAK_DOJAZDU: 'brak dojazdu',
  BRAK_INFORMACJI: 'brak informacji',
} as const satisfies Record<DojazdStatus, string>;

// Co uznajemy za „da się dojechać autem osobowym o każdej porze roku". Świadomie bez GRUNTOWEJ:
// droga polna po deszczu to dla kupującego zupełnie inna nieruchomość.
export const DOJAZD_TWARDY = ['ASFALT', 'KOSTKA', 'UTWARDZONA'] as const satisfies readonly DojazdStatus[];

// Opcje do wyboru — te same w formularzu i w filtrze.
// BRAK_INFORMACJI poza listą, bo pole jest nieobowiązkowe: brak zaznaczenia mówi to samo.
// BRAK_DOJAZDU też poza listą: prawie każda działka jakiś dojazd ma, nikt takiej nie szuka
// i nikt się nią nie chwali. Wartość zostaje w enumie, bo przychodzi z feedów CRM i wtedy
// pokazujemy ją w ofercie jako ostrzeżenie dla kupującego.
export const DOJAZD_FILTR_KEYS = ['ASFALT', 'KOSTKA', 'UTWARDZONA', 'GRUNTOWA', 'LESNA'] as const;
export type DojazdKey = (typeof DOJAZD_FILTR_KEYS)[number];

// Ta sama lista pod nazwą mówiącą o formularzu — żeby wywołania czytały się jednoznacznie.
export const DOJAZD_FORM_KEYS = DOJAZD_FILTR_KEYS;

/**
 * Czy pokazywać filtr dojazdu w /kup.
 *
 * Wyłączony ŚWIADOMIE: przy 7,2 tys. ofert i 63% pokryciu kliknięcie „asfaltowy" zawęża wynik
 * do jednej trzeciej podaży, a wśród ukrytych są działki, które asfalt mają, tylko biuro tego
 * nie wpisało. Przy tej wielkości bazy zawężanie boli bardziej, niż pomaga.
 *
 * Cała reszta (odczyt z feedów, zapis, wyświetlanie w ofercie, obsługa parametru w URL) działa
 * dalej i zbiera dane. Włączenie to zmiana tej jednej flagi na `true`, gdy podaż urośnie.
 */
export const DOJAZD_FILTR_WIDOCZNY = false;

export function maTwardyDojazd(v: unknown): boolean {
  return typeof v === 'string' && (DOJAZD_TWARDY as readonly string[]).includes(v);
}

// Lokalna kopia normalizacji zamiast importu z dzialkiSearch: ten moduł trafia do bundla klienta
// (etykiety na kartach ofert), więc nie wciągamy tu modułu wyszukiwarki.
function normalizuj(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// UWAGA na kolejność: „nieutwardzona" zawiera w sobie „utwardzona", a „bez dojazdu" zawiera
// „dojazd". Dlatego zaprzeczenia sprawdzamy ZAWSZE przed formami twierdzącymi. Ta sama pułapka
// co przy województwach („wielkopolskie" zawiera „opolskie").
const ZAPRZECZENIA = ['nieutwardzon', 'nie utwardzon', 'brak dojazd', 'bez dojazdu', 'bez drogi', 'brak drogi'];
const ASFALT = ['asfalt', 'beton'];
// Kostka osobno, bo to inna nawierzchnia i inna cena: kupujacy widzi dokladnie to, co jest.
const KOSTKA = ['kostka', 'bruk', 'brukowa'];
const UTWARDZONA = ['utwardzon', 'szuter', 'szutrow', 'tluczen', 'zwir', 'zwirow', 'klinkiet', 'plyty betonowe'];
const GRUNTOWA = ['gruntow', 'polna', 'ziemna', 'piaszczyst', 'nieutwardzon', 'nie utwardzon', 'grunt'];
// Osobna kategoria, nie odmiana gruntowej: dla działki rekreacyjnej pod lasem to zaleta,
// a nie brak. W bazie 20 ofert, wcześniej chowały się w gruntowej.
const LESNA = ['lesna', 'lesny', 'przez las'];
const BRAK = ['brak dojazd', 'bez dojazdu', 'brak drogi', 'bez drogi', 'brak'];

function zawiera(text: string, klucze: readonly string[]): boolean {
  return klucze.some((k) => text.includes(k));
}

/**
 * Zamienia surową wartość z feedu na jeden z pięciu stanów.
 *
 * Wartości opisujące charakter drogi, a nie nawierzchnię („cicha ulica", „lokalna droga",
 * „główna droga", „inna"), świadomie dają BRAK_INFORMACJI. „Główna droga" bywa asfaltem, ale
 * bywa też szutrem, a filtr twardy nie może opierać się na domyśle.
 */
export function mapDojazd(raw: unknown): DojazdStatus {
  if (typeof raw !== 'string') return 'BRAK_INFORMACJI';
  const t = normalizuj(raw);
  if (!t) return 'BRAK_INFORMACJI';

  // 1. Zaprzeczenia najpierw, inaczej „nieutwardzona" wpadłaby do UTWARDZONA.
  if (zawiera(t, ['nieutwardzon', 'nie utwardzon'])) return 'GRUNTOWA';
  if (zawiera(t, ['brak dojazd', 'bez dojazdu', 'brak drogi', 'bez drogi'])) return 'BRAK_DOJAZDU';

  // 2. Wartości łączone („CICHA ULICA,ASFALTOWA,LOKALNA DROGA") rozstrzygamy od najlepszej
  //    nawierzchni: skoro biuro wpisało gdzieś asfalt, to asfalt tam jest.
  if (zawiera(t, ASFALT)) return 'ASFALT';
  if (zawiera(t, KOSTKA)) return 'KOSTKA';
  if (zawiera(t, UTWARDZONA)) return 'UTWARDZONA';
  if (zawiera(t, LESNA)) return 'LESNA';
  if (zawiera(t, GRUNTOWA)) return 'GRUNTOWA';

  // 3. Samo „brak" bez rzeczownika (część feedów tak oznacza brak dojazdu).
  if (t === 'brak' || zawiera(t, ['brak'])) return 'BRAK_DOJAZDU';

  return 'BRAK_INFORMACJI';
}

// Nieużywane wprost, ale trzyma listę kluczy blisko mapowania — gdy dojdzie nowy feed z inną
// terminologią, widać od razu, gdzie dopisać.
export const DOJAZD_SLOWNIK = { ZAPRZECZENIA, ASFALT, KOSTKA, UTWARDZONA, GRUNTOWA, LESNA, BRAK } as const;
