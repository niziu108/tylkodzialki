/**
 * Retencja tabeli CrmSyncLog. Domyślnie TYLKO raportuje — nic nie zmienia bez `--apply`.
 *
 * Po co: przy 7,3 tys. ofert tabela logów ważyła 10 GB (98% całej bazy), bo do każdego wpisu
 * UPDATE dokładany był pełny XML oferty. Nowa polityka zapisu (log-policy.ts) zatrzymuje wzrost
 * od strony kodu, ten skrypt sprząta to, co już leży.
 *
 * Uruchomienie:
 *   npm run crm:logi                 raport, ile poszłoby do sprzątnięcia
 *   npm run crm:logi -- --apply      sprzątanie (limit z CRM_LOG_MAX_PER_RUN, domyślnie 200 tys.)
 *   npm run crm:logi -- --apply --max 50000
 *
 * Progi (ENV albo argumenty): --payload-dni (domyślnie 14), --dni (retencja wierszy, domyślnie 120).
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function liczba(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { runLogRetention, readLogRetentionOptions } = await import("../src/lib/crm/log-retention");

  const apply = process.argv.includes("--apply");
  const options = {
    apply,
    payloadDays: liczba(arg("--payload-dni")),
    rowDays: liczba(arg("--dni")),
    maxPerRun: liczba(arg("--max")),
  };

  const progi = readLogRetentionOptions();
  console.log("RETENCJA LOGÓW CRM");
  console.log(
    `  progi: payload starszy niż ${options.payloadDays ?? progi.payloadDays} dni, ` +
      `wiersze rutynowe starsze niż ${options.rowDays ?? progi.rowDays} dni, ` +
      `limit przebiegu ${options.maxPerRun ?? progi.maxPerRun}`
  );

  const przed = await rozmiar(prisma);
  console.log(`  tabela przed: ${przed}\n`);

  const wynik = await runLogRetention(options);

  console.log("\nDO SPRZĄTNIĘCIA");
  console.log(`  wpisów z payloadem ponad próg: ${wynik.payloadCandidates}`);
  console.log(`  rutynowych wierszy ponad próg: ${wynik.rowCandidates}`);

  if (!wynik.applied) {
    console.log("\nTryb raportu. Nic nie zmieniono. Uruchom z --apply, żeby wykonać.");
  } else {
    console.log("\nWYKONANO");
    console.log(`  zdjęto payload: ${wynik.payloadCleared}`);
    console.log(`  usunięto wierszy: ${wynik.rowsDeleted}`);
    console.log(`  tabela po: ${await rozmiar(prisma)}`);
    console.log(
      "\n  Uwaga: Postgres zwalnia miejsce do ponownego użycia, ale rozmiar pliku spada dopiero\n" +
        "  po VACUUM FULL \"CrmSyncLog\" (blokuje tabelę na czas operacji)."
    );
  }

  await prisma.$disconnect();
}

async function rozmiar(prisma: { $queryRawUnsafe: (q: string) => Promise<{ r: string }[]> }) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT pg_size_pretty(pg_total_relation_size('"CrmSyncLog"')) AS r`
  );
  return rows[0]?.r ?? "?";
}

main().catch((error) => {
  console.error("Retencja logów nie przeszła:", error);
  process.exit(1);
});
