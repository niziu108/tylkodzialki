/**
 * Jednorazowe narzędzie: kasuje ślad przetworzonych plików (CrmProcessedFile) dla integracji IMOX,
 * żeby worker przetworzył ostatnią paczkę IMO od nowa (np. po wdrożeniu naprawy parsera lokalizacji).
 *
 * Bezpieczne: nie dotyka ofert ani CrmOfferLink. Idempotencja (unikat integrationId+externalId)
 * zadba o resztę przy ponownym imporcie - istniejące oferty zostaną zaktualizowane, nie zduplikowane.
 *
 * Uruchom na VPS:  npx tsx scripts/crm-reset-imo-processed.ts [integrationId]
 *   bez argumentu  -> wszystkie integracje IMOX
 *   z argumentem   -> tylko wskazana integracja
 */
import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (klient czyta DATABASE_URL przy imporcie).
// Kolejność jak w scripts/crm-worker.ts.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const onlyId = process.argv[2]?.trim() || undefined;

  const integrations = await prisma.crmIntegration.findMany({
    where: onlyId ? { id: onlyId } : { provider: "IMOX" },
    select: { id: true, name: true, provider: true },
  });

  if (integrations.length === 0) {
    console.log("Brak pasujących integracji (szukano IMOX).");
    return;
  }

  for (const integ of integrations) {
    const deleted = await prisma.crmProcessedFile.deleteMany({
      where: { integrationId: integ.id },
    });
    console.log(
      `${integ.provider} ${integ.name} (${integ.id}): usunięto ${deleted.count} śladów CrmProcessedFile.`
    );
  }

  console.log(
    "Gotowe. Odpal synchronizację IMO z panelu - worker przetworzy paczkę od nowa nowym kodem."
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Błąd:", e);
    process.exit(1);
  });
