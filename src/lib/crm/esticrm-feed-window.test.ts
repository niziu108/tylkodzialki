import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { extractZipToDir } from "./zip-extract";
import {
  estiRunAdvancesAnchor,
  isEnvironmentError,
  isEstiRunFullExport,
  isEstiWindowPruneEnabled,
  isFullEstiExportMode,
  isInsideEstiWindow,
  isPossiblyStillUploading,
  planEstiWalkWindow,
  planEstiZipPrune,
  readEstiOverlapHours,
  shouldWalkPastZip,
  type EstiRemoteZip,
} from "./esticrm-feed-window";
import type { PrunePolicy } from "./feed-pruning";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 16, 20, 0, 0); // 2026-09-16 20:00 UTC

const POLICY: PrunePolicy = {
  retentionDays: 14,
  keepMinFiles: 10,
  allowWithoutFullExport: false,
  retentionDaysWithoutFull: 30,
  keepMinFilesWithoutFull: 20,
};

function zip(name: string, hoursAgo: number | null, size = 1000): EstiRemoteZip {
  return { remotePath: name, size, modifiedAt: hoursAgo === null ? null : new Date(NOW - hoursAgo * HOUR) };
}

/** Paczki co `stepHours` wstecz, p0 = najnowsza. */
function series(count: number, stepHours: number) {
  return Array.from({ length: count }, (_, i) => zip(`EstiCRM_${String(i).padStart(4, "0")}.zip`, i * stepHours));
}

const names = (zips: EstiRemoteZip[]) => zips.map((z) => z.remotePath);

describe("planEstiWalkWindow", () => {
  it("bez udanego przebiegu czyta wszystko od najnowszej, jak dawniej", () => {
    const zips = series(10, 12);
    const window = planEstiWalkWindow([...zips].reverse(), { lastSuccessAt: null, overlapHours: 24, hasImportedOffers: true });

    expect(window.anchorMs).toBeNull();
    expect(names(window.candidates)).toEqual(names(zips));
  });

  it("czyta paczki od ostatniego udanego przebiegu minus zakładka", () => {
    const zips = series(40, 3); // 5 dni co 3 h
    const lastSuccessAt = new Date(NOW - 2 * HOUR);
    const window = planEstiWalkWindow(zips, { lastSuccessAt, overlapHours: 24, hasImportedOffers: true });

    expect(window.anchorMs).toBe(NOW - 26 * HOUR);
    for (const candidate of window.candidates) {
      expect(candidate.modifiedAt!.getTime()).toBeGreaterThanOrEqual(NOW - 26 * HOUR);
    }
    expect(window.candidates).toHaveLength(9); // 0, 3, ..., 24 h temu
    expect(window.olderThanWindow).toBe(31);
  });

  it("po przestoju workera sięga po wszystkie paczki od ostatniego sukcesu", () => {
    // Przypadek em5: ostatni sukces 26.08, potem trzy tygodnie awarii.
    const zips = series(200, 3); // 25 dni
    const lastSuccessAt = new Date(NOW - 21 * DAY);
    const window = planEstiWalkWindow(zips, { lastSuccessAt, overlapHours: 24, hasImportedOffers: true });

    const oldest = window.candidates[window.candidates.length - 1];
    expect(oldest.modifiedAt!.getTime()).toBeGreaterThanOrEqual(NOW - 22 * DAY);
    expect(window.candidates.length).toBe(177); // 22 dni co 3 h, z obiema granicami
  });

  it("paczka bez daty modyfikacji zostaje w oknie", () => {
    const zips = [...series(10, 12), zip("bez_daty.zip", null)];
    const window = planEstiWalkWindow(zips, { lastSuccessAt: new Date(NOW - HOUR), overlapHours: 24, hasImportedOffers: true });

    expect(names(window.candidates)).toContain("bez_daty.zip");
  });

  it("nieprawidłowa albo absurdalna zakładka wyłącza okno zamiast gubić paczki lub wywracać przebieg", () => {
    const zips = series(10, 12);

    for (const overlap of [Number.NaN, -1, Number.POSITIVE_INFINITY, 1e10, 24 * 366]) {
      const window = planEstiWalkWindow(zips, { lastSuccessAt: new Date(NOW - HOUR), overlapHours: overlap, hasImportedOffers: true });
      expect(window.anchorMs).toBeNull();
      expect(window.candidates).toHaveLength(10);
    }
  });

  it("okno może być puste, gdy od dawna nie przyszła nowa paczka", () => {
    const zips = series(5, 24).map((z, i) => zip(z.remotePath, 72 + i * 24));
    const window = planEstiWalkWindow(zips, { lastSuccessAt: new Date(NOW - HOUR), overlapHours: 24, hasImportedOffers: true });

    expect(window.candidates).toHaveLength(0);
    expect(window.olderThanWindow).toBe(5);
  });

  it("integracja bez zaimportowanych ofert czyta wstecz do pełnego eksportu mimo lastSuccessAt", () => {
    // Biuro podłączone z domyślnym providerem: przebiegi DOMY.PL kończyły się „sukcesem" na pustym,
    // a pełny eksport EstiCRM leży na FTP od 3 dni. Po poprawce providera musi zostać przeczytany.
    const zips = series(40, 3);
    const window = planEstiWalkWindow(zips, { lastSuccessAt: new Date(NOW - HOUR), overlapHours: 24, hasImportedOffers: false });

    expect(window.anchorMs).toBeNull();
    expect(window.candidates).toHaveLength(40);
  });
});

