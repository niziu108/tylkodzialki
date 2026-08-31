import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (jak w pozostałych skryptach CRM).
// Na VPS DATABASE_URL siedzi w .env.local, więc statyczny import Prismy startowałby bez bazy.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Dopisuje brakujące epizody życia ofert (DzialkaListingSpell).
//
// Pierwszy przebieg działa jak backfill: odtwarza historię z tego, co jeszcze jest w bazie.
// Kolejne dopisują tylko różnice. Bezpieczny do powtarzania w kółko.
//
// Na produkcji to samo robi worker CRM po opróżnieniu kolejki importów. Ten skrypt jest do
// uruchomienia z ręki: po wdrożeniu, przy sprawdzaniu i gdy chcesz zobaczyć stan od razu.
//
// Uruchomienie: npm run spells

async function main() {
  const { reconcileListingSpells } = await import("../src/lib/listing-spells");
  const { prisma } = await import("../src/lib/prisma");

  try {
    const t0 = Date.now();
    const r = await reconcileListingSpells();
    const sekundy = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`Przejrzano ofert: ${r.scanned}`);
    console.log(`  nowych epizodów:      ${r.opened}`);
    console.log(`  domkniętych epizodów: ${r.closed}`);
    console.log(`  ofert, które wróciły: ${r.reopened}`);
    console.log(`  odrzucone artefakty:  ${r.odrzuconeArtefakty} (epizod krótszy niż doba)`);
    console.log(`Czas: ${sekundy} s`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Błąd rekoncyliatora epizodów:", e);
  process.exitCode = 1;
});
