/**
 * Rozstrzyganie sprzecznych sygnałów w obrębie jednego przebiegu importu.
 *
 * Problem, który to naprawia: ASARI i EstiCRM zostawiają na FTP pełny eksport ORAZ wszystkie
 * kolejne paczki przyrostowe, więc każdy przebieg czyta tę samą ofertę wielokrotnie — czasem
 * jako żywą ofertę, a czasem w sekcji DELETE. Wcześniej silniki zbierały wszystkie DELETE do
 * jednego zbioru i gasiły nimi oferty PO imporcie, bez patrzenia, który plik jest nowszy.
 * Efekt na produkcji (2026-08-17): 128 ofert w pętli REACTIVATE -> DELETE co 2 h, w tym oferty
 * żywe, wystawione ponownie po usunięciu (np. 2090/13397/OGS: 16 h ukryta przed kupującym,
 * odblokowała się dopiero, gdy stara paczka z DELETE wypadła z FTP przy sprzątaniu).
 *
 * Reguła: dla danego externalId liczy się NAJNOWSZY sygnał z przebiegu, mierzony datą
 * modyfikacji pliku, z którego pochodzi. Oferta z paczki nowszej niż DELETE ma zostać
 * zaimportowana, a stary DELETE zignorowany. Odwrotnie — oferta z paczki starszej niż DELETE
 * nie jest w ogóle importowana, co przy okazji oszczędza pełny re-upload zdjęć do R2 tuż
 * przed wygaszeniem.
 *
 * Remis (ten sam plik albo feed bez dat modyfikacji) rozstrzygamy na korzyść DELETE — to
 * zachowanie sprzed poprawki, więc feed bez dat nie zmienia działania silnika.
 */

export type OfferSignal<T> = {
  externalId: string;
  offer: T;
  /** Data modyfikacji pliku źródłowego (ms). Brak daty = 0. */
  fileAt: number;
};

export type DeleteSignal = {
  externalId: string;
  fileAt: number;
};

export type ResolvedFeedSignals<T> = {
  /** Oferty do zaimportowania: najnowsza wersja per externalId, bez tych ubitych nowszym DELETE. */
  offers: T[];
  /** externalId do wygaszenia: DELETE nie starszy niż ostatnie wystąpienie oferty. */
  deletedExternalIds: string[];
  /** DELETE pominięte, bo oferta wróciła w nowszej paczce. Do logu diagnostycznego. */
  ignoredDeletes: string[];
};

/**
 * @param isSameOrNewer  wybór treści oferty przy wielu wystąpieniach (istniejąca logika silnika,
 *                       oparta na externalUpdatedAt) — decyduje, KTÓRA wersja jedzie do bazy.
 *                       O tym, CZY oferta jedzie, decyduje data pliku.
 */
export function resolveFeedSignals<T>(
  offerSignals: OfferSignal<T>[],
  deleteSignals: DeleteSignal[],
  isSameOrNewer: (candidate: T, current: T) => boolean
): ResolvedFeedSignals<T> {
  const bestOffer = new Map<string, { offer: T; latestFileAt: number }>();

  for (const signal of offerSignals) {
    const current = bestOffer.get(signal.externalId);

    if (!current) {
      bestOffer.set(signal.externalId, { offer: signal.offer, latestFileAt: signal.fileAt });
      continue;
    }

    bestOffer.set(signal.externalId, {
      // Treść: najnowsza wersja oferty wg externalUpdatedAt.
      offer: isSameOrNewer(signal.offer, current.offer) ? signal.offer : current.offer,
      // Wiek: najpóźniejsze wystąpienie w plikach — to ono odpowiada na pytanie,
      // czy źródło potwierdziło ofertę już po DELETE.
      latestFileAt: Math.max(current.latestFileAt, signal.fileAt),
    });
  }

  const latestDeleteAt = new Map<string, number>();

  for (const signal of deleteSignals) {
    const current = latestDeleteAt.get(signal.externalId);
    if (current === undefined || signal.fileAt > current) {
      latestDeleteAt.set(signal.externalId, signal.fileAt);
    }
  }

  const offers: T[] = [];
  const killedByNewerDelete = new Set<string>();

  for (const [externalId, entry] of bestOffer) {
    const deleteAt = latestDeleteAt.get(externalId);

    if (deleteAt !== undefined && deleteAt >= entry.latestFileAt) {
      killedByNewerDelete.add(externalId);
      continue;
    }

    offers.push(entry.offer);
  }

  const deletedExternalIds: string[] = [];
  const ignoredDeletes: string[] = [];

  for (const [externalId] of latestDeleteAt) {
    const entry = bestOffer.get(externalId);

    if (entry && !killedByNewerDelete.has(externalId)) {
      // Oferta wróciła w nowszej paczce — stary DELETE jest nieaktualny.
      ignoredDeletes.push(externalId);
      continue;
    }

    deletedExternalIds.push(externalId);
  }

  return { offers, deletedExternalIds, ignoredDeletes };
}
