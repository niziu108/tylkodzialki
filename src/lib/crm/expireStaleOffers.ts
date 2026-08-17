import { CrmProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Wygaszanie ofert po bezczynności — NARZĘDZIE DIAGNOSTYCZNE, nie automat.
 *
 * WAŻNE, zanim ktokolwiek puści to z `--apply`: właściwym sygnałem znikania ofert Galactiki są
 * znaczniki `<oferta_usun>`, które biura przysyłają w każdej paczce (naprawione w domypl-sync.ts,
 * zaległości nadrabia scripts/crm-usun-backfill.ts). Cisza w eksporcie różnicowym znaczy
 * „biuro nic nie zmieniło", a nie „sprzedane" — sprawdzone na żywym przypadku: oferta LNKF-GS-276
 * milczała 103 dni mimo 84 paczek po ostatnim wystąpieniu i dalej wisiała na stronie biura.
 * Ten moduł zostaje do raportowania: pokazuje, komu podaż zastyga i gdzie eksport wygląda na zepsuty.
 * Pełny opis: docs/CRM_WYGASZANIE_OFERT.md.
 *
 * Problem: `deactivateMissingOffers()` (bezpiecznik R1 w domypl-sync.ts) wymaga pliku z nagłówkiem
 * `zawartosc_pliku = pełny`. Galactica przysyła praktycznie same różnicowe (6 plików pełnych na 6828),
 * więc dla tych biur bezpiecznik nigdy się nie odpala i sprzedana działka wisi na portalu bez końca.
 * IMOX tego nie ma, bo dosyła `<oferta_usun>` (patrz `deactivateExternalIds`).
 *
 * Sygnał zastępczy: `CrmOfferLink.lastSeenAt`, czyli ostatnie wystąpienie oferty w jakimkolwiek
 * przetworzonym pliku. Przy eksporcie różnicowym odświeża się tylko wtedy, gdy biuro ruszy ofertę,
 * więc „cisza" nie jest dowodem sprzedaży — próg musi być na tyle długi, żeby normalne
 * „biuro nic nie zmieniało" się w niego nie łapało.
 *
 * Kalibracja na danych produkcyjnych (2026-08-17, okno obserwacji 116 dni, 10 123 przerwy między
 * kolejnymi wystąpieniami tej samej oferty Galactiki):
 *   cisza >=30d, po której oferta wróciła: 665 przypadków (6,57%)
 *   cisza >=45d: 371 (3,66%)
 *   cisza >=60d: 115 (1,14%)
 *   cisza >=75d:  56 (0,55%)
 *   cisza >=90d:   5 (0,05%)   <- stąd domyślny próg
 * Przy 90 dniach fałszywe wygaszenie to ~1 na 2000 przerw, a i ono samo się naprawia: gdy oferta
 * wróci w kolejnym pliku, `processOffer` widzi status ZAKONCZONE i robi REACTIVATE.
 *
 * Uwaga na okno obserwacji: dane sięgają 2026-04-23, więc przerw dłuższych niż ~116 dni nie da się
 * jeszcze zaobserwować. Próg warto zweryfikować ponownie (tryb `--kalibracja`), gdy historia urośnie.
 *
 * Bezpieczniki, bo sam czas to za mało:
 *  1. kanał musi żyć — integracja z plikiem starszym niż `feedMaxAgeDays` jest pomijana w całości
 *     (padnięty FTP wygląda dokładnie tak samo jak „wszystko sprzedane"),
 *  2. po ostatnim wystąpieniu oferty musiało przyjść co najmniej `minFilesSince` plików — dowód,
 *     że kanał mówił i o tej ofercie milczał,
 *  3. hamulec udziału — jeśli w danej integracji przestarzałe jest więcej niż `maxSharePercent`
 *     podaży, to wygląda na awarię eksportu, nie na sprzedaż; integracja idzie do decyzji ręcznej.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRE_STALE_DEFAULTS = {
  days: 90,
  feedMaxAgeDays: 14,
  minFilesSince: 5,
  maxSharePercent: 50,
} as const;

export type ExpireStaleOptions = {
  /** Ile dni ciszy kwalifikuje ofertę do wygaszenia. */
  days?: number;
  /** Provider do przejrzenia. `null` = wszystkie. Domyślnie GALACTICA. */
  provider?: CrmProvider | null;
  /** Ograniczenie do jednej integracji. */
  integrationId?: string;
  /** Integracja bez świeżego pliku jest pomijana (padnięty kanał ≠ sprzedane oferty). */
  feedMaxAgeDays?: number;
  /** Ile plików musiało przyjść po ostatnim wystąpieniu oferty. */
  minFilesSince?: number;
  /** Maksymalny udział przestarzałych ofert w podaży integracji (w %). Powyżej — pomijamy. */
  maxSharePercent?: number;
  /** Twardy limit wygaszeń na przebieg (globalnie). */
  limit?: number;
  /** Bez tego skrypt tylko raportuje. */
  apply?: boolean;
};

export type StaleOffer = {
  linkId: string;
  dzialkaId: string;
  externalId: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  staleDays: number;
  filesSince: number;
};

export type IntegrationReport = {
  integrationId: string;
  name: string;
  provider: CrmProvider;
  activeOffers: number;
  /** Oferty starsze niż próg (przed bezpiecznikami). */
  staleOffers: number;
  /** Oferty, które faktycznie idą do wygaszenia. */
  toExpire: StaleOffer[];
  /** Powód pominięcia całej integracji, jeśli pominięta. */
  skipReason: string | null;
  lastFileDaysAgo: number | null;
  /** Rozkład wieku lastSeenAt: klucze to górne granice koszyków w dniach. */
  histogram: Record<string, number>;
};

export type ExpireStaleReport = {
  options: Required<Omit<ExpireStaleOptions, "integrationId" | "limit" | "provider">> & {
    provider: CrmProvider | null;
    integrationId: string | null;
    limit: number | null;
  };
  integrations: IntegrationReport[];
  totalActive: number;
  totalStale: number;
  totalToExpire: number;
  expired: number;
};

const HISTOGRAM_EDGES = [7, 14, 30, 45, 60, 90, 120, 180, 365] as const;

function histogramOf(ages: number[]): Record<string, number> {
  const result: Record<string, number> = {};
  let previous = 0;
  for (const edge of HISTOGRAM_EDGES) {
    result[`${previous}-${edge}`] = ages.filter((age) => age >= previous && age < edge).length;
    previous = edge;
  }
  result[`${previous}+`] = ages.filter((age) => age >= previous).length;
  return result;
}

/** Ile plików integracji przetworzono po podanej dacie. Lista musi być posortowana rosnąco. */
function countFilesAfter(sortedTimestamps: number[], after: number): number {
  let low = 0;
  let high = sortedTimestamps.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortedTimestamps[mid] <= after) low = mid + 1;
    else high = mid;
  }
  return sortedTimestamps.length - low;
}

