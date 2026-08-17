import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (jak w pozostałych skryptach CRM).
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Nadrabianie zaległych usunięć z paczek DOMY.PL (<oferta_usun>).
 *
 * Skąd zaległość: znaczniki usunięcia stosowaliśmy wyłącznie dla IMOX. Galactica przysyła je
 * w każdej paczce, ale trafiały do kosza — a że pełny eksport przyszedł od niej 6 razy na 6828
 * plików, bezpiecznik R1 też nigdy się nie odpalał. Efekt: sprzedane działki wisiały na portalu
 * bez końca. Silnik jest już naprawiony (domypl-sync.ts), ale to działa tylko na przyszłość:
 * usunięcia sprzed naprawy nigdy nie przyjdą drugi raz. Ten skrypt czyta je z paczek, które
 * wciąż leżą na FTP.
 *
 * Zasady:
 *  - dopasowanie po DOKŁADNYM externalId (Galactica kasuje starą wersję id przy aktualizacji,
 *    więc dopasowanie po bazowym id wygasiłoby żywe oferty),
 *  - usunięcie z paczki z dnia X gasi ofertę tylko wtedy, gdy ostatnie potwierdzenie oferty
 *    (lastSeenAt) jest starsze niż ta paczka — oferta zdjęta i wystawiona ponownie zostaje,
 *  - nic nie kasujemy z FTP i niczego nie zapisujemy w CrmProcessedFile; to przebieg tylko do odczytu
 *    plus soft delete w bazie.
 *
 * Uwaga na transfer: paczki mają zdjęcia, więc potrafią ważyć kilkadziesiąt MB. Skrypt liczy
 * pobrane bajty i ma limity (--max-plikow, --od, --max-mb). Sensownie puszczać per biuro, z VPS.
 *
 * Użycie:
 *   npm run crm:usun-backfill                          -> raport dla wszystkich Galactic
 *   npm run crm:usun-backfill -- --integracja=<id>      -> jedno biuro
 *   npm run crm:usun-backfill -- --od=2026-06-01        -> tylko paczki od tej daty
 *   npm run crm:usun-backfill -- --max-plikow=50        -> ostrożny podgląd
 *   npm run crm:usun-backfill -- --apply                -> wygasza dopasowane oferty
 */

import path from "path";
import os from "os";
import { promises as fsp } from "fs";
import * as ftp from "basic-ftp";
import unzipper from "unzipper";
import type { CrmProvider } from "@prisma/client";

type RemovalHit = {
  externalId: string;
  dzialkaId: string;
  linkId: string;
  tytul: string;
  cenaPln: number;
  removedAt: Date;
  fileName: string;
  lastSeenAt: Date | null;
};