describe("isInsideEstiWindow", () => {
  it("bez okna mieści się wszystko, plik bez daty zawsze, reszta od początku okna", () => {
    const anchorMs = NOW - 26 * HOUR;

    expect(isInsideEstiWindow(new Date(NOW - 100 * DAY), null)).toBe(true);
    expect(isInsideEstiWindow(null, anchorMs)).toBe(true);
    expect(isInsideEstiWindow(undefined, anchorMs)).toBe(true);
    expect(isInsideEstiWindow(new Date(anchorMs), anchorMs)).toBe(true);
    expect(isInsideEstiWindow(new Date(anchorMs - 1), anchorMs)).toBe(false);
  });
});

describe("estiRunAdvancesAnchor", () => {
  it("kotwica rusza się tylko po przebiegu, który przetworzył wszystko", () => {
    expect(estiRunAdvancesAnchor({ offerErrors: 0, skippedOffers: 0, listingProblems: 0 })).toBe(true);
  });

  it("błąd zapisu oferty trzyma kotwicę: paczka wraca w kolejnych przebiegach, także po dobie", () => {
    expect(estiRunAdvancesAnchor({ offerErrors: 1, skippedOffers: 0, listingProblems: 0 })).toBe(false);
  });

  it("oferta pominięta z braku publikacji trzyma kotwicę, żeby weszła po zakupie pakietu", () => {
    expect(estiRunAdvancesAnchor({ offerErrors: 0, skippedOffers: 2, listingProblems: 0 })).toBe(false);
  });

  it("niewylistowany podkatalog FTP trzyma kotwicę", () => {
    expect(estiRunAdvancesAnchor({ offerErrors: 0, skippedOffers: 0, listingProblems: 1 })).toBe(false);
  });
});

describe("readEstiOverlapHours", () => {
  it("domyślnie 24 h, liczba z env, `off` wyłącza okno", () => {
    expect(readEstiOverlapHours({})).toBe(24);
    expect(readEstiOverlapHours({ CRM_ESTICRM_OVERLAP_HOURS: " " })).toBe(24);
    expect(readEstiOverlapHours({ CRM_ESTICRM_OVERLAP_HOURS: "48" })).toBe(48);
    expect(Number.isNaN(readEstiOverlapHours({ CRM_ESTICRM_OVERLAP_HOURS: "off" }))).toBe(true);
  });
});

describe("shouldWalkPastZip", () => {
  it("pełny eksport kończy wybór zawsze", () => {
    expect(shouldWalkPastZip("full", false)).toBe(false);
    expect(shouldWalkPastZip("full", true)).toBe(false);
  });

  it("przyrostowa paczka nie kończy wyboru", () => {
    expect(shouldWalkPastZip("incremental", false)).toBe(true);
    expect(shouldWalkPastZip("incremental", true)).toBe(true);
  });

  it("tryb nieznany kończy wybór tylko bez okna", () => {
    expect(shouldWalkPastZip("unknown", false)).toBe(false);
    expect(shouldWalkPastZip("unknown", true)).toBe(true);
  });
});

