/**
 * Retencja CrmSyncLog. Tabela logów importu urosła do ~10 GB przy 170 MB całej reszty bazy
 * (pomiar 2026-09-09, 1,78 mln wierszy). Powód i nowa polityka zapisu: log-policy.ts. Ten moduł
 * zajmuje się tym, co już leży w bazie, i utrzymaniem rozmiaru na dłuższą metę.
 *
 * Dwie fazy, w kolejności od najbezpieczniejszej:
 *
 *  A. Odchudzanie: `payload = NULL` we wpisach starszych niż `payloadDays`. Historia zdarzeń
 *     zostaje w całości (kto, kiedy, jaka akcja, jaki komunikat) — znika tylko kopia XML-a, której
 *     nikt nie czyta po kilkunastu dniach. Tu leży ~98% wagi tabeli.
 *
 *  B. Usuwanie wierszy rutynowych starszych niż `rowDays`: UPDATE, REACTIVATE, CREATE, DELETE
 *     ze statusem SUCCESS. ERROR i DEACTIVATE zostają BEZ względu na wiek: pierwsze to jedyny ślad
 *     po awariach parsera, drugie są czytane przy odtwarzaniu epizodów życia oferty i przy raporcie
 *     ubytków, a oba są tanie (nie mają payloadu).
 *
 * Obie fazy chodzą partiami z twardym limitem na przebieg — nigdy jednym zapytaniem na milion
 * wierszy, bo to blokuje tabelę, z której korzysta panel i import.
 *
 * Uwaga o miejscu na dysku: Postgres po UPDATE/DELETE nie oddaje przestrzeni systemowi od razu,
 * zwalnia ją do ponownego użycia. Tabela przestaje rosnąć natychmiast, a fizyczny rozmiar spada
 * dopiero po VACUUM FULL (blokuje tabelę na czas operacji — to decyzja do podjęcia świadomie,
 * poza automatem).
 */

import { prisma } from "@/lib/prisma";

export const LOG_RETENTION_DEFAULTS = {
  /** Po ilu dniach payload przestaje być potrzebny do diagnostyki. */
  payloadDays: 14,
  /** Po ilu dniach rutynowy wpis (UPDATE/CREATE/REACTIVATE/DELETE) może zniknąć. */
  rowDays: 120,
  /** Ile wierszy bierze jedna partia. */
  batchSize: 5000,
  /** Sufit na jeden przebieg, żeby zaległości schodziły stopniowo, a nie jednym uderzeniem. */
  maxPerRun: 200000,
} as const;

export type LogRetentionOptions = {
  payloadDays?: number;
  rowDays?: number;
  batchSize?: number;
  maxPerRun?: number;
  /** Bez tego liczymy tylko, ile by poszło. */
  apply?: boolean;
};

export type LogRetentionResult = {
  payloadCandidates: number;
  payloadCleared: number;
  rowCandidates: number;
  rowsDeleted: number;
  applied: boolean;
};

/** Akcje, których wiersze wolno kasować po czasie. ERROR i DEACTIVATE świadomie poza listą. */
const ROUTINE_ACTIONS = ["UPDATE", "REACTIVATE", "CREATE", "DELETE"] as const;

export function readLogRetentionOptions(
  env: Record<string, string | undefined> = process.env
): Required<Omit<LogRetentionOptions, "apply">> {
  const num = (raw: string | undefined, fallback: number, min = 1) => {
    const value = Number(raw);
    return Number.isFinite(value) && value >= min ? value : fallback;
  };

  return {
    payloadDays: num(env.CRM_LOG_PAYLOAD_DAYS, LOG_RETENTION_DEFAULTS.payloadDays),
    rowDays: num(env.CRM_LOG_RETENTION_DAYS, LOG_RETENTION_DEFAULTS.rowDays),
    batchSize: num(env.CRM_LOG_BATCH_SIZE, LOG_RETENTION_DEFAULTS.batchSize),
    maxPerRun: num(env.CRM_LOG_MAX_PER_RUN, LOG_RETENTION_DEFAULTS.maxPerRun),
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function runLogRetention(options: LogRetentionOptions = {}): Promise<LogRetentionResult> {
  const defaults = readLogRetentionOptions();
  const payloadDays = options.payloadDays ?? defaults.payloadDays;
  const rowDays = options.rowDays ?? defaults.rowDays;
  const batchSize = options.batchSize ?? defaults.batchSize;
  const maxPerRun = options.maxPerRun ?? defaults.maxPerRun;
  const apply = options.apply === true;

  const payloadCutoff = daysAgo(payloadDays);
  const rowCutoff = daysAgo(rowDays);

  // Zliczanie payloadów idzie surowym SQL-em: Prisma rozróżnia JSON null od braku wartości,
  // a `payload IS NOT NULL` mówi dokładnie to, o co chodzi.
  const payloadRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM "CrmSyncLog" WHERE payload IS NOT NULL AND "createdAt" < $1`,
    payloadCutoff
  );
  const payloadCandidates = Number(payloadRows[0]?.n ?? 0);

  const rowCandidates = await prisma.crmSyncLog.count({
    where: {
      createdAt: { lt: rowCutoff },
      status: "SUCCESS",
      action: { in: [...ROUTINE_ACTIONS] },
    },
  });

  if (!apply) {
    return { payloadCandidates, payloadCleared: 0, rowCandidates, rowsDeleted: 0, applied: false };
  }

  // Faza A: zdejmowanie payloadów. Partiami po `batchSize`, do wyczerpania limitu przebiegu.
  let payloadCleared = 0;
  while (payloadCleared < maxPerRun) {
    const cleared: number = await prisma.$executeRawUnsafe(
      `UPDATE "CrmSyncLog" SET payload = NULL
       WHERE id IN (
         SELECT id FROM "CrmSyncLog"
         WHERE payload IS NOT NULL AND "createdAt" < $1
         LIMIT $2
       )`,
      payloadCutoff,
      Math.min(batchSize, maxPerRun - payloadCleared)
    );

    if (cleared === 0) break;
    payloadCleared += cleared;
    console.log(`[CRM LOGI] Zdjęto payload z ${payloadCleared} wpisów...`);
  }

  // Faza B: usuwanie wierszy rutynowych. Osobny limit, żeby faza A nie zjadła całego przebiegu.
  let rowsDeleted = 0;
  while (rowsDeleted < maxPerRun) {
    const deleted: number = await prisma.$executeRawUnsafe(
      `DELETE FROM "CrmSyncLog"
       WHERE id IN (
         SELECT id FROM "CrmSyncLog"
         WHERE "createdAt" < $1
           AND status = 'SUCCESS'
           AND action IN ('UPDATE','REACTIVATE','CREATE','DELETE')
         LIMIT $2
       )`,
      rowCutoff,
      Math.min(batchSize, maxPerRun - rowsDeleted)
    );

    if (deleted === 0) break;
    rowsDeleted += deleted;
    console.log(`[CRM LOGI] Usunięto ${rowsDeleted} rutynowych wpisów...`);
  }

  return { payloadCandidates, payloadCleared, rowCandidates, rowsDeleted, applied: true };
}
