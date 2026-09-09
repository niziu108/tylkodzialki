/**
 * Wspólne wygaszanie ofert nieobecnych w pełnym eksporcie (bezpiecznik R1).
 *
 * Wcześniej ta sama funkcja stała w czterech kopiach (domypl, asari, esticrm, locumnet) i każda
 * miała trzy problemy, niegroźne przy biurze z 50 ofertami i kosztowne przy sieci z tysiącami:
 *
 *  1. Brak hamulca. Urwany „pełny" eksport gasił całą podaż partnera — patrz mass-deactivation.ts.
 *  2. `externalId: { notIn: [...tysiące] }`. Prisma wysyła każdy identyfikator jako osobny parametr
 *     zapytania; przy kilku tysiącach ofert to zapytanie na kilkaset kilobajtów, a przy ~65 tys.
 *     parametrów Postgres po prostu odmawia. Skala docelowa (50 tys. ofert) przebija ten limit,
 *     więc porównanie robimy po naszej stronie, na zwykłym `Set`.
 *  3. Transakcja na KAŻDĄ ofertę: 4 tys. wygaszeń to 4 tys. round-tripów do Neona przez sieć,
 *     czyli kilkanaście minut trzymania połączenia i przebiegu workera. Zapis idzie partiami.
 *
 * Zachowanie merytoryczne jest bez zmian: działka dostaje status ZAKONCZONE i `endedAt`, link
 * traci `isActiveInSource`, a każda wygaszona oferta ma swój wpis w CrmSyncLog (raporty ubytków
 * i historia epizodów opierają się na tych wpisach, więc nie wolno ich zbiorczo skracać).
 */

import { prisma } from "@/lib/prisma";
import {
  assessMassDeactivation,
  readMassDeactivationLimits,
  type MassDeactivationVerdict,
} from "@/lib/crm/mass-deactivation";

/** Ile linków czytamy jednym zapytaniem przy skanowaniu podaży integracji. */
const READ_PAGE_SIZE = 1000;
/** Ile ofert wygaszamy w jednej transakcji. Kompromis: mniej round-tripów, krótka transakcja. */
const WRITE_BATCH_SIZE = 200;

export type DeactivateMissingResult = {
  /** Liczba faktycznie wygaszonych linków (0, gdy hamulec zablokował). */
  deactivated: number;
  /** True, gdy bezpiecznik wstrzymał wygaszanie. */
  blocked: boolean;
  verdict: MassDeactivationVerdict;
};

type Candidate = { id: string; dzialkaId: string; externalId: string };

export async function deactivateOffersMissingFromFullExport(params: {
  integrationId: string;
  /** externalId ofert obecnych w pełnym eksporcie. */
  seenExternalIds: Set<string>;
  /** Komunikat zapisywany przy każdej wygaszonej ofercie (per silnik). */
  message: string;
  /** Etykieta do logów na stdout workera, np. "ASARI". */
  sourceLabel: string;
}): Promise<DeactivateMissingResult> {
  const { integrationId, seenExternalIds, message, sourceLabel } = params;
  const now = new Date();

  // 1. Skan aktywnej podaży integracji z kursorem. Bez `notIn`, bez ładowania relacji Dzialka:
  //    o tym, czy trzeba ruszyć status, decyduje `updateMany` z warunkiem, a nie odczyt.
  const candidates: Candidate[] = [];
  let activeCount = 0;
  let cursor: string | undefined;

  for (;;) {
    const page = await prisma.crmOfferLink.findMany({
      where: { integrationId, isActiveInSource: true },
      select: { id: true, dzialkaId: true, externalId: true },
      orderBy: { id: "asc" },
      take: READ_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (page.length === 0) break;

    activeCount += page.length;
    for (const link of page) {
      if (!seenExternalIds.has(link.externalId)) candidates.push(link);
    }

    if (page.length < READ_PAGE_SIZE) break;
    cursor = page[page.length - 1].id;
  }

  // 2. Hamulec. Werdykt zapada na pełnych liczbach, więc skan musi się wykonać do końca.
  const verdict = assessMassDeactivation({
    activeCount,
    candidateCount: candidates.length,
    limits: readMassDeactivationLimits(),
  });

  if (!verdict.allowed) {
    console.warn(`[${sourceLabel}] BEZPIECZNIK: ${verdict.reason}`);

    // Ślad w CrmSyncLog, bo to jedyne miejsce, w które patrzy panel /admin/crm i raport ubytków.
    await prisma.crmSyncLog.create({
      data: {
        integrationId,
        action: "ERROR",
        status: "ERROR",
        message: `Wstrzymano masowe wygaszanie ofert. ${verdict.reason}`,
      },
    });

    return { deactivated: 0, blocked: true, verdict };
  }

  if (candidates.length === 0) {
    return { deactivated: 0, blocked: false, verdict };
  }

  // 3. Zapis partiami. Kolejność w transakcji jak w starym kodzie: najpierw oferta, potem link,
  //    na końcu log — dzięki temu przerwany przebieg nie zostawia logu bez wygaszonej oferty.
  let deactivated = 0;

  for (let i = 0; i < candidates.length; i += WRITE_BATCH_SIZE) {
    const batch = candidates.slice(i, i + WRITE_BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      await tx.dzialka.updateMany({
        where: { id: { in: batch.map((c) => c.dzialkaId) }, status: { not: "ZAKONCZONE" } },
        data: { status: "ZAKONCZONE", endedAt: now, crmLastSyncedAt: now },
      });

      await tx.crmOfferLink.updateMany({
        where: { id: { in: batch.map((c) => c.id) } },
        data: {
          lastImportedAt: now,
          lastSeenAt: now,
          lastDeactivatedAt: now,
          isActiveInSource: false,
        },
      });

      await tx.crmSyncLog.createMany({
        data: batch.map((c) => ({
          integrationId,
          dzialkaId: c.dzialkaId,
          offerLinkId: c.id,
          externalId: c.externalId,
          action: "DEACTIVATE" as const,
          status: "SUCCESS" as const,
          message,
        })),
      });
    });

    deactivated += batch.length;
  }

  console.log(
    `[${sourceLabel}] Wygaszono ${deactivated} ofert nieobecnych w pełnym eksporcie ` +
      `(${verdict.share.toFixed(1)}% podaży integracji).`
  );

  return { deactivated, blocked: false, verdict };
}
