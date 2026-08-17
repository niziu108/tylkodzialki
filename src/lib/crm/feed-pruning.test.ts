import { describe, expect, it } from "vitest";
import {
  planFeedPrune,
  readPrunePolicyFromEnv,
  type ProcessedFeedRecord,
  type PrunePolicy,
  type RemoteFeedFile,
} from "./feed-pruning";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 17, 12, 0, 0); // 2026-08-17

const POLICY: PrunePolicy = {
  retentionDays: 14,
  keepMinFiles: 10,
  allowWithoutFullExport: false,
  retentionDaysWithoutFull: 30,
  keepMinFilesWithoutFull: 20,
};

function remote(name: string, daysAgo: number, size = 1000): RemoteFeedFile {
  return { remoteFileName: name, size, modifiedAt: new Date(NOW - daysAgo * DAY) };
}

function processed(file: RemoteFeedFile, isFullExport = false): ProcessedFeedRecord {
  return {
    remoteFileName: file.remoteFileName,
    fileSize: file.size === null ? null : BigInt(file.size),
    fileModifiedAt: file.modifiedAt,
    isFullExport,
  };
}

/** Paczki co 5 dni wstecz: p0 = najnowsza. */
function series(count: number, stepDays = 5, size = 1000) {
  return Array.from({ length: count }, (_, i) => remote(`oferty_${i}.zip`, i * stepDays, size));
}

describe("planFeedPrune — biuro z pełnym eksportem", () => {
  it("zostawia najświeższy pełny eksport i wszystko po nim", () => {
    const files = series(30);
    const full = files[12]; // 60 dni temu
    const plan = planFeedPrune(files, files.map((f) => processed(f, f === full)), POLICY, NOW);

    expect(plan.mode).toBe("full-anchor");

    const prunedNames = plan.prunable.map((f) => f.remoteFileName);
    expect(prunedNames).not.toContain(full.remoteFileName);

    // Nic nowszego od pełnego eksportu nie wypada.
    for (const file of plan.prunable) {
      expect(file.modifiedAt!.getTime()).toBeLessThan(full.modifiedAt!.getTime());
    }
  });

  it("nie rusza plików bez rekordu SUCCESS", () => {
    const files = series(30);
    const full = files[5];
    // Do bazy trafił tylko pełny eksport — reszta nieprzetworzona.
    const plan = planFeedPrune(files, [processed(full, true)], POLICY, NOW);

    expect(plan.prunable).toHaveLength(0);
  });

  it("nie rusza pliku, któremu zmienił się rozmiar (biuro nadpisało paczkę)", () => {
    const files = series(30);
    const full = files[2];
    const records = files.map((f) => processed(f, f === full));
    const stale = files[25];
    records[25] = { ...records[25], fileSize: BigInt(999999) }; // inny rozmiar niż na FTP

    const plan = planFeedPrune(files, records, POLICY, NOW);

    expect(plan.prunable.map((f) => f.remoteFileName)).not.toContain(stale.remoteFileName);
  });

  it("chroni keepMinFiles najświeższych plików", () => {
    const files = series(30);
    const full = files[0]; // najnowszy jest pełny → wszystko starsze jest kandydatem
    const plan = planFeedPrune(files, files.map((f) => processed(f, f === full)), POLICY, NOW);

    const newestTen = files.slice(0, 10).map((f) => f.remoteFileName);
    for (const name of newestTen) {
      expect(plan.prunable.map((f) => f.remoteFileName)).not.toContain(name);
    }
  });

  it("nie rusza plików młodszych niż margines wieku", () => {
    const files = series(30, 1); // co 1 dzień
    const full = files[0];
    const plan = planFeedPrune(files, files.map((f) => processed(f, f === full)), POLICY, NOW);

    for (const file of plan.prunable) {
      expect(NOW - file.modifiedAt!.getTime()).toBeGreaterThanOrEqual(14 * DAY);
    }
  });
});

