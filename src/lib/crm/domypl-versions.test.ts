import { describe, expect, it } from "vitest";
import { baseExternalId, deletesToApply, versionTakeoverMatcher } from "./domypl-versions";
import { collectMissingCandidates } from "./mass-deactivation";

describe("baseExternalId", () => {
  it("ucina tylko sufiks wersji Galactiki", () => {
    expect(baseExternalId("GS-28954-1")).toBe("GS-28954");
    expect(baseExternalId("AKM-GS-55571-18")).toBe("AKM-GS-55571");
    expect(baseExternalId("LER-GW-12-3")).toBe("LER-GW-12");
    expect(baseExternalId("GS-28954")).toBeNull();
    expect(baseExternalId("GS-289541")).toBeNull();
    expect(baseExternalId("GS-28954-1-2")).toBeNull();
    expect(baseExternalId("1489")).toBeNull();
    expect(baseExternalId("REMAX-490/5569/OGS")).toBeNull();
  });
});

describe("versionTakeoverMatcher: tak samo jak findLinkByVersionedId w processOffer", () => {
  it("nowa wersja przejmuje numer bazowy i każdą inną wersję tej oferty", () => {
    const takenOver = versionTakeoverMatcher(["GS-28954-3"]);

    expect(takenOver("GS-28954")).toBe(true);
    expect(takenOver("GS-28954-1")).toBe(true);
    expect(takenOver("GS-28954-7")).toBe(true);
  });

  it("numer bez wersji nie przejmuje wersji (processOffer tworzy wtedy nowy link)", () => {
    expect(versionTakeoverMatcher(["GS-28954"])("GS-28954-1")).toBe(false);
  });

  it("podobne numery innych działek i inne formaty id nie są przejmowane", () => {
    const takenOver = versionTakeoverMatcher(["GS-28954-3", "1489"]);

    expect(takenOver("GS-289541")).toBe(false);
    expect(takenOver("GS-28954-1-2")).toBe(false);
    expect(takenOver("14890")).toBe(false);
    expect(takenOver("1489")).toBe(false); // dokładne id obsługuje zbiór obecnych, nie ta reguła
  });
});

describe("deletesToApply: <oferta_usun> z tej samej paczki", () => {
  it("protokół aktualizacji Galactiki: usunięcie starej wersji nie gasi działki, gdy nowa jest w paczce", () => {
    // Nowa wersja w paczce, ale jej zapis rzucił albo odpadła na walidacji: link dalej ma stare id.
    expect(deletesToApply(["LER-GS-3541-1"], ["LER-GS-3541-2"])).toEqual([]);
    expect(deletesToApply(["GS-28954"], ["GS-28954-4"])).toEqual([]);
  });

  it("zwykłe usunięcie działki przechodzi", () => {
    expect(deletesToApply(["LER-GS-3541-2", "PASJ-GS-355"], ["LER-GS-3600-1"])).toEqual(["LER-GS-3541-2", "PASJ-GS-355"]);
  });

  it("oferta z tym samym id w paczce wygrywa z usunięciem, jak przed zmianą", () => {
    expect(deletesToApply(["1489", "PASJ-GS-355"], ["1489", "PASJ-GS-355"])).toEqual([]);
  });

  it("numer bez wersji w paczce nie chroni starej wersji (inaczej zostałby duplikat)", () => {
    expect(deletesToApply(["GS-28954-3"], ["GS-28954"])).toEqual(["GS-28954-3"]);
  });

  it("podobne numery innych działek nie chronią przed usunięciem", () => {
    expect(deletesToApply(["1489"], ["14890"])).toEqual(["1489"]);
    expect(deletesToApply(["GS-28954-1"], ["GS-289541"])).toEqual(["GS-28954-1"]);
  });
});

describe("pełny eksport DOMY.PL: działka przejmowana przez nową wersję liczy się jako obecna", () => {
  // Link w bazie ma jeszcze id -18, bo zapis wersji -19 z tego pełnego eksportu rzucił.
  const links = ["AKM-GS-55571-18", "AKM-GS-100", "GS-28954-2", "1489"].map((externalId) => ({ externalId }));
  const presentInFile = ["AKM-GS-55571-19", "GS-28954", "1489"];

  it("dokładne id (stary kod) gasi żywą działkę z nieudanym zapisem nowej wersji", () => {
    const { candidates } = collectMissingCandidates(links, new Set(presentInFile));
    expect(candidates.map((c) => c.externalId)).toEqual(["AKM-GS-55571-18", "AKM-GS-100", "GS-28954-2"]);
  });

  it("gasi tylko działkę nieobecną i starą wersję zastąpioną numerem bez wersji", () => {
    const { candidates, inScopeCount } = collectMissingCandidates(
      links,
      new Set(presentInFile),
      undefined,
      versionTakeoverMatcher(presentInFile)
    );

    expect(candidates.map((c) => c.externalId)).toEqual(["AKM-GS-100", "GS-28954-2"]);
    expect(inScopeCount).toBe(4);
  });
});
