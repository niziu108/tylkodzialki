/**
 * Kolejkuje import WYŁĄCZNIE integracji IMOX (do crona na czas weryfikacji IMO).
 * Niezależny od globalnej flagi auto-sync i globalnego crona — nie dotyka pozostałych biur.
 * Tworzy PENDING CrmImportJob (jak ręczny przycisk admina); przetworzy go istniejący worker.
 * Guard R2: pomija, jeśli IMO ma już job PENDING/RUNNING.
 *
 * Cron (co 2h):
 *   0 *\/2 * * * cd /var/www/tylkodzialki && /usr/bin/npx tsx scripts/crm-imo-enqueue.ts >> /root/crm-imo-cron.log 2>&1
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const imo = await prisma.crmIntegration.findFirst({
    where: { provider: "IMOX", isActive: true },
    select: { id: true, name: true },
  });

  if (!imo) {
    console.log(`[${new Date().toISOString()}] Brak aktywnej integracji IMOX — pomijam.`);
    return;
  }

  const inFlight = await prisma.crmImportJob.findFirst({
    where: { integrationId: imo.id, status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true },
  });

  if (inFlight) {
    console.log(`[${new Date().toISOString()}] IMO (${imo.name}): job ${inFlight.id} już w toku — pomijam.`);
    return;
  }

  const job = await prisma.crmImportJob.create({
    data: {
      integrationId: imo.id,
      status: "PENDING",
      message: "Auto-sync IMO (cron weryfikacyjny).",
    },
  });

  console.log(`[${new Date().toISOString()}] IMO (${imo.name}): utworzono job ${job.id}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Błąd:", e);
    process.exit(1);
  });
