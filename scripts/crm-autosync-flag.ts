import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (jak w pozostałych skryptach CRM).
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Przełącznik globalnej flagi auto-sync CRM (AppConfig.crmAutoSyncEnabled).
 * To jest wersjonowany kill-switch (DoD #6: wyłączenie bez deployu).
 *
 * Użycie:
 *   npm run crm:autosync:on      -> włącza auto-sync
 *   npm run crm:autosync:off     -> wyłącza auto-sync (STOP, kolejka przestaje rosnąć)
 *   npm run crm:autosync:status  -> pokazuje bieżący stan flagi
 */
async function main() {
  const arg = (process.argv[2] || "status").toLowerCase();

  if (!["on", "off", "status"].includes(arg)) {
    console.error("Użycie: tsx scripts/crm-autosync-flag.ts <on|off|status>");
    process.exit(1);
  }

  const { getAppConfig } = await import("../src/lib/app-config");
  await getAppConfig(); // upewnij się, że wiersz AppConfig istnieje
  const { prisma } = await import("../src/lib/prisma");

  if (arg === "on" || arg === "off") {
    await prisma.appConfig.updateMany({
      data: { crmAutoSyncEnabled: arg === "on" },
    });
  }

  const config = await prisma.appConfig.findFirst({
    select: { crmAutoSyncEnabled: true },
  });

  console.log(`crmAutoSyncEnabled = ${config?.crmAutoSyncEnabled}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Błąd przełącznika auto-sync CRM:", error);
  process.exit(1);
});
