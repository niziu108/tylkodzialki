// Czysta logika auto-czyszczenia drop-zone FTP (silnik DOMY.PL). Wydzielona z domypl-sync, żeby:
//   1) dało się ją przetestować bez FTP i bazy,
//   2) raport „co by się skasowało" (scripts/crm-ftp-prune-report.ts) liczył DOKŁADNIE to samo,
//      co silnik faktycznie skasuje — bez drugiej, rozjeżdżającej się implementacji.
//
// Kasowanie plików z FTP jest nieodwracalne, więc każdy warunek działa na zasadzie „w razie
// wątpliwości nie ruszamy".

export type RemoteFeedFile = {
  remoteFileName: string;
  size: number | null;
  modifiedAt: Date | null;
};

export type ProcessedFeedRecord = {
  remoteFileName: string;
  fileSize: bigint | number | null;
  fileModifiedAt: Date | null;
  isFullExport: boolean;
};

export type PrunePolicy = {
  /** Margines wieku dla biur z rozpoznanym pełnym eksportem. */
  retentionDays: number;
  /** Ile najświeższych plików zostaje niezależnie od reguł. */
  keepMinFiles: number;
  /** Czy wolno sprzątać u biur, które nigdy nie przysłały pełnego eksportu. */
  allowWithoutFullExport: boolean;
  /** Margines wieku dla biur bez pełnego eksportu (celowo dłuższy). */
  retentionDaysWithoutFull: number;
  /** Bufor najświeższych plików dla biur bez pełnego eksportu (celowo większy). */
  keepMinFilesWithoutFull: number;
};

export type PruneMode = "full-anchor" | "no-full-export" | "disabled";

