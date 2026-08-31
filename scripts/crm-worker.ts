import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const LOOP_MODE = process.argv.includes("--loop");
const POLL_INTERVAL_MS = 60_000;

// Zapis historii epizodów ofert biegnie PO imporcie i celowo poza jego transakcjami: to statystyka,
// a nie podaż. Gdyby padła, import 126 biur ma się o tym nie dowiedzieć.
//
// Odpala się raz po opróżnieniu kolejki, a nie po każdym jobie. Rekoncyliator czyta za każdym razem
// pełny stan ofert, a jobów w cyklu jest tyle, ile integracji: wołany po każdym z nich przeczytałby
// te same kilkadziesiąt tysięcy rekordów ponad sto razy dziennie bez żadnego zysku.
async function reconcileSpellsSafely() {
  try {
    const { reconcileListingSpells } = await import("../src/lib/listing-spells");
    const r = await reconcileListingSpells();
    if (r.opened || r.closed) {
      console.log(
        `📒 Historia ofert: +${r.opened} nowych, ${r.closed} domkniętych, ${r.reopened} wróciło.`,
      );
    }
  } catch (error) {
    console.error("⚠️ Rekoncyliator epizodów nie przeszedł (import nietknięty):", error);
  }
}

async function runSingleJob(jobId: string) {
  const { prisma } = await import("../src/lib/prisma");
  const { runCrmImportJob } = await import("../src/lib/crm/run-crm-job");

  console.log("Start importu CRM job:", jobId);
  await runCrmImportJob(jobId);
  console.log("Import CRM zakończony:", jobId);

  await reconcileSpellsSafely();

  await prisma.$disconnect();
}

// Silniki rozpakowują paczki do os.tmpdir()/td-*. Sprzątanie jest w `finally`, ale crash albo
// restart procesu zostawia katalog na dysku. Worker jest jednoinstancyjny, więc w chwili startu
// żaden td-* nie jest w użyciu i można je skasować bezpiecznie.
//
// minAgeMs > 0 = tryb okresowy (pętla, między jobami). Wtedy ruszamy tylko katalogi wyraźnie stare,
// bo obok pętli może chodzić ręcznie odpalony jednorazowy job (`npm run crm:sync -- JOB_ID`).
async function sweepOrphanTempDirs(minAgeMs = 0) {
  const fsp = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");

  const tmp = os.tmpdir();
  const prefixes = ["td-esticrm-", "td-asari-", "td-crm-", "td-backfill-", "td-locumnet-"];

  try {
    const entries = await fsp.readdir(tmp, { withFileTypes: true });
    let removed = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!prefixes.some((prefix) => entry.name.startsWith(prefix))) continue;

      const fullPath = path.join(tmp, entry.name);

      if (minAgeMs > 0) {
        try {
          const stat = await fsp.stat(fullPath);
          if (Date.now() - stat.mtimeMs < minAgeMs) continue;
        } catch {
          continue; // nie da się sprawdzić wieku = nie ruszamy
        }
      }

      try {
        await fsp.rm(fullPath, { recursive: true, force: true });
        removed += 1;
      } catch {
        // Pojedynczy katalog nie do skasowania nie może wywalić startu workera.
      }
    }

    if (removed > 0) {
      console.log(`🧹 Sprzątanie: usunięto ${removed} osieroconych katalogów tymczasowych z ${tmp}.`);
    }
  } catch (error) {
    console.error("🧹 Sprzątanie katalogów tymczasowych nie powiodło się:", error);
  }
}

async function runLoop() {
  const { prisma } = await import("../src/lib/prisma");
  const { runCrmImportJob } = await import("../src/lib/crm/run-crm-job");

  // Reconciler startowy. Worker jest jednoinstancyjny, więc joby w statusie RUNNING w
  // chwili startu to sieroty po restarcie/crashu (nic realnie nie działa). Wznawiamy je
  // jako PENDING — inaczej wiszą wiecznie i blokują harmonogram, bo enqueueAutoSyncJobs
  // pomija integracje mające job PENDING/RUNNING w toku (i takie biuro przestaje się
  // synchronizować). runCrmImportJob jest idempotentny, więc ponowne przetworzenie jest OK.
  const reconciled = await prisma.crmImportJob.updateMany({
    where: { status: "RUNNING" },
    data: { status: "PENDING", message: "Wznowiono po restarcie workera (osierocony RUNNING)." },
  });
  if (reconciled.count > 0) {
    console.log(`♻️ Reconciler: wznowiono ${reconciled.count} osieroconych jobów RUNNING → PENDING.`);
  }

  await sweepOrphanTempDirs();

  console.log("🚀 CRM worker działa. Szukam zadań PENDING...");

  // Sprzątanie tylko przy starcie było plastrem: worker potrafi chodzić tygodniami. Powtarzamy je
  // co godzinę, w szczycie pętli (czyli nigdy w trakcie joba — pętla jest sekwencyjna).
  const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
  const SWEEP_MIN_AGE_MS = 12 * 60 * 60 * 1000;
  let lastSweepAt = Date.now();

  // Ustawiane po każdym jobie, konsumowane dopiero gdy kolejka opustoszeje.
  let historiaDoUzupelnienia = false;

  while (true) {
    try {
      if (Date.now() - lastSweepAt >= SWEEP_INTERVAL_MS) {
        lastSweepAt = Date.now();
        await sweepOrphanTempDirs(SWEEP_MIN_AGE_MS);
      }

      const job = await prisma.crmImportJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (!job) {
        if (historiaDoUzupelnienia) {
          historiaDoUzupelnienia = false;
          await reconcileSpellsSafely();
        }

        await new Promise((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MS)
        );
        continue;
      }

      console.log("📦 Znaleziono job:", job.id);

      await runCrmImportJob(job.id);

      console.log("✅ Zakończono job:", job.id);

      historiaDoUzupelnienia = true;
    } catch (error) {
      console.error("❌ Błąd workera CRM:", error);

      await new Promise((resolve) =>
        setTimeout(resolve, POLL_INTERVAL_MS)
      );
    }
  }
}

async function main() {
  if (LOOP_MODE) {
    await runLoop();
    return;
  }

  const jobId = process.argv[2];

  if (!jobId) {
    console.error("❌ Brak jobId.");
    console.error("Użycie:");
    console.error("npm run crm:sync -- JOB_ID");
    console.error("albo:");
    console.error("npm run crm:worker");
    process.exit(1);
  }

  await runSingleJob(jobId);
}

main().catch((error) => {
  console.error("💥 Fatalny błąd workera CRM:", error);
  process.exit(1);
});