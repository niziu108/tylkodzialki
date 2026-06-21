/**
 * Narzędzie diagnostyczne: stan integracji IMOX w bazie — ostatni sync, ostatnie joby
 * oraz rozkład statusów ofert (AKTYWNE/ZAKONCZONE). Pozwala potwierdzić m.in. działanie
 * usuwania różnicowego R-C (deactivateExternalIds) bez zaglądania do panelu.
 *
 * Uruchom na VPS:  npx tsx scripts/crm-imo-status.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const integ = await prisma.crmIntegration.findFirst({
    where: { provider: "IMOX" },
    select: {
      id: true,
      name: true,
      lastSyncAt: true,
      lastImportedOffers: true,
      lastCreatedCount: true,
      lastUpdatedCount: true,
      lastDeactivatedCount: true,
      lastErrorCount: true,
    },
  });

  if (!integ) {
    console.log("Brak integracji IMOX.");
    return;
  }

  console.log(`\n=== Integracja IMO: ${integ.name} (${integ.id}) ===`);
  console.log(`Ostatni sync: ${integ.lastSyncAt?.toISOString?.() ?? integ.lastSyncAt}`);
  console.log(
    `  import=${integ.lastImportedOffers} created=${integ.lastCreatedCount} ` +
      `updated=${integ.lastUpdatedCount} deactivated=${integ.lastDeactivatedCount} errors=${integ.lastErrorCount}`
  );

  const jobs = await prisma.crmImportJob.findMany({
    where: { integrationId: integ.id },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      status: true,
      importedOffers: true,
      createdCount: true,
      updatedCount: true,
      deactivatedCount: true,
      errorCount: true,
      finishedAt: true,
    },
  });

  console.log("\nOstatnie joby (od najnowszego):");
  for (const j of jobs) {
    console.log(
      `  ${j.status}  import=${j.importedOffers} created=${j.createdCount} ` +
        `updated=${j.updatedCount} deactivated=${j.deactivatedCount} errors=${j.errorCount}  (${j.finishedAt?.toISOString?.() ?? j.finishedAt})`
    );
  }

  const links = await prisma.crmOfferLink.findMany({
    where: { integrationId: integ.id },
    select: {
      isActiveInSource: true,
      externalId: true,
      dzialkaId: true,
      dzialka: { select: { status: true, tytul: true } },
    },
  });

  const aktywne = links.filter((l) => l.dzialka.status === "AKTYWNE");
  const zakonczone = links.filter((l) => l.dzialka.status === "ZAKONCZONE");
  const activeInSource = links.filter((l) => l.isActiveInSource).length;

  console.log("\nOferty IMO w bazie:");
  console.log(`  status AKTYWNE:    ${aktywne.length}`);
  console.log(`  status ZAKONCZONE: ${zakonczone.length}`);
  console.log(`  isActiveInSource=true: ${activeInSource}`);
  console.log(`  razem powiązań:    ${links.length}`);

  if (aktywne.length > 0) {
    console.log("\nAktywne oferty IMO (link do podglądu):");
    for (const l of aktywne) {
      console.log(`  [${l.externalId}] ${l.dzialka.tytul ?? ""}`);
      console.log(`      https://tylkodzialki.pl/dzialka/${l.dzialkaId}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Błąd:", e);
    process.exit(1);
  });
