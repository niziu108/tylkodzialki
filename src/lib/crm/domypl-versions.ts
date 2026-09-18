/**
 * Wersje tej samej oferty w feedach DOMY.PL i sygnały usunięcia z tej samej paczki.
 *
 * Galactica przy kolejnych zrzutach podbija licznik wersji w atrybucie `id` oferty:
 * AKM-GS-55571-18 → -19 → -20. Dla unikatu (integrationId, externalId) to był nowy byt,
 * więc zamiast aktualizacji powstawała kolejna kopia tej samej działki. Do 2026-08 uzbierało
 * się tak 1406 duplikatów w 17 biurach (patrz scripts/crm-dedup-galactica.ts). Silnik przepina
 * link na nowe id w processOffer (findLinkByVersionedId w domypl-sync.ts).
 *
 * Ucinamy wyłącznie sufiks wersji, nigdy numeru oferty, dlatego wzorzec wymaga, żeby po
 * obcięciu został pełny numer typu „…GS-<cyfry>”:
 *   GS-28954      → brak dopasowania (to już jest numer bazowy, nie wersja)
 *   GS-28954-1    → GS-28954
 *   AKM-GS-55571-18 → AKM-GS-55571
 */

const VERSIONED_EXTERNAL_ID = /^(.*G[SW]-\d+)-\d+$/i;

export function baseExternalId(externalId: string): string | null {
  return externalId.match(VERSIONED_EXTERNAL_ID)?.[1] ?? null;
}

/**
 * Czy link o danym externalId przejmie któraś z działek obecnych w paczce jako swoją poprzednią
 * wersję. Ta sama reguła co findLinkByVersionedId: wersja GS-28954-2 przejmuje GS-28954 i każdą
 * inną wersję GS-28954-N. Numer bez wersji nie przejmuje niczego poza sobą (processOffer tworzy
 * wtedy nowy link), więc stara wersja ma zniknąć jak dotąd. Stan z 17.09.2026: zero aktywnych
 * rodzin wersji z więcej niż jednym linkiem, więc reguła nie chroni żadnego duplikatu.
 */
export function versionTakeoverMatcher(presentLandExternalIds: Iterable<string>): (externalId: string) => boolean {
  const versionedBases = new Set<string>();
  for (const externalId of presentLandExternalIds) {
    const base = baseExternalId(externalId);
    if (base) versionedBases.add(base);
  }

  return (externalId) => versionedBases.has(baseExternalId(externalId) ?? externalId);
}

/**
 * Które `<oferta_usun>` z paczki wykonać.
 *
 * Galactica używa `<oferta_usun>` także w protokole aktualizacji: kasuje starą wersję
 * (LER-GS-3541-1) i w tej samej paczce przysyła nową (LER-GS-3541-2). Link przepina się na nowe id
 * dopiero po udanym zapisie oferty, więc gdy zapis nowej wersji rzucił (awaria bazy albo R2) albo
 * nowa wersja odpadła na walidacji danych, usunięcie starej wersji gasiło żywą działkę.
 *
 * Reguła: usunięcie pomijamy, gdy w tej samej paczce jest działka o tym samym id albo nowa wersja,
 * która przejmuje usuwaną (versionTakeoverMatcher), poprawna albo odrzucona za brak ceny,
 * powierzchni czy lokalizacji. Wynik nie zależy od zapisu do bazy. Oferta odrzucona za typ
 * (nie działka) nie chroni przed usunięciem: skoro nie jest już działką, nasza działka ma zniknąć.
 */
export function deletesToApply(
  deletedExternalIds: readonly string[],
  presentLandExternalIds: Iterable<string>
): string[] {
  const present = new Set(presentLandExternalIds);
  const takenOverByPresentVersion = versionTakeoverMatcher(present);

  return deletedExternalIds.filter(
    (externalId) => !present.has(externalId) && !takenOverByPresentVersion(externalId)
  );
}