export type PrunePlan = {
  mode: PruneMode;
  /** Jednozdaniowe wyjaśnienie decyzji — trafia do logu i do raportu. */
  reason: string;
  latestFullModifiedMs: number;
  /** Pliki do skasowania z FTP. Kolejność: od najstarszego. */
  prunable: RemoteFeedFile[];
  /** Największa paczka biura, chroniona jako możliwy nieoznaczony pełny eksport. */
  protectedLargestFileName: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function readPrunePolicyFromEnv(env: Record<string, string | undefined> = process.env): PrunePolicy {
  return {
    retentionDays: Number(env.CRM_FEED_RETENTION_DAYS ?? "14"),
    keepMinFiles: Number(env.CRM_FEED_KEEP_MIN ?? "10"),
    // Domyślnie WYŁĄCZONE. Włączenie to świadoma decyzja (zmienna na VPS, bez deployu), podjęta
    // po obejrzeniu raportu `npm run crm:prune:report`.
    allowWithoutFullExport: env.CRM_FEED_PRUNE_WITHOUT_FULL === "1",
    retentionDaysWithoutFull: Number(env.CRM_FEED_RETENTION_DAYS_NO_FULL ?? "30"),
    keepMinFilesWithoutFull: Number(env.CRM_FEED_KEEP_MIN_NO_FULL ?? "20"),
  };
}

function processedKeyOf(remoteFileName: string, size: bigint | number | null, modifiedAtMs: number | null) {
  return [remoteFileName, size === null || size === undefined ? "" : String(size), modifiedAtMs ?? ""].join("|");
}

/** Nieprawidłowa liczba = chronimy wszystko (a nie: kasujemy wszystko). */
function safeKeepMin(value: number, total: number) {
  if (!Number.isFinite(value)) return total;
  return Math.max(0, value);
}

/**
 * Wyznacza pliki, które wolno skasować z drop-zone FTP biura.
 *
 * Tryb `full-anchor` (biuro ma rozpoznany pełny eksport) — reguła sprzed tej zmiany, bez modyfikacji:
 * zawsze zostaje najświeższy pełny eksport i wszystko po nim; kasujemy tylko starsze paczki, które są
 * dokładnie dopasowane do rekordu SUCCESS, starsze niż margines i spoza bufora najświeższych.
 *
 * Tryb `no-full-export` (biuro nigdy nie przysłało pełnego eksportu — u nas głównie Galactica) — nowa
 * reguła. Nie ma snapshotu odniesienia, więc odtworzenie biura z samego FTP i tak jest niemożliwe
 * (od tego są backupy bazy). Zamiast trzymać wszystko w nieskończoność, kasujemy paczki, które
 * JEDNOCZEŚNIE:
 *   1) są dokładnie dopasowane (nazwa|rozmiar|data) do rekordu SUCCESS — w pełni wchłonięte do bazy,
 *   2) są starsze niż `retentionDaysWithoutFull` (domyślnie 30 dni, dwa razy dłużej niż standardowo),
 *   3) nie należą do `keepMinFilesWithoutFull` najświeższych (domyślnie 20),
 *   4) nie są największą paczką biura — największa to najpoważniejszy kandydat na pełny eksport,
 *      którego jeszcze nie oznaczyliśmy (rekordy sprzed wdrożenia pola `isFullExport`).
 */
export function planFeedPrune(
  remoteFeeds: RemoteFeedFile[],
  processedFiles: ProcessedFeedRecord[],
  policy: PrunePolicy,
  nowMs: number
): PrunePlan {
  const empty = (mode: PruneMode, reason: string, latestFullModifiedMs = 0): PrunePlan => ({
    mode,
    reason,
    latestFullModifiedMs,
    prunable: [],
    protectedLargestFileName: null,
  });

  const processedKeys = new Set(
    processedFiles.map((file) =>
      processedKeyOf(file.remoteFileName, file.fileSize, file.fileModifiedAt ? file.fileModifiedAt.getTime() : null)
    )
  );

  const latestFullModifiedMs = processedFiles.reduce<number>((acc, file) => {
    if (!file.isFullExport || !file.fileModifiedAt) return acc;
    return Math.max(acc, file.fileModifiedAt.getTime());
  }, 0);

  // Od najstarszego — bufor „najświeższych" liczymy od końca.
  const sorted = [...remoteFeeds].sort((a, b) => {
    const aTime = a.modifiedAt?.getTime() ?? 0;
    const bTime = b.modifiedAt?.getTime() ?? 0;
    return aTime - bTime || a.remoteFileName.localeCompare(b.remoteFileName);
  });

  const hasFullAnchor = latestFullModifiedMs > 0;

  if (!hasFullAnchor && !policy.allowWithoutFullExport) {
    return empty(
      "disabled",
      "Biuro nie ma rozpoznanego pełnego eksportu, a sprzątanie bez niego jest wyłączone (CRM_FEED_PRUNE_WITHOUT_FULL)."
    );
  }

  const retentionDays = hasFullAnchor ? policy.retentionDays : policy.retentionDaysWithoutFull;

  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    return empty("disabled", `Nieprawidłowy margines wieku (${retentionDays}) — nie kasuję nic.`, latestFullModifiedMs);
  }

  const keepMin = safeKeepMin(
    hasFullAnchor ? policy.keepMinFiles : policy.keepMinFilesWithoutFull,
    sorted.length
  );

  const ageCutoffMs = nowMs - retentionDays * DAY_MS;

  const protectedNewest = new Set(
    sorted.slice(Math.max(0, sorted.length - keepMin)).map((file) => file.remoteFileName)
  );

  // Największa paczka biura. W trybie bez pełnego eksportu to jedyny sensowny kandydat na
  // nieoznaczony pełny snapshot, więc zostaje nietknięta.
  const largest = sorted.reduce<RemoteFeedFile | null>((acc, file) => {
    if (file.size === null) return acc;
    if (!acc || acc.size === null || file.size > acc.size) return file;
    return acc;
  }, null);

  const protectedLargestFileName = hasFullAnchor ? null : largest?.remoteFileName ?? null;

  const prunable = sorted.filter((file) => {
    if (!file.modifiedAt) return false; // brak daty = nie ryzykujemy
    if (protectedNewest.has(file.remoteFileName)) return false; // twardy bufor najświeższych
    if (protectedLargestFileName === file.remoteFileName) return false; // możliwy nieoznaczony pełny eksport
    if (hasFullAnchor && file.modifiedAt.getTime() >= latestFullModifiedMs) return false; // pełny lub coś po nim
    if (file.modifiedAt.getTime() >= ageCutoffMs) return false; // margines czasowy

    // Tylko pliki potwierdzone jako w pełni przetworzone (SUCCESS). Nieprzetworzone i błędne
    // zostają nietknięte.
    return processedKeys.has(processedKeyOf(file.remoteFileName, file.size, file.modifiedAt.getTime()));
  });

  return {
    mode: hasFullAnchor ? "full-anchor" : "no-full-export",
    reason: hasFullAnchor
      ? `Najświeższy pełny eksport z ${new Date(latestFullModifiedMs).toISOString()} — kasuję tylko starsze, przetworzone paczki.`
      : `Brak pełnego eksportu — kasuję przetworzone paczki starsze niż ${retentionDays} dni, zostawiając ${keepMin} najświeższych i największą paczkę.`,
    latestFullModifiedMs,
    prunable,
    protectedLargestFileName,
  };
}
