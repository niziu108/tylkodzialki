/**
 * Jednorazowa naprawa powierzchni, które wpadły do bazy w hektarach zamiast w metrach.
 *
 * Bramka w silnikach (`src/lib/crm/area-sanity.ts`) pilnuje nowych importów, ale oferta
 * leżąca już w bazie doczeka się poprawki dopiero wtedy, gdy biuro ją ruszy i wyśle
 * w kolejnej paczce. Przy feedach różnicowych (RE/MAX) może to nie nastąpić miesiącami,
 * a przez ten czas działka 1,07 ha wypada z filtrów powierzchni jako 1 m².
 *
 * Skrypt używa DOKŁADNIE tej samej funkcji co import, więc nie ma tu drugiej reguły,
 * która mogłaby się rozjechać z pierwszą.
 *
 *   npm run crm:hektary          raport, niczego nie zapisuje
 *   npm run crm:hektary -- --fix zapisuje poprawki
 */
import { prisma } from "../src/lib/prisma";
import { repairAreaFromHectares, AREA_SUSPICIOUS_BELOW_M2 } from "../src/lib/crm/area-sanity";

async function main() {
  const zapisz = process.argv.includes("--fix");

  const podejrzane = await prisma.dzialka.findMany({
    where: { powierzchniaM2: { gt: 0, lt: AREA_SUSPICIOUS_BELOW_M2 } },
    select: { id: true, tytul: true, opis: true, powierzchniaM2: true, status: true },
  });

  const doPoprawy = podejrzane
    .map((d) => ({
      ...d,
      nowa: repairAreaFromHectares(d.powierzchniaM2 ?? 0, `${d.tytul ?? ""} ${d.opis ?? ""}`),
    }))
    .filter((d) => d.nowa !== d.powierzchniaM2);

  console.log(
    `Ofert z powierzchnią poniżej ${AREA_SUSPICIOUS_BELOW_M2} m²: ${podejrzane.length}. ` +
      `Zdradzają hektary w tekście: ${doPoprawy.length}.`
  );

  for (const d of doPoprawy) {
    console.log(
      `  ${String(d.powierzchniaM2).padStart(4)} m² -> ${String(d.nowa).padStart(8)} m² | ${d.status} | ${(d.tytul ?? "").slice(0, 60)}`
    );
  }

  if (!doPoprawy.length) return;

  if (!zapisz) {
    console.log("\nRaport bez zapisu. Aby zapisać: npm run crm:hektary -- --fix");
    return;
  }

  for (const d of doPoprawy) {
    await prisma.dzialka.update({ where: { id: d.id }, data: { powierzchniaM2: d.nowa } });
  }

  console.log(`\nZapisano poprawki: ${doPoprawy.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
