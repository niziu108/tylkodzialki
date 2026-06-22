/**
 * Podgląd kolejki importów CRM (CrmImportJob): ile czeka, co się przetwarza teraz,
 * gdzie w kolejce jest IMO. Przydatne, gdy cron kolejkuje wszystkie biura i trzeba
 * zobaczyć, kiedy dana integracja zostanie obsłużona (worker idzie sekwencyjnie).
 *
 * Uruchom na VPS:  npx tsx scripts/crm-queue.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const byStatus = await prisma.crmImportJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  console.log("=== Kolejka CRM (CrmImportJob) ===");
  console.log("Liczniki per status:");
  for (const s of byStatus) {
    console.log(`  ${s.status}: ${s._count._all}`);
  }

  const queue = await prisma.crmImportJob.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, createdAt: true, integrationId: true },
  });

  const ids = [...new Set(queue.map((j) => j.integrationId))];
  const integs = ids.length
    ? await prisma.crmIntegration.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, provider: true },
      })
    : [];
  const nameMap = new Map(integs.map((i) => [i.id, `${i.provider}/${i.name}`]));

  console.log(`\nW toku / oczekuje (${queue.length}), od najstarszego:`);
  if (queue.length === 0) {
    console.log("  (pusto — worker nadąża, nic nie czeka)");
  } else {
    queue.forEach((j, idx) => {
      const tag = j.status === "RUNNING" ? "▶ PRZETWARZA" : `#${idx + 1} czeka`;
      const isImo = nameMap.get(j.integrationId)?.startsWith("IMOX") ? "  <-- IMO" : "";
      console.log(
        `  ${tag}  ${nameMap.get(j.integrationId) ?? j.integrationId}  (${j.createdAt.toISOString()})${isImo}`
      );
    });
  }

  const recent = await prisma.crmImportJob.findMany({
    where: { status: { in: ["SUCCESS", "ERROR"] } },
    orderBy: { finishedAt: "desc" },
    take: 6,
    select: { status: true, finishedAt: true, integrationId: true },
  });
  const recentIds = [...new Set(recent.map((j) => j.integrationId))];
  const recentIntegs = recentIds.length
    ? await prisma.crmIntegration.findMany({
        where: { id: { in: recentIds } },
        select: { id: true, name: true, provider: true },
      })
    : [];
  const recentMap = new Map(recentIntegs.map((i) => [i.id, `${i.provider}/${i.name}`]));

  console.log("\nOstatnio zakończone:");
  for (const j of recent) {
    console.log(
      `  ${j.status}  ${recentMap.get(j.integrationId) ?? j.integrationId}  (${j.finishedAt?.toISOString?.() ?? j.finishedAt})`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Błąd:", e);
    process.exit(1);
  });
