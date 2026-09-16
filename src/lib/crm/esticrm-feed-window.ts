/**
 * Które paczki EstiCRM czytać i które wolno skasować z FTP. Czysta logika wydzielona z
 * esticrm-sync, żeby dało się ją testować bez FTP, bazy i R2.
 *
 * Jak EstiCRM wysyła dane (pomiar 16.09.2026, wszystkie 11 integracji): pełny eksport
 * (`<offers export="full">`) przychodzi RAZ, w pierwszej paczce po podłączeniu biura. Potem są już
 * tylko paczki przyrostowe, po kilka dziennie, a każda ma w sobie komplet zdjęć swoich ofert
 * (24 sprawdzone paczki z 4 biur, zero braków). Stara paczka nie jest więc potrzebna ani do danych,
 * bo są w bazie po przebiegu, który ją czytał, ani do zdjęć.
 *
 * Problem, który to naprawia: silnik szedł od najnowszej paczki wstecz aż do pełnego eksportu, czyli
 * w każdym przebiegu przez całą historię biura (em5: 433 paczki / 6 GB co 2 h, drugie biuro 538 paczek
 * / 6,5 GB). Sprzątanie FTP nie miało czego kasować, bo jedyny pełny eksport był najstarszym plikiem.
 * Jedna urwana paczka w tej historii (em5, 26.08.2026) wywracała każdy przebieg błędem FILE_ENDED
 * przez trzy tygodnie.
 *
 * Reguły:
 *  1. Okno przebiegu. Czytamy paczki nie starsze niż ostatni udany przebieg minus zakładka (24 h).
 *     Starsze przeczytał już któryś wcześniejszy udany przebieg. Kotwica (`lastSuccessAt`) leży w tej
 *     samej bazie co oferty, więc przywrócenie bazy z kopii cofa ją razem z danymi i okno samo sięga
 *     po brakujące paczki. Przestój workera działa tak samo: kotwica stoi, okno rośnie. Bez kotwicy
 *     (pierwszy przebieg biura), po pominięciu ofert z braku publikacji albo przy wyłączonym oknie
 *     zostaje dawne zachowanie.
 *  2. Nieczytelna paczka nie zatrzymuje biura. Pomijamy ją z wpisem ERROR i czytamy dalej, a przebieg
 *     z taką paczką nigdy nie liczy się jako pełny eksport, więc niczego nie wygasza.
 *  3. Sprzątanie zawsze od najstarszych, czyli na FTP zostaje ciągły ogon czasu bez dziur (dlaczego
 *     dziura szkodzi: patrz asari-full-export.ts). Pełny eksport sprzed okna idzie razem z resztą.
 */

import type { PrunePolicy } from "./feed-pruning";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type EstiRemoteZip = {
  remotePath: string;
  size: number | null;
  modifiedAt: Date | null;
};

export type EstiZipMode = "full" | "incremental" | "unknown";

/** Zakładka okna: ile godzin przed ostatnim udanym przebiegiem zaczynamy czytać. */
export const DEFAULT_ESTI_OVERLAP_HOURS = 24;

/** Paczka młodsza niż tyle mogła się jeszcze wgrywać w chwili listowania FTP. */
export const ESTI_UPLOAD_GRACE_MINUTES = 30;

/**
 * `CRM_ESTICRM_OVERLAP_HOURS`: brak = 24. Wartość nieliczbowa (np. `off`) albo ujemna wyłącza okno,
 * czyli przywraca dawne czytanie wstecz do pełnego eksportu. Wyłącznik awaryjny bez deployu.
 */
export function readEstiOverlapHours(env: Record<string, string | undefined> = process.env): number {
  const raw = env.CRM_ESTICRM_OVERLAP_HOURS?.trim();
  if (!raw) return DEFAULT_ESTI_OVERLAP_HOURS;
  return Number(raw);
}

/** Od najnowszej. Paczka bez daty na koniec, jak dotąd w silniku. Remis rozstrzyga nazwa. */
export function sortZipsNewestFirst<T extends EstiRemoteZip>(zips: T[]): T[] {
  return [...zips].sort(
    (a, b) =>
      (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0) ||
      b.remotePath.localeCompare(a.remotePath)
  );
}

export type EstiWalkWindow<T> = {
  /** Paczki, po których może przejść przebieg, od najnowszej. */
  candidates: T[];
  /** Ile paczek zostało za oknem. */
  olderThanWindow: number;
  /** Początek okna w ms. Null = okna nie ma, czytamy wstecz do pełnego eksportu. */
  anchorMs: number | null;
  /** Jedno zdanie do logu. */
  reason: string;
};

