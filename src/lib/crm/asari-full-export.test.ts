import { describe, expect, it } from "vitest";
import {
  asariBranchOfSignature,
  asariFilePrefix,
  isInAsariFullExportScope,
  resolveAsariFullExportScope,
  type AsariFullExportInput,
} from "./asari-full-export";
import { assessMassDeactivation, collectMissingCandidates } from "./mass-deactivation";

type Link = { externalId: string };

/** `count` sygnatur oddziału, np. offers("3877", 45000, 3) → 45000/3877/OGS, 45001/3877/OGS, 45002/3877/OGS. */
function offers(branch: string, firstNumber: number, count: number, code = "OGS"): string[] {
  return Array.from({ length: count }, (_, i) => `${firstNumber + i}/${branch}/${code}`);
}

const asLinks = (ids: string[]): Link[] => ids.map((externalId) => ({ externalId }));

/**
 * Co zgasi przebieg: zakres z manifestu, kandydaci i hamulec, dokładnie w tej kolejności co
 * deactivate-missing.ts. `input: null` odtwarza stary kod (zawsze cała integracja).
 */
function simulate(activeIds: string[], seenIds: string[], input: AsariFullExportInput | null) {
  const scope = input
    ? resolveAsariFullExportScope(input)
    : ({ kind: "integration", reason: "stary kod" } as const);

  if (scope.kind === "skip") return { scope, deactivated: [] as string[], blocked: false };

  const isInScope =
    scope.kind === "branch" ? (externalId: string) => isInAsariFullExportScope(externalId, scope) : undefined;
  const { inScopeCount, candidates } = collectMissingCandidates(asLinks(activeIds), new Set(seenIds), isInScope);
  const verdict = assessMassDeactivation({ activeCount: inScopeCount, candidateCount: candidates.length });

  return {
    scope,
    deactivated: verdict.allowed ? candidates.map((c) => c.externalId) : [],
    blocked: !verdict.allowed,
  };
}

/** Pełny eksport jednego oddziału: manifest + jeden plik ofert, oba przeczytane. */
function fullExport(branch: string, stamp: string, signatures: string[], prefixesOnFtp: string[]): AsariFullExportInput {
  const offerFile = `${branch}_${stamp}_001.xml`;
  return {
    cfgFileName: `${branch}_${stamp}_CFG.xml`,
    listedOfferFiles: [offerFile],
    readableOfferFiles: [offerFile],
    fullExportSignatures: signatures,
    prefixesOnFtp,
  };
}

describe("pełny eksport ASARI w sieci z wieloma oddziałami na jednym FTP", () => {
  // Stan z produkcji (PÓŁNOC, 16.09.2026): oddział 3877 wysłał 16 działek w pierwszej, pełnej paczce.
  const polnoc3877 = offers("3877", 45000, 16);
  const mieszkania4120 = offers("4120", 70000, 40, "OMS");

  it("pierwsza paczka nowego oddziału nie gasi działek oddziału, którego pełny eksport już skasowano", () => {
    // 14 dni później: pełny eksport 3877 zniknął przy sprzątaniu, na FTP zostały tylko jego
    // przyrostowe z 2 zmienionymi działkami. Oddział 4120 przysyła pierwszą paczkę (empty_offers=1).
    const dzialki4120 = offers("4120", 60000, 12);
    const active = [...polnoc3877, ...dzialki4120]; // działki 4120 utworzył już ten przebieg
    const seen = [...polnoc3877.slice(0, 2), ...dzialki4120];
    const input = fullExport("4120", "20261001_101500", [...dzialki4120, ...mieszkania4120], ["3877", "4120"]);

    // Stary kod: 14 niezmienionych działek 3877 znika, a hamulec to przepuszcza (14 ≤ 25).
    const stary = simulate(active, seen, null);
    expect(stary.deactivated).toHaveLength(14);
    expect(stary.blocked).toBe(false);

    const nowy = simulate(active, seen, input);
    expect(nowy.scope).toMatchObject({ kind: "branch", branch: "4120" });
    expect(nowy.deactivated).toEqual([]);
  });

  it("ponowny pełny eksport oddziału gasi tylko jego sprzedane działki", () => {
    const dzialki4120 = offers("4120", 60000, 12);
    const wciazWEksporcie = dzialki4120.slice(0, 10); // 2 sprzedane
    const active = [...polnoc3877, ...dzialki4120];
    const seen = [...wciazWEksporcie]; // z 3877 nic już nie leży na FTP
    const input = fullExport("4120", "20261020_080000", [...wciazWEksporcie, ...mieszkania4120], ["3877", "4120"]);

    const wynik = simulate(active, seen, input);

    expect(wynik.deactivated).toEqual(dzialki4120.slice(10));
    for (const id of polnoc3877) expect(wynik.deactivated).not.toContain(id);
  });

  it("oddział bez działek w pełnym eksporcie (same mieszkania) nie rusza innych oddziałów", () => {
    const active = [...polnoc3877];
    const input = fullExport("5001", "20261002_120000", offers("5001", 1, 30, "OMS"), ["3877", "5001"]);

    // seen niepuste dzięki przyrostowym 3877, więc stary warunek wchodził do wygaszania.
    expect(simulate(active, polnoc3877.slice(0, 1), null).deactivated).toHaveLength(15);
    expect(simulate(active, polnoc3877.slice(0, 1), input).deactivated).toEqual([]);
  });

  it("hamulec liczy udział w podaży oddziału, nie całej sieci", () => {
    // Sieć z 400 działkami w innych oddziałach. Oddział 4120 (30 działek) przysłał pełny eksport
    // tylko z 3 działkami, np. generator padł w połowie. W skali sieci to 6%, w oddziale 90%.
    const reszta = offers("3877", 1, 400);
    const dzialki4120 = offers("4120", 60000, 30);
    const active = [...reszta, ...dzialki4120];
    const seen = [...reszta, ...dzialki4120.slice(0, 3)];
    const input = fullExport("4120", "20261003_090000", dzialki4120.slice(0, 3), ["3877", "4120"]);

    expect(simulate(active, seen, null).blocked).toBe(false); // stary kod: 27 z 430 przechodzi
    expect(simulate(active, seen, input).blocked).toBe(true);
  });
});

