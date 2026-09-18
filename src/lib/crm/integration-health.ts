/**
 * Pusty katalog FTP i status integracji w /admin/crm. Czysta logika, testowana bez bazy i FTP.
 *
 * Biuro dostaje od nas katalog na FTP, zanim włączy eksport w swoim CRM, więc do pierwszej paczki
 * katalog jest pusty. To oczekiwanie, a nie awaria. Silnik DOMY.PL rzucał wtedy błędem w każdym
 * przebiegu: 7 integracji (5x IMOX, 2x Galactica, założone 8.05-28.07.2026) dawało 84 joby ERROR na
 * dobę, a worker po każdym błędzie odczekuje 60 s, czyli 7 z ok. 22 minut każdej serii (18.09.2026).
 *
 * Pusty katalog u integracji, która już coś importowała, zostaje błędem: biuro zmieniło katalog albo
 * wyłączyło eksport, a my po cichu tracimy podaż (Arkadia Włocławek, katalog ze spacją na końcu,
 * 3 miesiące bez importu).
 */

const HOUR_MS = 60 * 60 * 1000;

/** Ślad importu integracji. Wystarczy jeden z trzech, żeby pusty katalog był alarmem. */
export type ImportTrace = {
  /** Choć jeden CrmProcessedFile, w dowolnym statusie (także ERROR: paczka była i zniknęła). */
  hasProcessedFile: boolean;
  /** Choć jeden CrmOfferLink, także wygaszony. */
  hasOfferLink: boolean;
  lastSuccessAt: Date | null;
};

/** Integracja jeszcze niczego nie zaimportowała, więc pusty katalog znaczy: czeka na pierwszą paczkę. */
export function isAwaitingFirstFeed(trace: ImportTrace): boolean {
  return !trace.hasProcessedFile && !trace.hasOfferLink && trace.lastSuccessAt === null;
}

/**
 * Pola CrmIntegration po przebiegu, który czeka na pierwszą paczkę. Zdejmuje błąd zostawiony przez
 * dawne przebiegi, ale NIE ustawia lastSuccessAt: pusty lastSuccessAt jest częścią śladu
 * (isAwaitingFirstFeed), więc z datą sukcesu następny pusty przebieg byłby już alarmem.
 */
export function awaitingFirstFeedUpdate(now: Date) {
  return {
    lastUsedAt: now,
    lastSyncAt: now,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastErrorCount: 0,
  };
}

export type IntegrationHealth = "ERROR" | "NO_DATA" | "STALE" | "WAITING" | "OK" | "DISABLED";

/**
 * Tyle godzin bez udanego przebiegu i integracja z ofertami jest „Nieświeża”. Auto-sync leci co 2 h,
 * zapas jest świadomy: EstiCRM nie przesuwa lastSuccessAt przy ofertach pominiętych z braku
 * publikacji (esticrm-feed-window.ts) i właśnie po tym progu ma to wyjść w panelu.
 */
export const STALE_THRESHOLD_HOURS = 48;

export type IntegrationHealthInput = {
  isActive: boolean;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCount: number;
  /** CrmOfferLink integracji, także wygaszone. */
  offerLinks: number;
  /** CrmProcessedFile integracji w dowolnym statusie. Prowadzi je tylko silnik DOMY.PL. */
  processedFiles: number;
};

export function integrationHealth(it: IntegrationHealthInput, nowMs: number): IntegrationHealth {
  if (!it.isActive) return "DISABLED";

  // Cały ostatni przebieg padł: silnik ustawił lastErrorAt nowszy od sukcesu (albo sukcesu nie było
  // wcale). Błędy cząstkowe -> lastErrorCount > 0.
  const runFailed =
    it.lastErrorAt !== null &&
    (it.lastSuccessAt === null || it.lastErrorAt.getTime() > it.lastSuccessAt.getTime());

  if (it.lastErrorCount > 0 || runFailed) return "ERROR";

  // Ani jednej oferty. Bez żadnej przetworzonej paczki biuro czeka na pierwszą. Tu bez lastSuccessAt,
  // inaczej niż w isAwaitingFirstFeed: ASARI, EstiCRM i LocumNet kończą przebieg z pustym katalogiem
  // sukcesem i ustawiają lastSuccessAt, a CrmProcessedFile prowadzi tylko DOMY.PL. U nich do tego
  // stanu trafia też rzadki eksport bez żadnej działki. Paczki przetworzone, a działek brak, to inna
  // rozmowa z biurem niż „włączcie eksport”, stąd osobny stan.
  if (it.offerLinks === 0) return it.processedFiles === 0 ? "WAITING" : "NO_DATA";

  const fresh =
    it.lastSuccessAt !== null && nowMs - it.lastSuccessAt.getTime() <= STALE_THRESHOLD_HOURS * HOUR_MS;

  return fresh ? "OK" : "STALE";
}