export function planEstiWalkWindow<T extends EstiRemoteZip>(
  zips: T[],
  params: {
    lastSuccessAt: Date | null;
    overlapHours: number;
    /** Ile ofert poprzedni przebieg pominął z braku publikacji (`lastSkippedCount`). */
    skippedLastRun: number;
  }
): EstiWalkWindow<T> {
  const { lastSuccessAt, overlapHours, skippedLastRun } = params;
  const sorted = sortZipsNewestFirst(zips);

  if (!lastSuccessAt) {
    return {
      candidates: sorted,
      olderThanWindow: 0,
      anchorMs: null,
      reason: "Brak udanego przebiegu, czytam wstecz do pełnego eksportu.",
    };
  }

  // Oferta pominięta z braku publikacji ma wejść po zakupie pakietu („Synchronizuj teraz" w panelu
  // biura), a jej paczka mogła już wypaść z okna. Dopóki są pominięcia, czytamy jak dawniej.
  if (skippedLastRun > 0) {
    return {
      candidates: sorted,
      olderThanWindow: 0,
      anchorMs: null,
      reason: `Poprzedni przebieg pominął ${skippedLastRun} ofert z braku publikacji, czytam wstecz do pełnego eksportu.`,
    };
  }

  if (!Number.isFinite(overlapHours) || overlapHours < 0) {
    return {
      candidates: sorted,
      olderThanWindow: 0,
      anchorMs: null,
      reason: "Okno wyłączone (CRM_ESTICRM_OVERLAP_HOURS), czytam wstecz do pełnego eksportu.",
    };
  }

  const anchorMs = lastSuccessAt.getTime() - overlapHours * HOUR_MS;
  // Paczki bez daty nie da się uznać za przeczytaną, więc zostaje w oknie.
  const candidates = sorted.filter((zip) => !zip.modifiedAt || zip.modifiedAt.getTime() >= anchorMs);

  return {
    candidates,
    olderThanWindow: sorted.length - candidates.length,
    anchorMs,
    reason: `Czytam paczki od ${new Date(anchorMs).toISOString()} (ostatni udany przebieg minus ${overlapHours} h).`,
  };
}

/**
 * Czy po przeczytaniu tej paczki iść dalej wstecz.
 *
 * Pełny eksport kończy wybór: starsze paczki opisują stan, który on zastąpił. Tryb nieznany (brak
 * atrybutu `export`) bez okna też kończy, żeby nie wciągać całej historii. W oknie idziemy dalej, bo
 * zakres i tak jest ograniczony, a zatrzymanie zostawiłoby dziurę: starsze paczki z okna wypadłyby
 * z kolejnych okien nieprzeczytane.
 */
export function shouldWalkPastZip(mode: EstiZipMode, windowAnchored: boolean): boolean {
  if (mode === "full") return false;
  if (mode === "incremental") return true;
  return windowAnchored;
}

/** Czy wartość atrybutu `<offers export="...">` oznacza pełny eksport. */
export function isFullEstiExportMode(mode: string | null | undefined): boolean {
  const text = (mode ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
  return /full|complete|calosc/.test(text);
}

/**
 * Czy przebieg wolno potraktować jak pełny eksport, czyli wygasić oferty nieobecne w plikach.
 *
 * Tryb bierzemy z najnowszego przeczytanego pliku, jak dotąd. Nieczytelna paczka w przebiegu blokuje
 * wygaszanie bez wyjątków: nie wiemy, co w niej było, a mogła być nowszym pełnym eksportem albo
 * zawierać oferty, których nie ma w starszym pliku.
 */
export function isEstiRunFullExport(exportMode: string | null, unreadableZipCount: number): boolean {
  if (unreadableZipCount > 0) return false;
  return isFullEstiExportMode(exportMode);
}

/**
 * Błąd środowiska (brak miejsca, uprawnienia, limit deskryptorów), a nie wada samej paczki.
 *
 * Błędy systemowe Node mają pole `syscall`. Urwany ZIP daje w unzipperze `FILE_ENDED` bez `syscall`,
 * także przy cięciu dokładnie na granicy wpisów (sprawdzone), a zepsute dane deflate dają błąd zlib
 * z kodem `Z_*`, też bez `syscall`. Awaria środowiska ma wywrócić przebieg jak dotąd: kotwica okna
 * wtedy stoi i następny przebieg przeczyta te same paczki. Gdyby traktować ją jak uszkodzoną paczkę,
 * przebieg przy pełnym dysku przesunąłby kotwicę i paczki wypadłyby z okna nieprzeczytane.
 */
export function isEnvironmentError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { syscall?: unknown }).syscall === "string"
  );
}

/** Nieczytelna i świeża paczka to najpewniej wgrywanie w toku: bez wpisu ERROR, weźmie ją kolejny przebieg. */
export function isPossiblyStillUploading(zip: EstiRemoteZip, nowMs: number): boolean {
  if (!zip.modifiedAt) return false;
  return nowMs - zip.modifiedAt.getTime() < ESTI_UPLOAD_GRACE_MINUTES * MINUTE_MS;
}