describe("isEstiRunFullExport", () => {
  it("rozpoznaje pełny eksport po atrybucie export", () => {
    for (const mode of ["full", "FULL", "complete", "całość", "Calosc"]) {
      expect(isFullEstiExportMode(mode)).toBe(true);
    }
    for (const mode of ["incremental", "", null, undefined]) {
      expect(isFullEstiExportMode(mode)).toBe(false);
    }
  });

  it("pełny eksport bez nieczytelnych paczek wygasza jak dotąd", () => {
    expect(isEstiRunFullExport("full", 0)).toBe(true);
  });

  it("nieczytelna paczka w przebiegu blokuje wygaszanie nawet przy pełnym eksporcie", () => {
    // Np. najnowsza paczka urwana, a przebieg przeczytał starszy pełny eksport.
    expect(isEstiRunFullExport("full", 1)).toBe(false);
  });

  it("przyrostowy albo nieznany tryb nigdy nie jest pełnym eksportem", () => {
    expect(isEstiRunFullExport("incremental", 0)).toBe(false);
    expect(isEstiRunFullExport(null, 0)).toBe(false);
  });
});

describe("isPossiblyStillUploading", () => {
  it("świeża paczka mogła się jeszcze wgrywać, starsza jest uszkodzona", () => {
    expect(isPossiblyStillUploading(zip("a.zip", 0.1), NOW)).toBe(true);
    expect(isPossiblyStillUploading(zip("a.zip", 2), NOW)).toBe(false);
    expect(isPossiblyStillUploading(zip("a.zip", null), NOW)).toBe(false);
  });
});

