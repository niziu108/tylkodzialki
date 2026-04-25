import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const LOOP_MODE = process.argv.includes("--loop");
const POLL_INTERVAL_MS = 10_000;

async function runSingleJob(jobId: string) {
  const { prisma } = await import("../src/lib/prisma");
  const { runCrmImportJob } = await import("../src/lib/crm/run-crm-job");

  console.log("Start importu CRM job:", jobId);
  await runCrmImportJob(jobId);
  console.log("Import CRM zakończony:", jobId);

  await prisma.$disconnect();
}

async function runLoop() {
  const { prisma } = await import("../src/lib/prisma");
  const { runCrmImportJob } = await import("../src/lib/crm/run-crm-job");

  console.log("🚀 CRM worker działa. Szukam zadań PENDING...");

  while (true) {
    try {
      const job = await prisma.crmImportJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (!job) {
        await new Promise((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MS)
        );
        continue;
      }

      console.log("📦 Znaleziono job:", job.id);

      await runCrmImportJob(job.id);

      console.log("✅ Zakończono job:", job.id);
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