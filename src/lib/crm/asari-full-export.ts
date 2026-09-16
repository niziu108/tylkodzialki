/**
 * Za kogo mówi pełny eksport ASARI (`empty_offers=1`) i czy w ogóle wolno na nim wygaszać.
 *
 * Problem: sieć biur podłącza wiele oddziałów do jednego konta FTP i jednego katalogu (PÓŁNOC
 * Nieruchomości od 16.09.2026, docelowo do 50 oddziałów). Każdy oddział to osobny strumień paczek:
 * `3877_20260916_151353_CFG.xml` + `3877_20260916_151353_001.xml`, a jego oferty mają sygnatury
 * `46802/3877/OGS`, gdzie środkowy segment to ten sam numer co prefiks nazwy pliku. Skan 25
 * integracji ASARI z 16.09.2026 potwierdził tę zgodność u każdego biura w standardzie ASARI
 * (zero rozbieżności). Wyjątek to format bez numeru oddziału w sygnaturze (Patio: `PAT21335`).
 *
 * ASARI wysyła pełny eksport tylko w pierwszej paczce strumienia, potem same przyrostowe, a
 * sprzątanie FTP kasuje paczki po 14 dniach. Stary warunek gasił każdą aktywną ofertę CAŁEJ
 * integracji, której nie było w żadnym pliku na FTP. Gdy pełny eksport oddziału A już zniknął,
 * pierwsza paczka oddziału B wygaszała niezmienione działki A. Hamulec (25 ofert, 40%) tego nie
 * łapie, bo oddział ma zwykle kilkadziesiąt działek.
 *
 * Reguła: pełny eksport mówi tylko za swój oddział. Oddział bierzemy z prefiksu nazwy CFG, ale
 * tylko wtedy, gdy potwierdzają go sygnatury ofert z tego samego eksportu. Format bez oddziału w
 * sygnaturze zostaje przy dotychczasowym zakresie całej integracji, o ile na FTP leży jeden
 * strumień. U biura z jednym prefiksem wynik jest identyczny jak przed zmianą, bo wszystkie jego
 * oferty należą do tego prefiksu.
 *
 * Czego świadomie NIE robimy: nie chronimy starych pełnych eksportów przed sprzątaniem FTP.
 * Sprzątanie kasuje paczki od najstarszych, więc na FTP zawsze zostaje ciągły ogon czasu.
 * Trzymanie starego pełnego eksportu przy kasowaniu nowszych paczek robi dziurę: oferta sprzedana
 * sekcją DELETE w skasowanej paczce wraca ze starego pliku jako REACTIVATE, a nowsza cena zostaje
 * nadpisana starszą. Przy zakresie per oddział skasowanie cudzego pełnego eksportu jest nieszkodliwe.
 */

import { XMLValidator } from "fast-xml-parser";

export type AsariFullExportScope =
  /** Nie wygaszamy nic: eksport niekompletny albo nie wiadomo, za kogo mówi. */
  | { kind: "skip"; reason: string }
  /** Cała integracja, jak przed zmianą (format bez oddziału w sygnaturze, jeden strumień). */
  | { kind: "integration"; reason: string }
  /** Tylko oferty jednego oddziału sieci. */
  | { kind: "branch"; branch: string; reason: string };

export type AsariFullExportInput = {
  /** Nazwa manifestu z `empty_offers=1`. */
  cfgFileName: string;
  /** Pliki ofert wskazane przez ten manifest. */
  listedOfferFiles: string[];
  /** Pliki ofert, które ten przebieg pobrał i które przeszły walidację XML. */
  readableOfferFiles: string[];
  /** Sygnatury WSZYSTKICH ofert (każdego typu, nie tylko działek) z plików wskazanych przez manifest. */
  fullExportSignatures: string[];
  /** Prefiksy paczek leżących na FTP (`*_NNN.xml`, `*_CFG.xml`). */
  prefixesOnFtp: string[];
};

function basenameLower(fileName: string): string {
  return (fileName.replace(/\\/g, "/").split("/").pop() ?? "").trim().toLowerCase();
}