function stringArg(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

function numberArg(name: string): number | undefined {
  const raw = stringArg(name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Zły argument --${name}=${raw}`);
  return value;
}

/** Wyciąga same <oferta_usun><id>…</id></oferta_usun> ze strumienia XML, bez ładowania całości. */
async function collectRemovalIds(stream: NodeJS.ReadableStream): Promise<string[]> {
  const ids: string[] = [];
  let buffer = "";

  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const matches = buffer.match(/<oferta_usun>[\s\S]*?<\/oferta_usun>|<oferta_usun[^>]*\/>/gi);
      if (matches) {
        for (const fragment of matches) {
          const id =
            fragment.match(/<id>([^<]+)<\/id>/i)?.[1] ??
            fragment.match(/\bid="([^"]+)"/i)?.[1];
          if (id) ids.push(id.trim());
        }
      }
      // Zostawiamy ogon na wypadek znacznika przeciętego na granicy chunka.
      const tail = buffer.lastIndexOf("<oferta_usun");
      buffer = tail >= 0 ? buffer.slice(tail) : buffer.slice(-32);
      if (buffer.length > 1_000_000) buffer = buffer.slice(-32);
    });
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  return [...new Set(ids)];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const integrationId = stringArg("integracja");
  const providerArg = (stringArg("provider") ?? "GALACTICA").toUpperCase();
  const since = stringArg("od") ? new Date(`${stringArg("od")}T00:00:00Z`) : null;
  const maxFiles = numberArg("max-plikow") ?? Infinity;
  const maxMb = numberArg("max-mb") ?? Infinity;

  const { prisma } = await import("../src/lib/prisma");
  const { deactivateExternalIds } = await import("../src/lib/crm/domypl-sync");

  const integrations = await prisma.crmIntegration.findMany({
    where: {
      isActive: true,
      transportType: "FTP",
      feedFormat: "DOMY_PL",
      ...(integrationId ? { id: integrationId } : { provider: providerArg as CrmProvider }),
    },
    select: {
      id: true,
      name: true,
      provider: true,
      ftpHost: true,
      ftpPort: true,
      ftpUsername: true,
      ftpPassword: true,
      ftpRemotePath: true,
      expectedFilePattern: true,
    },
    orderBy: { name: "asc" },
  });

  console.log("");
  console.log(
    `Integracji do przejrzenia: ${integrations.length}${since ? `, paczki od ${since.toISOString().slice(0, 10)}` : ""}${apply ? "" : "  [TRYB RAPORTU]"}`
  );

  let totalBytes = 0;
  let totalFiles = 0;
  let totalRemovals = 0;
  let totalExpired = 0;
  const allHits: RemovalHit[] = [];

  for (const integration of integrations) {
    if (!integration.ftpHost || !integration.ftpUsername || !integration.ftpPassword) {
      console.log(`  [${integration.id.slice(-6)}] ${integration.name}: brak danych FTP, pomijam`);
      continue;
    }

    const client = new ftp.Client(60_000);
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "td-usun-"));
    // id usunięcia -> najświeższa paczka, w której się pojawiło
    const removals = new Map<string, { at: Date; fileName: string }>();
    let integrationBytes = 0;
    let integrationFiles = 0;

    try {
      await client.access({
        host: integration.ftpHost,
        port: integration.ftpPort ?? 21,
        user: integration.ftpUsername,
        password: integration.ftpPassword,
        secure: false,
      });
      await client.cd(integration.ftpRemotePath?.trim() || "/");

      const files = (await client.list())
        .filter((item) => {
          if (!item.isFile) return false;
          const name = item.name.toLowerCase();
          if (!name.endsWith(".zip") && !name.endsWith(".xml")) return false;
          if (since && item.modifiedAt && item.modifiedAt < since) return false;
          if ((item.size ?? 0) / 1_000_000 > maxMb) return false;
          return true;
        })
        .sort((a, b) => (a.modifiedAt?.getTime() ?? 0) - (b.modifiedAt?.getTime() ?? 0))
        .slice(0, Number.isFinite(maxFiles) ? maxFiles : undefined);

      for (const file of files) {
        const localPath = path.join(tempDir, file.name);
        await client.downloadTo(localPath, file.name);
        integrationBytes += file.size ?? 0;
        integrationFiles += 1;

        try {
          let ids: string[] = [];
          if (file.name.toLowerCase().endsWith(".zip")) {
            const directory = await unzipper.Open.file(localPath);
            const entries = directory.files as { path: string; stream: () => NodeJS.ReadableStream }[];
            const xmlEntry =
              entries.find((entry) => entry.path.toLowerCase().endsWith("oferty.xml")) ??
              entries.find((entry) => entry.path.toLowerCase().endsWith(".xml"));
            if (xmlEntry) ids = await collectRemovalIds(xmlEntry.stream());
          } else {
            const { createReadStream } = await import("fs");
            ids = await collectRemovalIds(createReadStream(localPath));
          }

          const at = file.modifiedAt ?? new Date();
          for (const id of ids) {
            const previous = removals.get(id);
            if (!previous || at > previous.at) removals.set(id, { at, fileName: file.name });
          }
        } finally {
          await fsp.rm(localPath, { force: true });
        }
      }
    } catch (error) {
      console.log(
        `  [${integration.id.slice(-6)}] ${integration.name}: BŁĄD FTP — ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      client.close();
      await fsp.rm(tempDir, { recursive: true, force: true });
    }

    totalBytes += integrationBytes;
    totalFiles += integrationFiles;
    totalRemovals += removals.size;

    if (removals.size === 0) {
      console.log(
        `  [${integration.id.slice(-6)}] ${integration.name}: ${integrationFiles} paczek, zero usunięć`
      );
      continue;
    }

    // Kandydaci: aktywne oferty o dokładnie tym externalId, niepotwierdzone po dacie usunięcia.
    const links = await prisma.crmOfferLink.findMany({
      where: {
        integrationId: integration.id,
        isActiveInSource: true,
        dzialka: { status: "AKTYWNE" },
        externalId: { in: [...removals.keys()] },
      },
      select: {
        id: true,
        externalId: true,
        lastSeenAt: true,
        dzialka: { select: { id: true, tytul: true, cenaPln: true } },
      },
    });

    const hits: RemovalHit[] = [];
    for (const link of links) {
      const removal = removals.get(link.externalId)!;
      if (link.lastSeenAt && link.lastSeenAt > removal.at) continue; // wróciła po usunięciu
      hits.push({
        externalId: link.externalId,
        linkId: link.id,
        dzialkaId: link.dzialka.id,
        tytul: link.dzialka.tytul,
        cenaPln: link.dzialka.cenaPln,
        removedAt: removal.at,
        fileName: removal.fileName,
        lastSeenAt: link.lastSeenAt,
      });
    }

    allHits.push(...hits);

    console.log(
      `  [${integration.id.slice(-6)}] ${integration.name}: ${integrationFiles} paczek (${(integrationBytes / 1_000_000).toFixed(0)} MB), ${removals.size} usunięć, trafień w aktywne oferty: ${hits.length}`
    );

    if (!apply || hits.length === 0) continue;

    for (const hit of hits) {
      const expired = await deactivateExternalIds(
        integration.id,
        [hit.externalId],
        hit.removedAt,
        `Oferta usunięta przez <oferta_usun> z paczki ${hit.fileName} (${hit.removedAt.toISOString().slice(0, 10)}) — nadrobione po naprawie silnika.`
      );
      totalExpired += expired;
    }
  }

  console.log("");
  console.log(`Paczek przejrzanych:  ${totalFiles} (${(totalBytes / 1_000_000).toFixed(0)} MB)`);
  console.log(`Znaczników usunięcia: ${totalRemovals}`);
  console.log(`Trafień w aktywne oferty: ${allHits.length}`);

  if (allHits.length > 0) {
    console.log("");
    console.log("Przykłady (20 najstarszych usunięć):");
    for (const hit of [...allHits].sort((a, b) => a.removedAt.getTime() - b.removedAt.getTime()).slice(0, 20)) {
      console.log(
        `  ${hit.removedAt.toISOString().slice(0, 10)}  ${hit.externalId.padEnd(20)} ${String(hit.cenaPln).padStart(9)} zł  ${hit.tytul.slice(0, 60)}`
      );
      console.log(`      https://tylkodzialki.pl/dzialka/${hit.dzialkaId}`);
    }
  }

  console.log("");
  if (apply) {
    console.log(`GOTOWE. Wygaszono ofert: ${totalExpired}.`);
  } else {
    console.log("TRYB RAPORTU — nic nie zmieniono. Aby wykonać: npm run crm:usun-backfill -- --apply");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Błąd nadrabiania usunięć CRM:", error);
  process.exit(1);
});
