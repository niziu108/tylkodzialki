import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import path from "path";
import os from "os";
import { promises as fsp } from "fs";
import * as ftp from "basic-ftp";
import unzipper from "unzipper";
import { prisma } from "../src/lib/prisma";

// Backfill jednorazowy: oznacza w bazie (CrmProcessedFile.isFullExport) najnowszy PEŁNY eksport
// każdego biura DOMY.PL, żeby wdrożone auto-czyszczenie mogło skasować starsze, już zastąpione
// paczki (te wielkie stare pełne po 200-600 MB). Nowe silniki EstiCRM/ASARI tego NIE potrzebują —
// same wykrywają najnowszy pełny/CFG na żywo. To dotyczy wyłącznie DOMY.PL.
//
// Bezpieczeństwo:
//  - Pełność ustalamy z NAGŁÓWKA pliku (zawartosc_pliku), nie zgadujemy po rozmiarze. Rozmiar służy
//    tylko do pominięcia oczywistych różnicowych (male pliki) i ograniczenia pobierania.
//  - Oznaczamy TYLKO istniejące rekordy ze statusem SUCCESS. Nie tworzymy nowych rekordów, więc nie
//    ma ryzyka, że worker uzna nieprzetworzony plik za przetworzony i pominie import.
//  - --dry-run: tylko raport, zero zapisów do bazy i zero ruszania FTP poza odczytem.

const DRY_RUN = process.argv.includes("--dry-run");
// Pełne eksporty są duże (dziesiątki-setki MB). Wyższy próg pomija różnicowe (bywają do ~20 MB),
// żeby budżet skanu trafiał od razu w kandydatów na pełny, a nie marnował się na drobnicę.
const MIN_FULL_BYTES = Number(process.env.CRM_BACKFILL_MIN_FULL_BYTES ?? String(10_000_000)); // 10 MB
const MAX_BIG_DOWNLOADS = Number(process.env.CRM_BACKFILL_MAX_DOWNLOADS ?? "15"); // ile dużych plików max sprawdzamy na biuro

type Integ = {
  id: string;
  name: string;
  ftpHost: string | null;
  ftpPort: number | null;
  ftpUsername: string | null;
  ftpPassword: string | null;
  ftpRemotePath: string | null;
  expectedFilePattern: string | null;
};

function wildcardToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`, "i");
}

function isFullHeader(zawartosc: string) {
  const t = zawartosc.toLowerCase();
  return (
    t.includes("pelny") || t.includes("pełny") || t.includes("calosc") || t.includes("całość")
  );
}

// Czyta tylko początek pliku oferty.xml z ZIP-a (do </header>), bez ładowania całego XML do pamięci.
async function classifyLocalZip(localPath: string): Promise<"full" | "diff" | "unknown"> {
  let directory;
  try {
    directory = await unzipper.Open.file(localPath);
  } catch {
    return "unknown";
  }

  const files = directory.files as Array<{ type: string; path: string; stream: () => NodeJS.ReadableStream }>;
  const xmlEntry =
    files.find((f) => f.type === "File" && /(^|\/)oferty\.xml$/i.test(f.path)) ||
    files.find((f) => f.type === "File" && f.path.toLowerCase().endsWith(".xml"));

  if (!xmlEntry) return "unknown";

  return await new Promise<"full" | "diff" | "unknown">((resolve) => {
    const stream = xmlEntry.stream();
    let buf = "";
    let settled = false;

    const finish = (result: "full" | "diff" | "unknown") => {
      if (settled) return;
      settled = true;
      try {
        (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    stream.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      if (buf.includes("</header>") || buf.length > 65536) {
        const m = buf.match(/<zawartosc_pliku>([^<]*)<\/zawartosc_pliku>/i);
        const z = m ? m[1].trim() : "";
        finish(z ? (isFullHeader(z) ? "full" : "diff") : "unknown");
      }
    });
    stream.on("end", () => {
      const m = buf.match(/<zawartosc_pliku>([^<]*)<\/zawartosc_pliku>/i);
      const z = m ? m[1].trim() : "";
      finish(z ? (isFullHeader(z) ? "full" : "diff") : "unknown");
    });
    stream.on("error", () => finish("unknown"));
  });
}

async function processIntegration(integration: Integ) {
  if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
    console.log(`  ⏭️  ${integration.name}: brak danych FTP, pomijam.`);
    return;
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-backfill-"));

  try {
    await client.access({
      host: integration.ftpHost,
      port: integration.ftpPort ?? 21,
      user: integration.ftpUsername,
      password: integration.ftpPassword,
      secure: false,
    });

    const remoteDir = integration.ftpRemotePath?.trim() || "/";
    await client.cd(remoteDir);

    const list = await client.list();
    const pattern = integration.expectedFilePattern?.trim() || "oferty_*.zip";
    const regex = wildcardToRegExp(pattern);

    let zips = list.filter((i) => i.isFile && regex.test(i.name));
    if (zips.length === 0) {
      zips = list.filter((i) => i.isFile && i.name.toLowerCase().endsWith(".zip"));
    }

    // Od najnowszego.
    zips.sort((a, b) => (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0));

    if (zips.length === 0) {
      console.log(`  ⏭️  ${integration.name} (${remoteDir}): brak ZIP-ów.`);
      return;
    }

    let bigChecked = 0;
    let foundFull: { name: string; modifiedAt: Date | null } | null = null;

    for (const zip of zips) {
      const size = zip.size ?? 0;
      // Male pliki to na pewno różnicowe — nie tracimy czasu na pobieranie.
      if (size < MIN_FULL_BYTES) continue;
      if (bigChecked >= MAX_BIG_DOWNLOADS) break;
      bigChecked += 1;

      const localPath = path.join(tempDir, zip.name);
      try {
        await client.downloadTo(localPath, zip.name);
      } catch (error) {
        console.log(`     (nie udało się pobrać ${zip.name}: ${(error as Error).message})`);
        continue;
      }

      const klass = await classifyLocalZip(localPath);
      await fsp.rm(localPath, { force: true }).catch(() => {});

      if (klass === "full") {
        foundFull = { name: zip.name, modifiedAt: zip.modifiedAt ?? null };
        break; // najnowszy pełny znaleziony
      }
      // diff / unknown -> szukamy dalej wstecz
    }

    if (!foundFull) {
      console.log(
        `  ⚠️  ${integration.name} (${remoteDir}): nie znaleziono potwierdzonego pełnego eksportu wśród ${bigChecked} dużych plików — zostawiam nietknięte.`
      );
      return;
    }

    // Oznaczamy TYLKO istniejący rekord SUCCESS. Bez tworzenia nowych rekordów.
    const existing = await prisma.crmProcessedFile.findUnique({
      where: {
        integrationId_remoteFileName: {
          integrationId: integration.id,
          remoteFileName: foundFull.name,
        },
      },
      select: { id: true, status: true, isFullExport: true },
    });

    if (!existing || existing.status !== "SUCCESS") {
      console.log(
        `  ⚠️  ${integration.name}: najnowszy pełny to ${foundFull.name}, ale brak rekordu SUCCESS w bazie — nie oznaczam (bezpiecznie). Posprząta się przy następnym pełnym eksporcie.`
      );
      return;
    }

    if (existing.isFullExport) {
      console.log(`  ✓  ${integration.name}: ${foundFull.name} już oznaczony jako pełny.`);
      return;
    }

    if (DRY_RUN) {
      console.log(`  📝 [DRY-RUN] ${integration.name}: oznaczyłbym ${foundFull.name} jako pełny (${foundFull.modifiedAt?.toISOString() ?? "brak daty"}).`);
      return;
    }

    await prisma.crmProcessedFile.update({
      where: { id: existing.id },
      data: { isFullExport: true },
    });

    console.log(`  ✅ ${integration.name}: oznaczono ${foundFull.name} jako pełny eksport.`);
  } catch (error) {
    console.log(`  ❌ ${integration.name}: błąd — ${(error as Error).message}`);
  } finally {
    client.close();
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log(
    DRY_RUN
      ? "🔎 BACKFILL DOMY.PL (DRY-RUN — tylko raport, zero zmian)\n"
      : "🚀 BACKFILL DOMY.PL — oznaczanie najnowszych pełnych eksportów\n"
  );

  // Tylko integracje jadące silnikiem DOMY.PL. ASARI i EstiCRM (choć bywają z feedFormat=DOMY_PL)
  // mają własne, samoczyszczające się silniki — ich tu nie ruszamy (i nie ściągamy ich wielkich ZIP-ów).
  const integrations = (await prisma.crmIntegration.findMany({
    where: {
      isActive: true,
      transportType: "FTP",
      feedFormat: "DOMY_PL",
      provider: { notIn: ["ASARI", "ESTI_CRM"] },
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
    orderBy: { name: "asc" },
  })) as Integ[];

  console.log(`Integracji DOMY.PL do sprawdzenia: ${integrations.length}\n`);

  for (const integration of integrations) {
    await processIntegration(integration);
  }

  console.log("\n✅ Backfill zakończony. Kasowanie starych paczek zrobi worker przy najbliższym syncu.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("💥 Fatalny błąd backfillu:", error);
  process.exit(1);
});
