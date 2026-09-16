/**
 * Hamulec masowej deaktywacji ofert (bezpiecznik R1b).
 *
 * Powód: `deactivateMissingOffers()` w każdym silniku gasi WSZYSTKO, czego nie było w pliku
 * oznaczonym jako pełny eksport. Jedynym warunkiem wejścia było „plik ma co najmniej jedną ofertę".
 * Przy biurze z kilkoma ofertami to nieszkodliwe. Przy sieci franczyzowej z kilkoma tysiącami
 * działek jeden urwany eksport (timeout generatora, przerwany transfer, biuro testujące nowy
 * filtr) wygląda w naszym kodzie identycznie jak „sprzedaliśmy wszystko" i kasuje całą podaż
 * partnera w jednym przebiegu. Odbudowa to nie tylko ponowny import: oferta wraca z nowym
 * epizodem w DzialkaListingSpell, traci ciągłość historii cen i wypada z indeksu Google.
 *
 * Zasada: nagła utrata dużej części podaży JEDNEJ integracji to awaria eksportu, nie sprzedaż.
 * Rotacja rzeczywista jest powolna (mediana czasu sprzedaży działki liczona jest w miesiącach),
 * więc próg udziału odsiewa awarie, nie realny obrót.
 *
 * Ta sama logika, w innych progach, chroni już wygaszanie po bezczynności
 * (`maxSharePercent` w expireStaleOffers.ts). Tu domykamy drugą, groźniejszą drogę.
 *
 * Blokada NIE traci danych: oferty zostają aktywne, plik zostaje odnotowany, a kolejny poprawny
 * pełny eksport wykona deaktywację normalnie. Fałszywy alarm kosztuje jeden dzień nieaktualnych
 * ofert, fałszywe przepuszczenie kosztuje całą podaż partnera.
 */

export const MASS_DEACTIVATION_DEFAULTS = {
  /** Poniżej tylu ofert nie pytamy o udział — to normalna rotacja małego biura. */
  minCount: 25,
  /** Powyżej tego udziału w aktywnej podaży integracji wstrzymujemy się i czekamy na człowieka. */
  maxSharePercent: 40,
} as const;

export type MassDeactivationLimits = {
  minCount: number;
  maxSharePercent: number;
};

export type MassDeactivationVerdict = {
  allowed: boolean;
  /** Udział kandydatów do wygaszenia w aktywnej podaży integracji, w procentach (0–100). */
  share: number;
  candidateCount: number;
  activeCount: number;
  limits: MassDeactivationLimits;
  reason: string;
};

/**
 * Progi z ENV, żeby dało się je ruszyć bez deploya (worker na VPS czyta je przy starcie przebiegu).
 * Wartość spoza zakresu jest ignorowana — literówka w ENV nie może rozbroić bezpiecznika.
 */
export function readMassDeactivationLimits(
  env: Record<string, string | undefined> = process.env
): MassDeactivationLimits {
  const rawShare = Number(env.CRM_DEACTIVATION_MAX_SHARE);
  const rawMin = Number(env.CRM_DEACTIVATION_MIN_COUNT);

  return {
    maxSharePercent:
      Number.isFinite(rawShare) && rawShare > 0 && rawShare <= 100
        ? rawShare
        : MASS_DEACTIVATION_DEFAULTS.maxSharePercent,
    minCount:
      Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : MASS_DEACTIVATION_DEFAULTS.minCount,
  };
}

/**
 * Kandydaci do wygaszenia z jednej porcji aktywnych linków integracji.
 *
 * `isInScope` zawęża pełny eksport do części podaży (oddział sieci ASARI, patrz
 * asari-full-export.ts). Oferty spoza zakresu nie są kandydatami i nie wchodzą do mianownika
 * hamulca: eksport mówi tylko za swój zakres, więc udział liczymy względem niego. Bez `isInScope`
 * zakresem jest cała integracja, czyli zachowanie sprzed zmiany.
 */
export function collectMissingCandidates<T extends { externalId: string }>(
  links: T[],
  seenExternalIds: ReadonlySet<string>,
  isInScope?: (externalId: string) => boolean
): { inScopeCount: number; candidates: T[] } {
  let inScopeCount = 0;
  const candidates: T[] = [];

  for (const link of links) {
    if (isInScope && !isInScope(link.externalId)) continue;
    inScopeCount += 1;
    if (!seenExternalIds.has(link.externalId)) candidates.push(link);
  }

  return { inScopeCount, candidates };
}

export function assessMassDeactivation(params: {
  activeCount: number;
  candidateCount: number;
  limits?: MassDeactivationLimits;
}): MassDeactivationVerdict {
  const limits = params.limits ?? MASS_DEACTIVATION_DEFAULTS;
  const activeCount = Math.max(0, params.activeCount);
  const candidateCount = Math.max(0, params.candidateCount);
  const share = activeCount > 0 ? (candidateCount / activeCount) * 100 : 0;

  const verdict = { share, candidateCount, activeCount, limits };

  if (candidateCount === 0) {
    return { ...verdict, allowed: true, reason: "Brak ofert do wygaszenia." };
  }

  // Mała liczba bezwzględna przechodzi zawsze. Biuro z 6 ofertami, które sprzedało 4, ma udział
  // 66% i nie ma w tym nic podejrzanego — hamulec ma łapać skalę, nie ułamki.
  if (candidateCount <= limits.minCount) {
    return {
      ...verdict,
      allowed: true,
      reason: `Wygaszenie ${candidateCount} ofert mieści się w progu ${limits.minCount}.`,
    };
  }

  if (share > limits.maxSharePercent) {
    return {
      ...verdict,
      allowed: false,
      reason:
        `Pełny eksport pomija ${candidateCount} z ${activeCount} aktywnych ofert ` +
        `(${share.toFixed(1)}%, próg ${limits.maxSharePercent}%). To wygląda na urwany eksport, ` +
        `nie na sprzedaż — nic nie wygaszam, oferty zostają aktywne. Sprawdź plik i podnieś ` +
        `CRM_DEACTIVATION_MAX_SHARE albo uruchom import ponownie po poprawnej paczce.`,
    };
  }

  return {
    ...verdict,
    allowed: true,
    reason:
      `Wygaszenie ${candidateCount} z ${activeCount} ofert (${share.toFixed(1)}%) ` +
      `mieści się w progu ${limits.maxSharePercent}%.`,
  };
}