describe("zachowanie dla biur z jednym strumieniem bez zmian", () => {
  it("biuro ASARI z jednym prefiksem gasi dokładnie to samo co stary kod", () => {
    const active = offers("7364", 100, 30);
    const seen = active.slice(0, 25);
    const input = fullExport("7364", "20260916_120000", [...seen, ...offers("7364", 900, 60, "OMS")], ["7364"]);

    const stary = simulate(active, seen, null);
    const nowy = simulate(active, seen, input);

    expect(nowy.scope).toMatchObject({ kind: "branch", branch: "7364" });
    expect(nowy.deactivated).toEqual(stary.deactivated);
    expect(nowy.deactivated).toHaveLength(5);
  });

  it("format bez oddziału w sygnaturze (Patio) zostaje przy całej integracji", () => {
    const active = ["PAT21335", "PAT20697", "PAT21001", "PAT21002"];
    const seen = ["PAT21335", "PAT20697"];
    const input = {
      cfgFileName: "PAT_20260907_141309_CFG.xml",
      listedOfferFiles: ["PAT_20260907_141309_001.xml"],
      readableOfferFiles: ["PAT_20260907_141309_001.xml"],
      fullExportSignatures: [...seen, "PAT30000"],
      prefixesOnFtp: ["pat"],
    };

    const nowy = simulate(active, seen, input);

    expect(nowy.scope.kind).toBe("integration");
    expect(nowy.deactivated).toEqual(simulate(active, seen, null).deactivated);
    expect(nowy.deactivated).toEqual(["PAT21001", "PAT21002"]);
  });

  it("prefiks niepotwierdzony w sygnaturach przy jednym strumieniu: cała integracja", () => {
    const input = fullExport("export", "20260916_120000", offers("123", 1, 5), ["export"]);
    expect(resolveAsariFullExportScope(input).kind).toBe("integration");
  });
});

describe("resolveAsariFullExportScope: kiedy nie wygaszamy nic", () => {
  const base = fullExport("3877", "20260916_151353", offers("3877", 1, 10), ["3877"]);

  it("format bez oddziału przy kilku strumieniach na FTP", () => {
    const scope = resolveAsariFullExportScope({ ...base, fullExportSignatures: ["PAT1", "PAT2"], prefixesOnFtp: ["3877", "4120"] });
    expect(scope.kind).toBe("skip");
  });

  it("plik wskazany przez manifest nie został przeczytany (brak albo uszkodzony)", () => {
    const scope = resolveAsariFullExportScope({
      ...base,
      listedOfferFiles: ["3877_20260916_151353_001.xml", "3877_20260916_151353_002.xml"],
      readableOfferFiles: ["3877_20260916_151353_001.xml"],
    });

    expect(scope.kind).toBe("skip");
    expect(scope.reason).toContain("3877_20260916_151353_002.xml");
  });

  it("manifest bez listy plików", () => {
    expect(resolveAsariFullExportScope({ ...base, listedOfferFiles: [] }).kind).toBe("skip");
  });

  it("pełny eksport bez żadnej oferty", () => {
    expect(resolveAsariFullExportScope({ ...base, fullExportSignatures: [] }).kind).toBe("skip");
  });

  it("nazwy plików porównuje bez wielkości liter i ścieżki", () => {
    const scope = resolveAsariFullExportScope({
      ...base,
      listedOfferFiles: ["3877_20260916_151353_001.XML"],
      readableOfferFiles: ["sub/3877_20260916_151353_001.xml"],
    });
    expect(scope.kind).toBe("branch");
  });

  it("zakres skip nie obejmuje żadnej oferty", () => {
    expect(isInAsariFullExportScope("1/3877/OGS", { kind: "skip", reason: "test" })).toBe(false);
  });
});

describe("rozpoznawanie oddziału", () => {
  it("z sygnatury ASARI", () => {
    expect(asariBranchOfSignature("46802/3877/OGS")).toBe("3877");
    expect(asariBranchOfSignature(" 46802/3877/ogs ")).toBe("3877");
    expect(asariBranchOfSignature("PAT21335")).toBeNull();
    expect(asariBranchOfSignature("1/3877")).toBeNull();
    expect(asariBranchOfSignature("1/2/3/OGS")).toBeNull();
    expect(asariBranchOfSignature("1//OGS")).toBeNull();
  });

  it("z nazwy pliku paczki", () => {
    expect(asariFilePrefix("3877_20260916_151353_CFG.xml")).toBe("3877");
    expect(asariFilePrefix("3877_20260916_151353_001.xml")).toBe("3877");
    expect(asariFilePrefix("PAT_20260907_141309_001.xml")).toBe("pat");
    expect(asariFilePrefix("openestatewarszawa/16470_20260903_142033_001.xml")).toBe("16470");
    expect(asariFilePrefix("definictions.xml")).toBeNull();
    expect(asariFilePrefix("_CFG.xml")).toBeNull();
  });
});
