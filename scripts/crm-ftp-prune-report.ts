import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import path from "path";
import * as ftp from "basic-ftp";
import { prisma } from "../src/lib/prisma";
import { wildcardToRegExp } from "../src/lib/crm/feed-batching";
import {
  planFeedPrune,
  readPrunePolicyFromEnv,
  type PrunePolicy,
  type RemoteFeedFile,
} from "../src/lib/crm/feed-pruning";

// RAPORT auto-czyszczenia drop-zone FTP. Domyślnie NIC nie kasuje — łączy się z FTP tylko po listę
// plików i pokazuje, co skasowałby silnik przy danej polityce. Liczy tą samą funkcją planFeedPrune,
// której używa domypl-sync, więc podgląd zgadza się z rzeczywistością co do pliku.
//
// Użycie:
//   npm run crm:prune:report                        # polityka z env (domyślnie: bez pełnego nie ruszamy)
//   npm run crm:prune:report -- --with-full         # symuluj WŁĄCZONE sprzątanie u biur bez pełnego
//   npm run crm:prune:report -- --integration <id>  # jedno biuro
//
// Tryb kanarka (jedyna ścieżka, którą ten skrypt kasuje cokolwiek):
//   npm run crm:prune:report -- --with-full --integration <id> --apply
//
// --apply wymaga wskazania konkretnej integracji. Świadomie: przed włączeniem sprzątania dla
// wszystkich biur chcemy zobaczyć efekt na jednym i sprawdzić, że kolejny import przechodzi czysto.

const SIMULATE_WITHOUT_FULL = process.argv.includes("--with-full");
const APPLY = process.argv.includes("--apply");
const INTEGRATION_ARG_INDEX = process.argv.indexOf("--integration");
const ONLY_INTEGRATION_ID =
  INTEGRATION_ARG_INDEX >= 0 ? process.argv[INTEGRATION_ARG_INDEX + 1] : null;

if (APPLY && !ONLY_INTEGRATION_ID) {
  console.error("❌ --apply działa tylko z --integration <id>. Sprzątanie wszystkich biur włącza się");
  console.error("   zmienną CRM_FEED_PRUNE_WITHOUT_FULL=1 w silniku, nie tym skryptem.");
  process.exit(1);
}

function gb(bytes: number) {
  return Math.round((bytes / 1024 / 1024 / 1024) * 100) / 100;
}

function totalBytes(files: RemoteFeedFile[]) {
  return files.reduce((acc, file) => acc + (file.size ?? 0), 0);
}

type Row = {
  biuro: string;
  tryb: string;
  plikowFTP: number;
  gbFTP: number;
  doKasacji: number;
  gbDoKasacji: number;
  zostanie: number;
};

async function listRemoteFeeds(
  integration: {
    ftpHost: string | null;
    ftpPort: number | null;
    ftpUsername: string | null;
    ftpPassword: string | null;
    ftpRemotePath: string | null;
    expectedFilePattern: string | null;
  }
): Promise<RemoteFeedFile[]> {
  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: integration.ftpHost!,
      port: integration.ftpPort ?? 21,
      user: integration.ftpUsername!,
      password: integration.ftpPassword!,
      secure: false,
    });

    await client.cd(integration.ftpRemotePath?.trim() || "/");

    const list = await client.list();
    const regex = wildcardToRegExp(integration.expectedFilePattern?.trim() || "oferty_*.zip");

    let matched = list.filter((item) => item.isFile && regex.test(item.name));
    if (matched.length === 0) {
      matched = list.filter((item) => {
        const name = item.name.toLowerCase();
        return item.isFile && (name.endsWith(".zip") || name.endsWith(".xml"));
      });
    }

    return matched.map((item) => ({
      remoteFileName: item.name,
      size: item.size ?? null,
      modifiedAt: item.modifiedAt ?? null,
    }));
  } finally {
    client.close();
  }
}

type FtpCredentials = Parameters<typeof listRemoteFeeds>[0];

/** Kasowanie plików z FTP — wołane WYŁĄCZNIE w trybie --apply, dla jednej wskazanej integracji. */
async function removeRemoteFiles(integration: FtpCredentials, fileNames: string[]) {
  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  let removed = 0;
  const failures: string[] = [];

  try {
    await client.access({
      host: integration.ftpHost!,
      port: integration.ftpPort ?? 21,
      user: integration.ftpUsername!,
      password: integration.ftpPassword!,
      secure: false,
    });

    await client.cd(integration.ftpRemotePath?.trim() || "/");

    for (const name of fileNames) {
      try {
        await client.remove(name);
        removed += 1;
        if (removed % 50 === 0) console.log(`      ... skasowano ${removed}/${fileNames.length}`);
      } catch (error) {
        failures.push(`${name}: ${(error as Error).message}`);
      }
    }
  } finally {
    client.close();
  }

  return { removed, failures };
}

