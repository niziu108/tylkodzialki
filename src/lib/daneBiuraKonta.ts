/* Dane biura na KONCIE (User.default*) kontra dane w jednym ogłoszeniu.
 *
 * Logo i nazwa z konta to marka biura w całym serwisie: bierze je stąd każda oferta bez własnego
 * logo (import CRM nie zapisuje `biuroLogoUrl`, więc 7271 z 7275 aktywnych ofert CRM pokazuje logo
 * konta), pas logotypów i licznik biur na /dla-biur, wizytówka partnera i statystyki biur.
 * Ustawia je admin: 118 ze 128 logotypów, zwykle przy podłączaniu CRM (stan 2026-09-18).
 *
 * Formularz ogłoszenia opisuje JEDNĄ ofertę, a ostatnio wpisane dane pamięta w localStorage
 * przeglądarki. Do 2026-09-18 jego zapis nadpisywał dane konta tym, co miał w polach, razem
 * z pustką: ogłoszenie dodane na innej przeglądarce albo edycja ręcznej oferty (strona edycji
 * nie wczytywała tych pól) kasowały logo biura z konta, czyli ze wszystkich jego ofert,
 * ze ściany logotypów i z wizytówki.
 *
 * Reguła jest więc jedna, bez wyjątków per typ konta: formularz tylko UZUPEŁNIA to, czego na
 * koncie nie ma, i nigdy nie kasuje ani nie nadpisuje. Zostaje jedyny pożytek z tego zapisu,
 * czyli biuro bez logo od admina dostaje je raz, wgrywając je przy ogłoszeniu. To, co na koncie
 * już jest, zmienia wyłącznie admin.
 *
 * Czysty moduł bez bazy, żeby dało się go testować ([[project-testy]]). */

type DaneBiuraKonta = {
  defaultBiuroNazwa: string | null;
  defaultBiuroOpiekun: string | null;
  defaultBiuroLogoUrl: string | null;
};

type DaneBiuraZFormularza = {
  biuroNazwa: string | null;
  biuroOpiekun: string | null;
  biuroLogoUrl: string | null;
};

/**
 * Pola do dopisania w `User` przy zapisie ogłoszenia: same braki, nigdy nadpisanie.
 * Pusty obiekt = konto zostaje bez zmian.
 */
export function uzupelnienieDanychBiura(
  konto: DaneBiuraKonta,
  sprzedajacyTyp: 'BIURO' | 'PRYWATNIE',
  zFormularza: DaneBiuraZFormularza
): Partial<DaneBiuraKonta> {
  // Ogłoszenie prywatne nie mówi nic o biurze. Wcześniej to właśnie ono czyściło konto na null,
  // np. gdy pośrednik wystawił jedną działkę prywatnie.
  if (sprzedajacyTyp !== 'BIURO') return {};

  const uzupelnienie: Partial<DaneBiuraKonta> = {};

  if (!konto.defaultBiuroNazwa && zFormularza.biuroNazwa) {
    uzupelnienie.defaultBiuroNazwa = zFormularza.biuroNazwa;
  }

  if (!konto.defaultBiuroOpiekun && zFormularza.biuroOpiekun) {
    uzupelnienie.defaultBiuroOpiekun = zFormularza.biuroOpiekun;
  }

  if (!konto.defaultBiuroLogoUrl && zFormularza.biuroLogoUrl) {
    uzupelnienie.defaultBiuroLogoUrl = zFormularza.biuroLogoUrl;
  }

  return uzupelnienie;
}