describe("planFeedPrune — biuro bez pełnego eksportu", () => {
  const files = series(40);
  const records = files.map((f) => processed(f, false));

  it("domyślnie nie kasuje nic", () => {
    const plan = planFeedPrune(files, records, POLICY, NOW);

    expect(plan.mode).toBe("disabled");
    expect(plan.prunable).toHaveLength(0);
  });

  it("po włączeniu flagi kasuje stare, przetworzone paczki", () => {
    const plan = planFeedPrune(files, records, { ...POLICY, allowWithoutFullExport: true }, NOW);

    expect(plan.mode).toBe("no-full-export");
    expect(plan.prunable.length).toBeGreaterThan(0);

    for (const file of plan.prunable) {
      expect(NOW - file.modifiedAt!.getTime()).toBeGreaterThanOrEqual(30 * DAY);
    }
  });

  it("chroni 20 najświeższych paczek", () => {
    const plan = planFeedPrune(files, records, { ...POLICY, allowWithoutFullExport: true }, NOW);
    const prunedNames = plan.prunable.map((f) => f.remoteFileName);

    for (const file of files.slice(0, 20)) {
      expect(prunedNames).not.toContain(file.remoteFileName);
    }
  });

  it("chroni największą paczkę jako możliwy nieoznaczony pełny eksport", () => {
    const withBig = [...files];
    withBig[35] = { ...withBig[35], size: 900_000_000 }; // stara, ale największa
    const bigRecords = withBig.map((f) => processed(f, false));

    const plan = planFeedPrune(withBig, bigRecords, { ...POLICY, allowWithoutFullExport: true }, NOW);

    expect(plan.protectedLargestFileName).toBe(withBig[35].remoteFileName);
    expect(plan.prunable.map((f) => f.remoteFileName)).not.toContain(withBig[35].remoteFileName);
  });

  it("nie rusza plików bez rekordu SUCCESS ani bez daty", () => {
    const noDate: RemoteFeedFile = { remoteFileName: "bez_daty.zip", size: 10, modifiedAt: null };
    const plan = planFeedPrune(
      [...files, noDate],
      [...records, { remoteFileName: "bez_daty.zip", fileSize: 10, fileModifiedAt: null, isFullExport: false }],
      { ...POLICY, allowWithoutFullExport: true },
      NOW
    );

    expect(plan.prunable.map((f) => f.remoteFileName)).not.toContain("bez_daty.zip");
  });

  it("przy małej liczbie paczek nie kasuje nic (bufor najświeższych zjada całość)", () => {
    const few = series(15);
    const plan = planFeedPrune(
      few,
      few.map((f) => processed(f, false)),
      { ...POLICY, allowWithoutFullExport: true },
      NOW
    );

    expect(plan.prunable).toHaveLength(0);
  });
});

describe("planFeedPrune — przypadki brzegowe", () => {
  it("pusta lista plików nie wywraca reguły", () => {
    const plan = planFeedPrune([], [], { ...POLICY, allowWithoutFullExport: true }, NOW);
    expect(plan.prunable).toHaveLength(0);
  });

  it("nieprawidłowy margines wieku wyłącza kasowanie", () => {
    const files = series(40);
    const plan = planFeedPrune(
      files,
      files.map((f) => processed(f, f === files[0])),
      { ...POLICY, retentionDays: Number.NaN },
      NOW
    );

    expect(plan.mode).toBe("disabled");
    expect(plan.prunable).toHaveLength(0);
  });

  it("nieprawidłowy bufor najświeższych chroni wszystko", () => {
    const files = series(40);
    const plan = planFeedPrune(
      files,
      files.map((f) => processed(f, f === files[0])),
      { ...POLICY, keepMinFiles: Number.NaN },
      NOW
    );

    expect(plan.prunable).toHaveLength(0);
  });

  it("kolejność wejścia nie wpływa na wynik", () => {
    const files = series(40);
    const records = files.map((f) => processed(f, f === files[3]));

    const plan = planFeedPrune(files, records, POLICY, NOW);
    const planReversed = planFeedPrune([...files].reverse(), records, POLICY, NOW);

    expect(planReversed.prunable.map((f) => f.remoteFileName)).toEqual(
      plan.prunable.map((f) => f.remoteFileName)
    );
  });
});

describe("readPrunePolicyFromEnv", () => {
  it("domyślnie trzyma sprzątanie bez pełnego eksportu wyłączone", () => {
    expect(readPrunePolicyFromEnv({}).allowWithoutFullExport).toBe(false);
    expect(readPrunePolicyFromEnv({ CRM_FEED_PRUNE_WITHOUT_FULL: "true" }).allowWithoutFullExport).toBe(false);
    expect(readPrunePolicyFromEnv({ CRM_FEED_PRUNE_WITHOUT_FULL: "1" }).allowWithoutFullExport).toBe(true);
  });

  it("czyta marginesy i bufory ze zmiennych", () => {
    const policy = readPrunePolicyFromEnv({
      CRM_FEED_RETENTION_DAYS: "7",
      CRM_FEED_KEEP_MIN: "5",
      CRM_FEED_RETENTION_DAYS_NO_FULL: "45",
      CRM_FEED_KEEP_MIN_NO_FULL: "25",
    });

    expect(policy).toMatchObject({
      retentionDays: 7,
      keepMinFiles: 5,
      retentionDaysWithoutFull: 45,
      keepMinFilesWithoutFull: 25,
    });
  });
});