async function main() {
  const policy: PrunePolicy = {
    ...readPrunePolicyFromEnv(),
    ...(SIMULATE_WITHOUT_FULL ? { allowWithoutFullExport: true } : {}),
  };

  console.log("🔎 RAPORT auto-czyszczenia drop-zone FTP (silnik DOMY.PL). Zero kasowania.\n");
  console.log("Polityka:", {
    marginesDniZPelnym: policy.retentionDays,
    zostawNajswiezszych: policy.keepMinFiles,
    sprzataniebezPelnego: policy.allowWithoutFullExport ? "WŁĄCZONE" : "wyłączone",
    marginesDniBezPelnego: policy.retentionDaysWithoutFull,
    zostawNajswiezszychBezPelnego: policy.keepMinFilesWithoutFull,
  });
  if (SIMULATE_WITHOUT_FULL) {
    console.log("\n⚠️  Tryb --with-full: symulacja WŁĄCZONEGO sprzątania u biur bez pełnego eksportu.\n");
  }

  // Tylko integracje faktycznie jadące silnikiem DOMY.PL. ASARI, EstiCRM i LocumNet bywają
  // z feedFormat=DOMY_PL, ale worker kieruje je do własnych silników (patrz run-crm-job) —
  // reguła z domypl-sync nigdy ich nie dotyczy, więc nie mają czego robić w tym raporcie.
  const integrations = await prisma.crmIntegration.findMany({
    where: {
      feedFormat: "DOMY_PL",
      transportType: "FTP",
      isActive: true,
      provider: { notIn: ["ASARI", "ESTI_CRM", "LOCUMNET"] },
      ...(ONLY_INTEGRATION_ID ? { id: ONLY_INTEGRATION_ID } : {}),
    },
    select: {
      id: true,
      name: true,
      ftpHost: true,
      ftpPort: true,
      ftpUsername: true,
      ftpPassword: true,
      ftpRemotePath: true,
      expectedFilePattern: true,
    },
  });

  console.log(`\nIntegracji do sprawdzenia: ${integrations.length}\n`);

  const rows: Row[] = [];
  let sumFilesToPrune = 0;
  let sumBytesToPrune = 0;
  let sumBytesOnFtp = 0;
  let failed = 0;

  for (const integration of integrations) {
    const label = `${integration.name} [${integration.id.slice(-6)}] ${integration.ftpRemotePath ?? "/"}`;

    if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
      console.log(`  ⏭️  ${label}: brak danych FTP.`);
      continue;
    }

    let remoteFeeds: RemoteFeedFile[];
    try {
      remoteFeeds = await listRemoteFeeds(integration);
    } catch (error) {
      failed += 1;
      console.log(`  ❌ ${label}: FTP niedostępny — ${(error as Error).message}`);
      continue;
    }

    const processedFiles = await prisma.crmProcessedFile.findMany({
      where: { integrationId: integration.id, status: "SUCCESS" },
      select: { remoteFileName: true, fileSize: true, fileModifiedAt: true, isFullExport: true },
    });

    const plan = planFeedPrune(remoteFeeds, processedFiles, policy, Date.now());

    const bytesOnFtp = totalBytes(remoteFeeds);
    const bytesToPrune = totalBytes(plan.prunable);

    sumFilesToPrune += plan.prunable.length;
    sumBytesToPrune += bytesToPrune;
    sumBytesOnFtp += bytesOnFtp;

    rows.push({
      biuro: label,
      tryb: plan.mode,
      plikowFTP: remoteFeeds.length,
      gbFTP: gb(bytesOnFtp),
      doKasacji: plan.prunable.length,
      gbDoKasacji: gb(bytesToPrune),
      zostanie: remoteFeeds.length - plan.prunable.length,
    });

    if (plan.prunable.length > 0) {
      console.log(`  🧹 ${label}: ${plan.prunable.length} plików / ${gb(bytesToPrune)} GB — ${plan.reason}`);
      const preview = plan.prunable.slice(0, 3).map((f) => path.basename(f.remoteFileName));
      console.log(`      np. ${preview.join(", ")}${plan.prunable.length > 3 ? ", ..." : ""}`);

      if (APPLY) {
        console.log(`      ⚠️  --apply: kasuję ${plan.prunable.length} plików z FTP...`);
        const { removed, failures } = await removeRemoteFiles(
          integration,
          plan.prunable.map((f) => f.remoteFileName)
        );
        console.log(`      ✅ Skasowano ${removed} plików.`);
        if (failures.length > 0) {
          console.log(`      ⚠️  Nie udało się skasować ${failures.length}:`);
          for (const failure of failures.slice(0, 10)) console.log(`         ${failure}`);
        }
      }
    }
  }

  rows.sort((a, b) => b.gbDoKasacji - a.gbDoKasacji);

  console.log("\n== Podsumowanie per integracja ==");
  console.table(rows);

  const trybLicznik = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.tryb] = (acc[row.tryb] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n== Razem ==");
  console.log(`Integracji sprawdzonych: ${rows.length}${failed > 0 ? ` (FTP niedostępny: ${failed})` : ""}`);
  console.log(`Tryby: ${JSON.stringify(trybLicznik)}`);
  console.log(`Plików na FTP: ${rows.reduce((a, r) => a + r.plikowFTP, 0)} / ${gb(sumBytesOnFtp)} GB`);
  console.log(
    `${APPLY ? "Skasowano" : "Do skasowania"}: ${sumFilesToPrune} plików / ${gb(sumBytesToPrune)} GB`
  );
  console.log(
    APPLY
      ? "\n⚠️  Tryb --apply: pliki zostały USUNIĘTE z FTP. Sprawdź kolejny import tego biura."
      : "\nTo był raport. Nic nie zostało skasowane."
  );
}

main()
  .catch((error) => {
    console.error("💥 Raport przerwany:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