export async function expireStaleCrmOffers(
  options: ExpireStaleOptions = {}
): Promise<ExpireStaleReport> {
  const days = options.days ?? EXPIRE_STALE_DEFAULTS.days;
  const feedMaxAgeDays = options.feedMaxAgeDays ?? EXPIRE_STALE_DEFAULTS.feedMaxAgeDays;
  const minFilesSince = options.minFilesSince ?? EXPIRE_STALE_DEFAULTS.minFilesSince;
  const maxSharePercent = options.maxSharePercent ?? EXPIRE_STALE_DEFAULTS.maxSharePercent;
  const provider = options.provider === undefined ? CrmProvider.GALACTICA : options.provider;
  const apply = options.apply ?? false;
  const limit = options.limit ?? null;

  if (days < 30) {
    // Poniżej 30 dni fałszywe wygaszenia przestają być marginesem (6,6% przerw w danych
    // produkcyjnych), a każde z nich to działka zniknięta kupującemu sprzed nosa.
    throw new Error("Próg poniżej 30 dni jest niebezpieczny — cisza w eksporcie różnicowym to norma.");
  }

  const now = Date.now();
  const cutoff = now - days * DAY_MS;
  const feedCutoff = now - feedMaxAgeDays * DAY_MS;

  const integrations = await prisma.crmIntegration.findMany({
    where: {
      ...(provider ? { provider } : {}),
      ...(options.integrationId ? { id: options.integrationId } : {}),
    },
    select: { id: true, name: true, provider: true, isActive: true },
    orderBy: { name: "asc" },
  });

  const reports: IntegrationReport[] = [];
  let remaining = limit;
  let expired = 0;

  for (const integration of integrations) {
    const links = await prisma.crmOfferLink.findMany({
      where: {
        integrationId: integration.id,
        isActiveInSource: true,
        dzialka: { status: "AKTYWNE" },
      },
      select: {
        id: true,
        externalId: true,
        lastSeenAt: true,
        dzialka: {
          select: { id: true, tytul: true, cenaPln: true, powierzchniaM2: true },
        },
      },
    });

    if (links.length === 0) continue;

    const files = await prisma.crmProcessedFile.findMany({
      where: { integrationId: integration.id, status: "SUCCESS" },
      select: { processedAt: true },
      orderBy: { processedAt: "asc" },
    });
    const fileTimestamps = files.map((file) => file.processedAt.getTime());
    const lastFileAt = fileTimestamps.length ? fileTimestamps[fileTimestamps.length - 1] : null;
    const lastFileDaysAgo = lastFileAt === null ? null : Math.floor((now - lastFileAt) / DAY_MS);

    const ages = links
      .filter((link) => link.lastSeenAt)
      .map((link) => Math.floor((now - link.lastSeenAt!.getTime()) / DAY_MS));

    // Kandydaci: cisza dłuższa niż próg + dowód, że kanał w tym czasie mówił.
    const candidates: StaleOffer[] = links
      .filter((link) => link.lastSeenAt && link.lastSeenAt.getTime() < cutoff)
      .map((link) => ({
        linkId: link.id,
        dzialkaId: link.dzialka.id,
        externalId: link.externalId,
        tytul: link.dzialka.tytul,
        cenaPln: link.dzialka.cenaPln,
        powierzchniaM2: link.dzialka.powierzchniaM2,
        staleDays: Math.floor((now - link.lastSeenAt!.getTime()) / DAY_MS),
        filesSince: countFilesAfter(fileTimestamps, link.lastSeenAt!.getTime()),
      }))
      .sort((a, b) => b.staleDays - a.staleDays);

    const withProof = candidates.filter((offer) => offer.filesSince >= minFilesSince);
    const sharePercent = (withProof.length / links.length) * 100;

    let skipReason: string | null = null;
    if (!integration.isActive) {
      skipReason = "integracja wyłączona — źródło nie ma jak potwierdzić ofert";
    } else if (lastFileAt === null) {
      skipReason = "brak jakiegokolwiek przetworzonego pliku";
    } else if (lastFileAt < feedCutoff) {
      skipReason = `kanał milczy od ${lastFileDaysAgo} dni (próg ${feedMaxAgeDays}) — to awaria FTP, nie sprzedaż`;
    } else if (withProof.length > 0 && sharePercent > maxSharePercent) {
      skipReason = `przestarzałe to ${sharePercent.toFixed(0)}% podaży biura (próg ${maxSharePercent}%) — wygląda na awarię eksportu, decyzja ręczna`;
    }

    let toExpire = skipReason ? [] : withProof;
    if (remaining !== null && toExpire.length > remaining) {
      toExpire = toExpire.slice(0, Math.max(0, remaining));
    }

    reports.push({
      integrationId: integration.id,
      name: integration.name,
      provider: integration.provider,
      activeOffers: links.length,
      staleOffers: candidates.length,
      toExpire,
      skipReason,
      lastFileDaysAgo,
      histogram: histogramOf(ages),
    });

    if (!apply || toExpire.length === 0) continue;

    for (const offer of toExpire) {
      const deactivatedAt = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.dzialka.update({
          where: { id: offer.dzialkaId },
          data: {
            status: "ZAKONCZONE",
            endedAt: deactivatedAt,
            crmLastSyncedAt: deactivatedAt,
          },
        });

        // Świadomie NIE ruszamy `lastSeenAt` — to jedyny ślad, kiedy źródło ostatnio potwierdziło
        // ofertę, i przyda się przy weryfikacji progu. `isActiveInSource=false` i tak wyklucza
        // ofertę z kolejnych przebiegów.
        await tx.crmOfferLink.update({
          where: { id: offer.linkId },
          data: { lastDeactivatedAt: deactivatedAt, isActiveInSource: false },
        });

        await tx.crmSyncLog.create({
          data: {
            integrationId: integration.id,
            dzialkaId: offer.dzialkaId,
            offerLinkId: offer.linkId,
            externalId: offer.externalId,
            action: "DEACTIVATE",
            status: "SUCCESS",
            message: `Oferta wygaszona po ${offer.staleDays} dniach bez potwierdzenia w eksporcie CRM (próg ${days} dni, w tym czasie ${offer.filesSince} plików z tego źródła). Wróci sama, jeśli pojawi się w kolejnym pliku.`,
          },
        });
      });

      expired += 1;
      if (remaining !== null) remaining -= 1;
    }
  }

  return {
    options: {
      days,
      feedMaxAgeDays,
      minFilesSince,
      maxSharePercent,
      apply,
      provider,
      integrationId: options.integrationId ?? null,
      limit,
    },
    integrations: reports,
    totalActive: reports.reduce((sum, report) => sum + report.activeOffers, 0),
    totalStale: reports.reduce((sum, report) => sum + report.staleOffers, 0),
    totalToExpire: reports.reduce((sum, report) => sum + report.toExpire.length, 0),
    expired,
  };
}
