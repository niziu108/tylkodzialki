import { describe, expect, it } from "vitest";
import {
  awaitingFirstFeedUpdate,
  integrationHealth,
  isAwaitingFirstFeed,
  isEmptyDirectoryAlarm,
  type IntegrationHealthInput,
} from "./integration-health";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 18, 12, 0, 0); // 2026-09-18 12:00 UTC

const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR);

/** Jedna z 7 integracji z 18.09.2026 (IMOX, katalog „/”): każdy przebieg kończył się błędem. */
const IMOX_BEFORE_FIX: IntegrationHealthInput & { lastErrorMessage: string | null } = {
  isActive: true,
  lastSuccessAt: null,
  lastErrorAt: at(2),
  lastErrorMessage: "Nie znaleziono żadnego pliku ZIP/XML w katalogu /.",
  lastErrorCount: 0,
  offerLinks: 0,
  processedFiles: 0,
};

/** Biuro z ofertami i świeżym udanym przebiegiem. */
const HEALTHY: IntegrationHealthInput = {
  isActive: true,
  lastSuccessAt: at(1),
  lastErrorAt: null,
  lastErrorCount: 0,
  offerLinks: 120,
  processedFiles: 300,
};

describe("isAwaitingFirstFeed", () => {
  it("integracja bez paczek, ofert i udanego przebiegu czeka na pierwszą paczkę", () => {
    expect(isAwaitingFirstFeed({ hasProcessedFile: false, hasOfferLink: false, lastSuccessAt: null })).toBe(true);
  });

  it("paczka przetworzona, nawet z błędem, to już historia: pusty katalog jest alarmem", () => {
    expect(isAwaitingFirstFeed({ hasProcessedFile: true, hasOfferLink: false, lastSuccessAt: null })).toBe(false);
  });

  it("oferta w bazie, także wygaszona, to historia", () => {
    expect(isAwaitingFirstFeed({ hasProcessedFile: false, hasOfferLink: true, lastSuccessAt: null })).toBe(false);
  });

  it("sam udany przebieg też jest śladem, np. po przepięciu integracji z innego silnika", () => {
    expect(isAwaitingFirstFeed({ hasProcessedFile: false, hasOfferLink: false, lastSuccessAt: at(24) })).toBe(false);
  });
});

describe("isEmptyDirectoryAlarm (ASARI, EstiCRM, LocumNet)", () => {
  it("biuro z ofertami opróżniło albo zmieniło katalog: błąd przebiegu", () => {
    expect(isEmptyDirectoryAlarm({ offerFilesInDirectory: 0, hasOfferLink: true })).toBe(true);
  });

  it("7 integracji z 18.09 bez ofert: data sukcesu z pustych przebiegów nie jest śladem, dalej czekają", () => {
    // 6x ASARI i 1x EstiCRM: każdy pusty przebieg ustawiał lastSuccessAt. W DOMY.PL to już byłby alarm.
    expect(isAwaitingFirstFeed({ hasProcessedFile: false, hasOfferLink: false, lastSuccessAt: at(2) })).toBe(false);
    expect(isEmptyDirectoryAlarm({ offerFilesInDirectory: 0, hasOfferLink: false })).toBe(false);
  });

  it("paczki bez żadnej działki to nie pusty katalog", () => {
    // ASARI /emaczestochowa 18.09: 5 par CFG + *_001.xml, najnowsza z 08.09, każdy przebieg 0 ofert.
    expect(isEmptyDirectoryAlarm({ offerFilesInDirectory: 5, hasOfferLink: true })).toBe(false);
  });

  it("EstiCRM: puste okno przebiegu przy paczkach w katalogu to nie pusty katalog", () => {
    // /dsilodz 18.09: 15 ZIP-ów, najnowszy z 15.09, okno sięga doby przed ostatnim sukcesem. Liczba
    // z okna (0) zapaliłaby Błąd u zdrowego biura, dlatego silnik podaje cały katalog.
    expect(isEmptyDirectoryAlarm({ offerFilesInDirectory: 15, hasOfferLink: true })).toBe(false);
  });
});

describe("integrationHealth", () => {
  it("7 integracji z 18.09 przed aktualizacją workera: Błąd", () => {
    expect(integrationHealth(IMOX_BEFORE_FIX, NOW)).toBe("ERROR");
  });

  it("przebieg czekający zdejmuje dawny błąd bez daty sukcesu: Czeka na 1. paczkę, nie Błąd i nie Nieświeże", () => {
    const update = awaitingFirstFeedUpdate(new Date(NOW));
    const after = { ...IMOX_BEFORE_FIX, ...update };

    expect(update).not.toHaveProperty("lastSuccessAt");
    expect(after.lastErrorMessage).toBeNull();
    expect(integrationHealth(after, NOW)).toBe("WAITING");

    // Kolejny pusty przebieg dalej czeka. Z datą sukcesu silnik uznałby go za alarm.
    expect(
      isAwaitingFirstFeed({ hasProcessedFile: false, hasOfferLink: false, lastSuccessAt: after.lastSuccessAt })
    ).toBe(true);

    // Tydzień bez paczki nie robi z czekania „Nieświeżego”.
    expect(integrationHealth(after, NOW + 7 * 24 * HOUR)).toBe("WAITING");
  });

  it("ASARI, EstiCRM i LocumNet z pustym katalogiem kończą sukcesem z datą: też czekają", () => {
    const asari = { ...HEALTHY, lastSuccessAt: at(1), offerLinks: 0, processedFiles: 0 };
    expect(integrationHealth(asari, NOW)).toBe("WAITING");
  });

  it("DOMY.PL z przetworzonymi paczkami bez żadnej działki: Brak danych", () => {
    const bezDzialek = { ...HEALTHY, offerLinks: 0, processedFiles: 4 };
    expect(integrationHealth(bezDzialek, NOW)).toBe("NO_DATA");
  });

  it("integracja z historią i pustym katalogiem: silnik rzuca, panel pokazuje Błąd", () => {
    const zgubionyKatalog = { ...HEALTHY, lastSuccessAt: at(26), lastErrorAt: at(1) };
    expect(integrationHealth(zgubionyKatalog, NOW)).toBe("ERROR");
  });

  it("Nieświeże dopiero po 48 h bez udanego przebiegu", () => {
    expect(integrationHealth({ ...HEALTHY, lastSuccessAt: at(47) }, NOW)).toBe("OK");
    expect(integrationHealth({ ...HEALTHY, lastSuccessAt: at(49) }, NOW)).toBe("STALE");
    expect(integrationHealth({ ...HEALTHY, lastSuccessAt: null }, NOW)).toBe("STALE");
  });

  it("błędy cząstkowe w udanym przebiegu to Błąd", () => {
    expect(integrationHealth({ ...HEALTHY, lastErrorAt: at(1), lastErrorCount: 3 }, NOW)).toBe("ERROR");
  });

  it("błąd starszy niż ostatni sukces już nie wisi", () => {
    expect(integrationHealth({ ...HEALTHY, lastErrorAt: at(5) }, NOW)).toBe("OK");
  });

  it("wyłączona integracja jest Wyłączona, nawet z błędem", () => {
    expect(integrationHealth({ ...IMOX_BEFORE_FIX, isActive: false }, NOW)).toBe("DISABLED");
  });
});
