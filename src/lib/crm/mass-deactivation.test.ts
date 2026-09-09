import { describe, expect, it } from "vitest";
import {
  MASS_DEACTIVATION_DEFAULTS,
  assessMassDeactivation,
  readMassDeactivationLimits,
} from "./mass-deactivation";

const assess = (activeCount: number, candidateCount: number) =>
  assessMassDeactivation({ activeCount, candidateCount });

describe("assessMassDeactivation", () => {
  it("przepuszcza normalną rotację dużego biura", () => {
    // 4000 ofert, 120 sprzedanych w cyklu — 3%, tak wygląda żywy eksport sieci franczyzowej.
    expect(assess(4000, 120).allowed).toBe(true);
  });

  it("blokuje urwany eksport, który pomija większość podaży", () => {
    // Scenariusz, przed którym to powstało: plik oznaczony jako pełny przyszedł z 60 ofertami
    // zamiast 4294, bo generator po stronie biura padł w połowie.
    const verdict = assess(4294, 4234);

    expect(verdict.allowed).toBe(false);
    expect(verdict.share).toBeGreaterThan(MASS_DEACTIVATION_DEFAULTS.maxSharePercent);
    expect(verdict.reason).toContain("urwany eksport");
  });

  it("przepuszcza małe liczby bezwzględne mimo wysokiego udziału", () => {
    // Biuro z 6 ofertami sprzedało 4. Udział 66%, ale to nie jest awaria eksportu.
    expect(assess(6, 4).allowed).toBe(true);
  });

  it("trzyma się progu udziału tuż nad i tuż pod granicą", () => {
    // 40% dokładnie: przechodzi (próg jest ostry, blokujemy dopiero POWYŻEJ).
    expect(assess(1000, 400).allowed).toBe(true);
    expect(assess(1000, 401).allowed).toBe(false);
  });

  it("nie wywraca się na pustej podaży", () => {
    const verdict = assess(0, 0);

    expect(verdict.allowed).toBe(true);
    expect(verdict.share).toBe(0);
  });
});

describe("readMassDeactivationLimits", () => {
  it("czyta progi z ENV", () => {
    const limits = readMassDeactivationLimits({
      CRM_DEACTIVATION_MAX_SHARE: "80",
      CRM_DEACTIVATION_MIN_COUNT: "5",
    });

    expect(limits).toEqual({ maxSharePercent: 80, minCount: 5 });
  });

  it("ignoruje wartości bezsensowne i wraca do domyślnych", () => {
    // Literówka w ENV na VPS nie może po cichu rozbroić bezpiecznika.
    for (const bad of ["0", "-1", "150", "abc", ""]) {
      const limits = readMassDeactivationLimits({
        CRM_DEACTIVATION_MAX_SHARE: bad,
      });

      expect(limits.maxSharePercent).toBe(MASS_DEACTIVATION_DEFAULTS.maxSharePercent);
    }
  });
});