describe("isEnvironmentError", () => {
  it("awaria dysku wywraca przebieg, wada paczki nie", () => {
    expect(isEnvironmentError(Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC", syscall: "write" }))).toBe(true);
    expect(isEnvironmentError(new Error("FILE_ENDED"))).toBe(false);
    expect(isEnvironmentError(Object.assign(new Error("invalid distance too far back"), { code: "Z_DATA_ERROR", errno: -3 }))).toBe(false);
    expect(isEnvironmentError("FILE_ENDED")).toBe(false);
    expect(isEnvironmentError(null)).toBe(false);
  });

  it("uprawnienia i limit deskryptorów to środowisko, konflikt ścieżek wpisów to wada paczki", () => {
    for (const code of ["EACCES", "EMFILE", "EROFS", "EIO"]) {
      expect(isEnvironmentError(Object.assign(new Error(code), { code, syscall: "open" })), code).toBe(true);
    }
    // Wpis „foto/1.jpg" i plik „foto" w tym samym ZIP-ie: błąd powtórzy się przy każdym przebiegu.
    for (const code of ["EISDIR", "ENOTDIR", "EEXIST", "ENAMETOOLONG"]) {
      expect(isEnvironmentError(Object.assign(new Error(code), { code, syscall: "open" })), code).toBe(false);
    }
  });
});

// Najmniejszy ZIP bez kompresji. Test sprawdza zachowanie unzippera, na którym stoi pomijanie paczek.
function crc32(buffer: Buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function buildStoredZip(entries: Array<[string, string]>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  const entryOffsets: number[] = [];
  let offset = 0;

  for (const [name, content] of entries) {
    entryOffsets.push(offset);
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return { zip: Buffer.concat([...locals, centralDirectory, end]), entryOffsets, centralDirectoryOffset: offset };
}

async function extractBuffer(buffer: Buffer) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-esticrm-test-"));
  const zipPath = path.join(dir, "paczka.zip");
  await fsp.writeFile(zipPath, buffer);
  try {
    await extractZipToDir(zipPath, path.join(dir, "out"));
    return await fsp.readdir(path.join(dir, "out"));
  } finally {
    // Sprzątanie nie może podmienić błędu rozpakowania (ENOTEMPTY ma `syscall`).
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

describe("extractZipToDir i urwany ZIP (kontrakt, na którym stoi pomijanie paczek)", () => {
  const { zip: whole, entryOffsets, centralDirectoryOffset } = buildStoredZip([
    ["EstiCRM_22196_20260826_095342.xml", `<offers export="incremental"><offer><id>1</id></offer></offers>`],
    ["zdjecie_1.jpg", "x".repeat(5000)],
    ["zdjecie_2.jpg", "y".repeat(5000)],
  ]);

  it("cały plik rozpakowuje się poprawnie", async () => {
    expect((await extractBuffer(whole)).sort()).toEqual(
      ["EstiCRM_22196_20260826_095342.xml", "zdjecie_1.jpg", "zdjecie_2.jpg"].sort()
    );
  });

  it("ucięcie w środku wpisu, na granicy wpisów i w katalogu centralnym rzuca błąd paczki, nie środowiska", async () => {
    const cuts = {
      "w środku zdjęcia": entryOffsets[1] + 2000,
      "dokładnie przed drugim wpisem": entryOffsets[1],
      "dokładnie przed trzecim wpisem": entryOffsets[2],
      "dokładnie przed katalogiem centralnym": centralDirectoryOffset,
      "bez końcówki rekordu EOCD": whole.length - 10,
    };

    for (const [label, cut] of Object.entries(cuts)) {
      const error = await extractBuffer(whole.subarray(0, cut)).then(
        () => null,
        (e: unknown) => e
      );
      expect(error, label).toBeInstanceOf(Error);
      expect(isEnvironmentError(error), label).toBe(false);
    }
  });
});

describe("isEstiWindowPruneEnabled", () => {
  it("brak zmiennej = tylko podgląd", () => {
    expect(isEstiWindowPruneEnabled("abc", undefined)).toBe(false);
    expect(isEstiWindowPruneEnabled("abc", "")).toBe(false);
    expect(isEstiWindowPruneEnabled("abc", "0")).toBe(false);
  });

  it("`1` włącza wszystkie biura, lista id tylko wskazane (kanarek)", () => {
    expect(isEstiWindowPruneEnabled("abc", "1")).toBe(true);
    expect(isEstiWindowPruneEnabled("abc", "abc")).toBe(true);
    expect(isEstiWindowPruneEnabled("abc", " xyz , abc ")).toBe(true);
    expect(isEstiWindowPruneEnabled("abc", "xyz")).toBe(false);
    expect(isEstiWindowPruneEnabled("ab", "abc")).toBe(false);
  });
});

describe("planEstiZipPrune: reguła pełnego eksportu (bez zmian)", () => {
  const fullRule = (zips: EstiRemoteZip[], full: EstiRemoteZip) =>
    planEstiZipPrune(zips, {
      newestFullMs: full.modifiedAt!.getTime(),
      anchorMs: null,
      windowRuleEnabled: false,
      policy: POLICY,
      nowMs: NOW,
    });

  it("kasuje paczki starsze od 14 dni, ale tylko starsze od najnowszego pełnego eksportu", () => {
    const zips = series(60, 12); // 30 dni co 12 h
    const full = zips[40]; // 20 dni temu
    const plan = fullRule(zips, full);

    // Paczki z 14-20 dni temu są starsze niż margines, ale nowsze od pełnego: zostają.
    expect(names(plan.prunable)).toEqual(names(zips.slice(41).reverse()));
    expect(plan.previewWhenDisabled).toHaveLength(0);
  });

  it("chroni 10 najświeższych paczek nawet starszych od pełnego i od marginesu", () => {
    const zips = Array.from({ length: 12 }, (_, i) => zip(`stara_${String(i).padStart(2, "0")}.zip`, 30 * 24 + i));
    const plan = fullRule(zips, zips[0]);

    expect(names(plan.prunable)).toEqual(["stara_11.zip", "stara_10.zip"]);
  });

  it("bez przeczytanego pełnego eksportu nic nie kasuje", () => {
    const zips = series(60, 12);
    const plan = planEstiZipPrune(zips, { newestFullMs: 0, anchorMs: null, windowRuleEnabled: true, policy: POLICY, nowMs: NOW });

    expect(plan.prunable).toHaveLength(0);
  });
});

describe("planEstiZipPrune: reguła okna", () => {
  // Biuro jak em5: pełny eksport na starcie (57 dni temu, największy plik), potem przyrostowe co 3 h.
  const incrementals = Array.from({ length: 450 }, (_, i) => zip(`EstiCRM_inc_${String(i).padStart(3, "0")}.zip`, i * 3));
  const initialFull = zip("EstiCRM_full.zip", 57 * 24, 1_600_000_000);
  const zips = [...incrementals, initialFull];
  const anchorMs = NOW - 26 * HOUR;

  it("bez włącznika nic nie kasuje, ale pokazuje podgląd", () => {
    const plan = planEstiZipPrune(zips, { newestFullMs: 0, anchorMs, windowRuleEnabled: false, policy: POLICY, nowMs: NOW });

    expect(plan.prunable).toHaveLength(0);
    expect(plan.previewWhenDisabled.length).toBeGreaterThan(0);
  });

  it("kasuje ciągły ogon od najstarszej, razem z jedynym pełnym eksportem", () => {
    const plan = planEstiZipPrune(zips, { newestFullMs: 0, anchorMs, windowRuleEnabled: true, policy: POLICY, nowMs: NOW });
    const pruned = new Set(plan.prunable);

    expect(plan.prunable[0]).toBe(initialFull); // od najstarszej
    for (const file of plan.prunable) {
      expect(file.modifiedAt!.getTime()).toBeLessThan(NOW - 30 * DAY);
    }

    // Bez dziur: każda zostawiona paczka jest nowsza od każdej skasowanej.
    const newestPruned = Math.max(...plan.prunable.map((f) => f.modifiedAt!.getTime()));
    for (const file of zips.filter((f) => !pruned.has(f))) {
      expect(file.modifiedAt!.getTime()).toBeGreaterThan(newestPruned);
    }
  });

  it("nie kasuje paczek z okna, nawet starszych niż 30 dni (nieprzeczytanych po długim przestoju)", () => {
    const longOutageAnchor = NOW - 41 * DAY;
    const plan = planEstiZipPrune(zips, {
      newestFullMs: 0,
      anchorMs: longOutageAnchor,
      windowRuleEnabled: true,
      policy: POLICY,
      nowMs: NOW,
    });

    for (const file of plan.prunable) {
      expect(file.modifiedAt!.getTime()).toBeLessThan(longOutageAnchor);
    }
    expect(names(plan.prunable)).toContain(initialFull.remotePath);
  });

  it("bez kotwicy (pierwszy przebieg biura) nic nie kasuje", () => {
    const plan = planEstiZipPrune(zips, { newestFullMs: 0, anchorMs: null, windowRuleEnabled: true, policy: POLICY, nowMs: NOW });

    expect(plan.prunable).toHaveLength(0);
    expect(plan.previewWhenDisabled).toHaveLength(0);
  });

  it("zostawia 20 najświeższych paczek biura, które rzadko coś wysyła", () => {
    const rare = Array.from({ length: 25 }, (_, i) => zip(`rzadkie_${i}.zip`, (40 + i * 7) * 24));
    const plan = planEstiZipPrune(rare, { newestFullMs: 0, anchorMs, windowRuleEnabled: true, policy: POLICY, nowMs: NOW });

    expect(plan.prunable).toHaveLength(5);
    expect(names(plan.prunable)).toEqual(["rzadkie_24.zip", "rzadkie_23.zip", "rzadkie_22.zip", "rzadkie_21.zip", "rzadkie_20.zip"]);
  });

  it("pomija paczki bez daty", () => {
    const withUndated = [...zips, zip("bez_daty.zip", null)];
    const plan = planEstiZipPrune(withUndated, { newestFullMs: 0, anchorMs, windowRuleEnabled: true, policy: POLICY, nowMs: NOW });

    expect(names(plan.prunable)).not.toContain("bez_daty.zip");
  });

  it("nieprawidłowe liczby w env chronią wszystko zamiast kasować wszystko", () => {
    const badKeep = planEstiZipPrune(zips, {
      newestFullMs: 0,
      anchorMs,
      windowRuleEnabled: true,
      policy: { ...POLICY, keepMinFilesWithoutFull: Number.NaN },
      nowMs: NOW,
    });
    const badRetention = planEstiZipPrune(zips, {
      newestFullMs: 0,
      anchorMs,
      windowRuleEnabled: true,
      policy: { ...POLICY, retentionDaysWithoutFull: Number.NaN },
      nowMs: NOW,
    });

    expect(badKeep.prunable).toHaveLength(0);
    expect(badRetention.prunable).toHaveLength(0);
  });

  it("wynik nie zależy od kolejności plików z FTP", () => {
    const params = { newestFullMs: 0, anchorMs, windowRuleEnabled: true, policy: POLICY, nowMs: NOW };
    const plan = planEstiZipPrune(zips, params);
    const planReversed = planEstiZipPrune([...zips].reverse(), params);

    expect(names(planReversed.prunable)).toEqual(names(plan.prunable));
  });
});