/** `46802/3877/OGS` → `3877`. Sygnatura w innym formacie (np. `PAT21335`) → null. */
export function asariBranchOfSignature(signature: string): string | null {
  const parts = signature.trim().split("/");
  if (parts.length !== 3) return null;
  const branch = parts[1].trim().toLowerCase();
  return branch || null;
}

/** `3877_20260916_151353_CFG.xml` → `3877`. Plik bez prefiksu (np. `definictions.xml`) → null. */
export function asariFilePrefix(fileName: string): string | null {
  const match = basenameLower(fileName).match(/^([^_]+)_.+\.xml$/);
  return match ? match[1] : null;
}

export function resolveAsariFullExportScope(input: AsariFullExportInput): AsariFullExportScope {
  const cfgName = basenameLower(input.cfgFileName);
  const listed = [...new Set(input.listedOfferFiles.map(basenameLower).filter(Boolean))];

  if (listed.length === 0) {
    return { kind: "skip", reason: `Manifest ${cfgName} nie wskazuje żadnego pliku ofert.` };
  }

  // Plik wskazany przez manifest, a nieprzeczytany, to eksport w trakcie wgrywania albo uszkodzony.
  // Wygaszanie na nim zgasiłoby oferty z brakującej części.
  const readable = new Set(input.readableOfferFiles.map(basenameLower));
  const unreadable = listed.filter((name) => !readable.has(name));
  if (unreadable.length > 0) {
    return {
      kind: "skip",
      reason: `Pełny eksport ${cfgName} jest niekompletny, brak albo uszkodzony plik: ${unreadable.join(", ")}.`,
    };
  }

  const signatures = input.fullExportSignatures.map((s) => s.trim()).filter(Boolean);
  if (signatures.length === 0) {
    return { kind: "skip", reason: `Pełny eksport ${cfgName} nie zawiera żadnej oferty.` };
  }

  const prefix = asariFilePrefix(cfgName);
  if (prefix && signatures.some((signature) => asariBranchOfSignature(signature) === prefix)) {
    return {
      kind: "branch",
      branch: prefix,
      reason: `Pełny eksport oddziału ${prefix} (${cfgName}): wygaszam wyłącznie oferty tego oddziału.`,
    };
  }

  const streams = [...new Set(input.prefixesOnFtp.map((p) => p.trim().toLowerCase()).filter(Boolean))];
  if (streams.length > 1) {
    return {
      kind: "skip",
      reason:
        `Na FTP leżą paczki kilku strumieni (${streams.join(", ")}), a sygnatury eksportu ${cfgName} ` +
        `nie wskazują oddziału. Nie da się ustalić, za kogo mówi ten eksport.`,
    };
  }

  return {
    kind: "integration",
    reason: `Pełny eksport ${cfgName}: jeden strumień, sygnatury bez numeru oddziału, zakres całej integracji.`,
  };
}

export function isInAsariFullExportScope(externalId: string, scope: AsariFullExportScope): boolean {
  if (scope.kind === "integration") return true;
  if (scope.kind === "branch") return asariBranchOfSignature(externalId) === scope.branch;
  return false;
}

/**
 * Null dla poprawnego XML, opis błędu dla uszkodzonego.
 *
 * Parser fast-xml-parser nie rzuca, gdy plik urywa się na granicy elementu: brak `</PACKAGE>`,
 * pusty plik albo sam nagłówek dają po cichu niepełną listę ofert. Plik złapany w trakcie
 * wgrywania wyglądałby jak eksport z mniejszą liczbą ofert, a przy pełnym eksporcie reszta
 * poszłaby do wygaszenia. Walidator łapie wszystkie te przypadki (sprawdzone na 1498 prawdziwych
 * plikach ASARI z 16.09.2026: zero fałszywych odrzuceń, około 1 ms na 50 KB).
 */
export function xmlIntegrityProblem(xml: string): string | null {
  const result = XMLValidator.validate(xml);
  if (result === true) return null;
  return `${result.err.msg} (linia ${result.err.line})`;
}
