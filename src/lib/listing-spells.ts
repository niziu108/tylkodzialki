// Rekoncyliator epizodów życia ofert (DzialkaListingSpell).
//
// Po co osobny mechanizm zamiast zapisu w silnikach importu: żeby statystyka nie miała żadnej
// możliwości wywrócenia importu 126 biur. Rekoncyliator tylko czyta bieżący stan ofert i dopisuje
// to, czego w historii brakuje. Jest idempotentny, więc może biec po każdym przebiegu workera,
// z crona i z ręki, i nigdy nie zdubluje epizodu.
//
// Skąd wie o zamknięciu, którego nie widział na żywo: reaktywacja oferty przestawia
// `Dzialka.publishedAt` na teraz i czyści `endedAt`. Jeśli otwarty epizod ma starszy `startedAt`
// niż bieżące `publishedAt`, to znaczy, że oferta w międzyczasie zeszła i wróciła. Taki koniec
// datujemy na `CrmOfferLink.lastDeactivatedAt` i oznaczamy jako niepewny.

import { prisma } from "@/lib/prisma";
import type { CrmProvider, DzialkaSourceType, SpellEndReason } from "@prisma/client";

// Dzień, od którego sygnał `<oferta_usun>` działa poprawnie dla wszystkich silników (naprawa
// bramki Galactiki, commit 1bfc10e). Zamknięcia sprzed tej daty to zaległa fala, nie pomiar rynku.
export const SPELL_TRUSTED_FROM = new Date("2026-08-18T00:00:00.000Z");

// Ile czasu po pierwszym pliku z danego CRM-u oferta jest traktowana jako „zastana", czyli taka,
// która wisiała u biura nie wiadomo jak długo przed podłączeniem feedu. Jej wiek jest zaniżony.
const IMPORT_GRACE_MS = 24 * 60 * 60 * 1000;

// Epizod krótszy niż doba to praktycznie zawsze artefakt kanału, a nie sprzedaż: dublet w paczce,
// korekta oferty przez biuro, albo oferta wystawiona i cofnięta tego samego dnia. Zostaje w bazie
// (bo to prawda o tym, co przyszło feedem), ale nie wchodzi do median rynkowych.
export const MIN_SPELL_HOURS = 24;

export type ReconcileResult = {
  opened: number;
  closed: number;
  reopened: number;
  scanned: number;
  odrzuconeArtefakty: number;
};

