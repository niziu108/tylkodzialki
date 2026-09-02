import dotenv from "dotenv";

// Env przed Prisma, jak w pozostałych skryptach.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Uzupełnia oś administracyjną oferty (`adminTeryt`, `adminWoj`, `adminPowiat`, `adminGmina`)
 * na podstawie `lat`/`lng` przez ULDK (GUGiK).
 *
 * Po co: `locationFull` z feedów CRM bywa niespójny („Łódzkie”, „Dąbrowica, koniński”,
 * „97-340 Kęszyn, Polska”), przez co ~11% aktywnych ofert nie dawało się przypisać do powiatu
 * i wypadało z hubów `/dzialki/powiat/...`. Punkt oferty jest przybliżony, ale przybliżenie rzędu
 * setek metrów nie zmienia gminy ani powiatu, więc ta precyzja jest uczciwa. TERYT gminy jest
 * dodatkowo kluczem pod agregaty cen (RCN).
 *
 * UCZCIWOŚĆ: z odpowiedzi ULDK bierzemy WYŁĄCZNIE jednostki administracyjne i TERYT gminy.
 * Numeru działki ewidencyjnej z przybliżonego punktu nie wyprowadzamy — ten nadal wskazuje
 * użytkownik w „Sprawdź działkę”.
 *
 * Bezpieczeństwo: domyślnie rusza tylko oferty z pustym `adminTeryt`, więc jest powtarzalny
 * i nigdy nie nadpisuje już ustalonej wartości. Bez `--apply` niczego nie zapisuje.
 *
 * Uruchomienie:
 *   npm run admin:backfill                       -> raport, NIC nie zapisuje
 *   npm run admin:backfill -- --apply            -> uzupełnia wszystkie oferty bez osi
 *   npm run admin:backfill -- --tylko-brakujace --apply  -> najpierw te, których nie da się
 *                                                          sparsować z locationFull (priorytet SEO)
 *   npm run admin:backfill -- --apply --limit 200
 */

const APPLY = process.argv.includes("--apply");
const TYLKO_BRAKUJACE = process.argv.includes("--tylko-brakujace");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i === -1) return Infinity;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

// Grzeczność wobec GUGiK: ULDK to darmowa usługa publiczna. ~5 zapytań/s to spokojne tempo.
const PRZERWA_MS = 200;
// Po ilu z rzędu błędach sieci przerywamy (usługa leży, nie ma sensu dobijać).
const MAX_BLEDOW_POD_RZAD = 15;

const spij = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { getAdminByXY } = await import("../src/lib/uldk");
  const { parseAdmin } = await import("../src/lib/seoPowiaty");

  const wszystkie = await prisma.dzialka.findMany({
    where: { status: "AKTYWNE", adminTeryt: null, lat: { not: null }, lng: { not: null } },
    select: { id: true, lat: true, lng: true, locationFull: true, locationLabel: true },
    orderBy: { createdAt: "desc" },
  });

  // Priorytet: oferty, których dziś NIE da się przypisać do powiatu z tekstu. To one wypadają
  // z hubów SEO, więc przy ograniczonym przebiegu chcemy najpierw je.
  const doRoboty = (TYLKO_BRAKUJACE ? wszystkie.filter((d) => !parseAdmin(d.locationFull)) : wszystkie).slice(
    0,
    LIMIT === Infinity ? undefined : LIMIT,
  );

  console.log(`Aktywne oferty bez osi administracyjnej: ${wszystkie.length}`);
  console.log(`Do przetworzenia w tym przebiegu: ${doRoboty.length}`);
  console.log(APPLY ? "TRYB: zapis do bazy" : "TRYB: raport (bez zapisu). Dodaj --apply, żeby zapisać.");
  console.log("");

  let ustalone = 0;
  let bezWyniku = 0;
  let bledy = 0;
  let podRzad = 0;
  const wgWojewodztwa = new Map<string, number>();

  for (let i = 0; i < doRoboty.length; i++) {
    const d = doRoboty[i];
    try {
      const admin = await getAdminByXY(d.lat!, d.lng!);
      podRzad = 0;

      if (!admin) {
        bezWyniku++;
      } else {
        ustalone++;
        wgWojewodztwa.set(admin.voivodeship, (wgWojewodztwa.get(admin.voivodeship) ?? 0) + 1);
        if (APPLY) {
          await prisma.dzialka.update({
            where: { id: d.id },
            data: {
              adminTeryt: admin.teryt,
              adminWoj: admin.voivodeship,
              adminPowiat: admin.county,
              adminGmina: admin.commune,
              adminAt: new Date(),
            },
          });
        }
      }
    } catch (e) {
      bledy++;
      podRzad++;
      if (podRzad >= MAX_BLEDOW_POD_RZAD) {
        console.error(`\nPrzerwane: ${MAX_BLEDOW_POD_RZAD} błędów pod rząd. Ostatni:`, e);
        break;
      }
    }

    if ((i + 1) % 50 === 0 || i === doRoboty.length - 1) {
      console.log(`  ${i + 1}/${doRoboty.length}  ustalone=${ustalone} bezWyniku=${bezWyniku} błędy=${bledy}`);
    }
    await spij(PRZERWA_MS);
  }

  console.log("");
  console.log(`Ustalone: ${ustalone}`);
  console.log(`ULDK nie zna działki w tym punkcie: ${bezWyniku}`);
  console.log(`Błędy sieci: ${bledy}`);
  if (wgWojewodztwa.size > 0) {
    console.log("\nWg województwa:");
    for (const [w, n] of [...wgWojewodztwa.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${w}`);
    }
  }
  if (!APPLY) console.log("\nNic nie zapisano (brak --apply).");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