/**
 * `CRM_ESTICRM_PRUNE`: `1` = sprzątanie za oknem u wszystkich biur EstiCRM, lista identyfikatorów
 * integracji po przecinku = tylko te biura (kanarek). Brak = silnik tylko pokazuje w logu, co by
 * skasował. Osobny włącznik od CRM_FEED_PRUNE_WITHOUT_FULL, bo ta reguła kasuje też jedyny pełny
 * eksport biura, a kasowania z FTP nie da się cofnąć.
 */
export function isEstiWindowPruneEnabled(integrationId: string, raw: string | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return false;
  if (value === "1") return true;
  return value
    .split(",")
    .map((part) => part.trim())
    .includes(integrationId);
}

/** Nieprawidłowa liczba = chronimy wszystko (a nie: kasujemy wszystko). */
function safeKeepMin(value: number, total: number) {
  if (!Number.isFinite(value)) return total;
  return Math.max(0, value);
}

export type EstiPrunePlan<T> = {
  /** Do skasowania przy bieżących ustawieniach, od najstarszej. */
  prunable: T[];
  /** Co dodatkowo skasowałaby wyłączona reguła okna. Tylko do logu. */
  previewWhenDisabled: T[];
};

/**
 * Paczki ZIP, które wolno skasować z FTP biura EstiCRM. Dwie reguły, obie tną od najstarszych:
 *
 *  - Pełny eksport (ta sama reguła co wcześniej w silniku): paczki starsze od najnowszego pełnego
 *    eksportu przeczytanego w tym przebiegu, starsze niż `retentionDays` (14), spoza `keepMinFiles`
 *    (10) najświeższych. Działa tylko, gdy pełny eksport trafi do okna, więc u dzisiejszych biur
 *    (jeden pełny eksport, na starcie) praktycznie nigdy.
 *  - Okno (włącznik CRM_ESTICRM_PRUNE): paczki starsze od początku okna tego przebiegu, czyli
 *    przeczytane przez wcześniejszy udany przebieg, a do tego starsze niż `retentionDaysWithoutFull`
 *    (30) i spoza `keepMinFilesWithoutFull` (20) najświeższych. Margines 30 dni zostawia zapas na
 *    przywrócenie bazy z kopii i ponowny import.
 */
export function planEstiZipPrune<T extends EstiRemoteZip>(
  zips: T[],
  params: {
    /** Data najnowszego pełnego eksportu przeczytanego w tym przebiegu, 0 = brak. */
    newestFullMs: number;
    /** Początek okna tego przebiegu, null = okna nie ma (reguła okna nic nie kasuje). */
    anchorMs: number | null;
    windowRuleEnabled: boolean;
    policy: PrunePolicy;
    nowMs: number;
  }
): EstiPrunePlan<T> {
  const { newestFullMs, anchorMs, windowRuleEnabled, policy, nowMs } = params;
  const newestFirst = sortZipsNewestFirst(zips);

  const byFullRule = new Set<T>();
  if (newestFullMs > 0 && Number.isFinite(policy.retentionDays) && policy.retentionDays >= 0) {
    const keepMin = safeKeepMin(policy.keepMinFiles, newestFirst.length);
    const cutoffMs = Math.min(newestFullMs, nowMs - policy.retentionDays * DAY_MS);

    newestFirst.forEach((zip, index) => {
      if (index < keepMin || !zip.modifiedAt) return;
      if (zip.modifiedAt.getTime() < cutoffMs) byFullRule.add(zip);
    });
  }

  const byWindowRule = new Set<T>();
  if (
    anchorMs !== null &&
    Number.isFinite(policy.retentionDaysWithoutFull) &&
    policy.retentionDaysWithoutFull >= 0
  ) {
    const keepMin = safeKeepMin(policy.keepMinFilesWithoutFull, newestFirst.length);
    const cutoffMs = Math.min(anchorMs, nowMs - policy.retentionDaysWithoutFull * DAY_MS);

    newestFirst.forEach((zip, index) => {
      if (index < keepMin || !zip.modifiedAt) return;
      if (zip.modifiedAt.getTime() < cutoffMs) byWindowRule.add(zip);
    });
  }

  const oldestFirst = [...newestFirst].reverse();

  return {
    prunable: oldestFirst.filter((zip) => byFullRule.has(zip) || (windowRuleEnabled && byWindowRule.has(zip))),
    previewWhenDisabled: windowRuleEnabled
      ? []
      : oldestFirst.filter((zip) => byWindowRule.has(zip) && !byFullRule.has(zip)),
  };
}