export async function reconcileListingSpells(): Promise<ReconcileResult> {
  const [dzialki, spells, links, firstFiles, expiredIds] = await Promise.all([
    prisma.dzialka.findMany({
      select: {
        id: true,
        status: true,
        publishedAt: true,
        endedAt: true,
        expiresAt: true,
        cenaPln: true,
        powierzchniaM2: true,
        sourceType: true,
      },
    }),
    prisma.dzialkaListingSpell.findMany({
      select: { id: true, dzialkaId: true, startedAt: true, endedAt: true },
      orderBy: { startedAt: "asc" },
    }),
    prisma.crmOfferLink.findMany({
      select: {
        dzialkaId: true,
        createdAt: true,
        lastDeactivatedAt: true,
        integrationId: true,
        integration: { select: { provider: true } },
      },
    }),
    prisma.crmProcessedFile.groupBy({
      by: ["integrationId"],
      where: { status: "SUCCESS" },
      _min: { processedAt: true },
    }),
    // Zamknięcia zrobione naszym progiem bezczynności, a nie sygnałem ze źródła.
    prisma.crmSyncLog.findMany({
      where: { action: "DEACTIVATE", message: { contains: "bez potwierdzenia w eksporcie" } },
      select: { dzialkaId: true },
      distinct: ["dzialkaId"],
    }),
  ]);

  const lastSpell = new Map<string, (typeof spells)[number]>();
  for (const s of spells) lastSpell.set(s.dzialkaId, s); // posortowane rosnąco, zostaje najnowszy

  const integrationStart = new Map<string, number>();
  for (const f of firstFiles) {
    if (f._min.processedAt) integrationStart.set(f.integrationId, f._min.processedAt.getTime());
  }

  const linkOf = new Map<string, (typeof links)[number]>();
  for (const l of links) if (!linkOf.has(l.dzialkaId)) linkOf.set(l.dzialkaId, l);

  const expiredByThreshold = new Set(
    expiredIds.map((e) => e.dzialkaId).filter((id): id is string => Boolean(id)),
  );

  const toCreate: Array<{
    dzialkaId: string;
    startedAt: Date;
    endedAt: Date | null;
    cenaStart: number;
    cenaEnd: number | null;
    powierzchniaM2: number;
    endReason: SpellEndReason | null;
    provider: CrmProvider | null;
    sourceType: DzialkaSourceType;
    reliable: boolean;
  }> = [];
  const toClose: Array<{
    id: string;
    endedAt: Date;
    cenaEnd: number;
    endReason: SpellEndReason;
    reliable: boolean;
  }> = [];

  let reopened = 0;

  for (const d of dzialki) {
    const link = linkOf.get(d.id);
    const provider = link?.integration.provider ?? null;

    // Oferta zastana przy podłączeniu feedu: jej `publishedAt` to data naszego importu,
    // a nie wejścia na rynek. Wiek jest zaniżony, więc do median się nie nadaje.
    const start = link ? integrationStart.get(link.integrationId) : undefined;
    const zastana =
      start !== undefined && link !== undefined
        ? link.createdAt.getTime() <= start + IMPORT_GRACE_MS
        : false;

    const reasonFor = (endedAt: Date): SpellEndReason => {
      if (expiredByThreshold.has(d.id)) return "WYGASZONA_PROGIEM";
      if (d.sourceType !== "MANUAL") return "ZNIKLA_ZE_ZRODLA";
      if (d.expiresAt && endedAt.getTime() >= d.expiresAt.getTime() - 60_000) return "WYGASLA";
      return "RECZNIE";
    };
    const trusted = (endedAt: Date) => !zastana && endedAt >= SPELL_TRUSTED_FROM;

    const base = {
      dzialkaId: d.id,
      cenaStart: d.cenaPln,
      powierzchniaM2: d.powierzchniaM2,
      provider,
      sourceType: d.sourceType,
    };

    const last = lastSpell.get(d.id);

    if (!last) {
      if (d.status === "ZAKONCZONE" && d.endedAt) {
        toCreate.push({
          ...base,
          startedAt: d.publishedAt,
          endedAt: d.endedAt,
          cenaEnd: d.cenaPln,
          endReason: reasonFor(d.endedAt),
          reliable: trusted(d.endedAt),
        });
      } else {
        toCreate.push({
          ...base,
          startedAt: d.publishedAt,
          endedAt: null,
          cenaEnd: null,
          endReason: null,
          reliable: true,
        });
      }
      continue;
    }

    if (last.endedAt === null) {
      if (d.status === "ZAKONCZONE" && d.endedAt) {
        toClose.push({
          id: last.id,
          endedAt: d.endedAt,
          cenaEnd: d.cenaPln,
          endReason: reasonFor(d.endedAt),
          reliable: trusted(d.endedAt),
        });
        continue;
      }

      // Oferta znowu aktywna, ale z nowszą datą publikacji: w międzyczasie zeszła i wróciła.
      if (d.publishedAt.getTime() > last.startedAt.getTime() + 60_000) {
        const koniec = link?.lastDeactivatedAt ?? d.publishedAt;
        const bezpiecznyKoniec = koniec > last.startedAt ? koniec : d.publishedAt;
        toClose.push({
          id: last.id,
          endedAt: bezpiecznyKoniec,
          cenaEnd: d.cenaPln,
          endReason: reasonFor(bezpiecznyKoniec),
          reliable: false, // koniec wywnioskowany, nie zaobserwowany
        });
        toCreate.push({
          ...base,
          startedAt: d.publishedAt,
          endedAt: null,
          cenaEnd: null,
          endReason: null,
          reliable: true,
        });
        reopened += 1;
      }
      continue;
    }

    // Ostatni epizod domknięty, a oferta znów wisi: zaczyna się nowy epizod.
    if (d.status === "AKTYWNE" && d.publishedAt.getTime() > last.endedAt.getTime()) {
      toCreate.push({
        ...base,
        startedAt: d.publishedAt,
        endedAt: null,
        cenaEnd: null,
        endReason: null,
        reliable: true,
      });
      reopened += 1;
    }
  }

  // skipDuplicates: gdyby dwa przebiegi weszły na siebie, unikat (dzialkaId, startedAt) wygrywa.
  for (let i = 0; i < toCreate.length; i += 500) {
    await prisma.dzialkaListingSpell.createMany({
      data: toCreate.slice(i, i + 500),
      skipDuplicates: true,
    });
  }

  for (const c of toClose) {
    await prisma.dzialkaListingSpell.update({
      where: { id: c.id },
      data: {
        endedAt: c.endedAt,
        cenaEnd: c.cenaEnd,
        endReason: c.endReason,
        reliable: c.reliable,
      },
    });
  }

  // Korekta wiarygodności, idempotentna: epizody krótsze niż doba wypadają z median. Robimy to
  // jednym UPDATE zamiast w pętli wyżej, żeby objąć też epizody zapisane wcześniejszymi przebiegami.
  const odrzucone = await prisma.$executeRaw`
    UPDATE "DzialkaListingSpell"
    SET reliable = false
    WHERE "endedAt" IS NOT NULL
      AND reliable = true
      AND "endedAt" - "startedAt" < (${MIN_SPELL_HOURS}::int * interval '1 hour')`;

  return {
    opened: toCreate.length,
    closed: toClose.length,
    reopened,
    scanned: dzialki.length,
    odrzuconeArtefakty: odrzucone,
  };
}
