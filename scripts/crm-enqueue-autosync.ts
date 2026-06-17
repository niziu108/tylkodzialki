import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (klient czyta DATABASE_URL przy imporcie).
// Kolejność jak w scripts/crm-worker.ts.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { enqueueAutoSyncJobs } = await import("../src/lib/crm/enqueueAutoSyncJobs");

  // Opcjonalny argument: id jednej integracji (rollout fazami / test). Brak = wszystkie aktywne.
  const onlyIntegrationId = process.argv[2]?.trim() || undefined;

  if (onlyIntegrationId) {
    console.log(`🎯 Auto-sync CRM: kolejkowanie tylko dla integracji ${onlyIntegrationId}`);
  } else {
    console.log("🕒 Auto-sync CRM: kolejkowanie wszystkich aktywnych integracji");
  }

  try {
    const result = await enqueueAutoSyncJobs(onlyIntegrationId);

    if (!result.enabled) {
      console.log(
        "⏸️  Auto-sync wyłączony (AppConfig.crmAutoSyncEnabled = false). Nic nie zakolejkowano."
      );
    } else {
      console.log(
        `✅ Gotowe. Aktywnych: ${result.totalActive}, ` +
          `zakolejkowano: ${result.enqueued.length}, ` +
          `pominięto (już w toku): ${result.skipped.length}.`
      );
      if (result.jobIds.length > 0) {
        console.log("   Utworzone joby:", result.jobIds.join(", "));
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("💥 Błąd kolejkowania auto-sync CRM:", error);
  process.exit(1);
});
