import { prisma } from "../src/lib/prisma";
import { runCrmImportJob } from "../src/lib/crm/run-crm-job";

async function main() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error("Brak jobId.");
    console.error("Użycie:");
    console.error("npm run crm:sync -- JOB_ID");
    process.exit(1);
  }

  console.log("Start importu CRM job:", jobId);

  await runCrmImportJob(jobId);

  console.log("Import CRM zakończony:", jobId);
}

main()
  .catch((error) => {
    console.error("Błąd workera CRM:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });