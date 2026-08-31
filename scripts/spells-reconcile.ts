// Dopisuje brakujące epizody życia ofert (DzialkaListingSpell).
//
// Pierwszy przebieg działa jak backfill: odtwarza historię z tego, co jeszcze jest w bazie.
// Kolejne dopisują tylko różnice. Bezpieczny do powtarzania w kółko.
//
// Uruchomienie: npm run spells

import { reconcileListingSpells } from "../src/lib/listing-spells";
import { prisma } from "../src/lib/prisma";

async function main() {
  const t0 = Date.now();
  const r = await reconcileListingSpells();
  const sekundy = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`Przejrzano ofert: ${r.scanned}`);
  console.log(`  nowych epizodów:      ${r.opened}`);
  console.log(`  domkniętych epizodów: ${r.closed}`);
  console.log(`  ofert, które wróciły: ${r.reopened}`);
  console.log(`  odrzucone artefakty:  ${r.odrzuconeArtefakty} (epizod krótszy niż doba)`);
  console.log(`Czas: ${sekundy} s`);
}

main()
  .catch((e) => {
    console.error("Błąd rekoncyliatora epizodów:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
