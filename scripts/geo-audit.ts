/**
 * READ-ONLY audyt geolokalizacji ofert.
 * Nic nie zapisuje. Klasyfikuje oferty z lat/lng poza Polską i wskazuje źródło (CRM/provider/format).
 * Uruchom: npx tsx scripts/geo-audit.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

// Bounding box Polski (z lekkim marginesem na krańce kraju).
const PL = { latMin: 48.9, latMax: 55.05, lngMin: 13.95, lngMax: 24.25 };

function inPoland(lat: number, lng: number) {
  return lat >= PL.latMin && lat <= PL.latMax && lng >= PL.lngMin && lng <= PL.lngMax;
}

async function main() {
  const all = await prisma.dzialka.findMany({
    select: {
      id: true,
      tytul: true,
      lat: true,
      lng: true,
      locationLabel: true,
      locationFull: true,
      locationMode: true,
      sourceType: true,
      status: true,
      crmOfferLinks: {
        select: {
          externalId: true,
          integration: { select: { name: true, provider: true, feedFormat: true } },
        },
      },
    },
  });

  const total = all.length;
  const withGeo = all.filter((d) => typeof d.lat === "number" && typeof d.lng === "number");
  const noGeo = total - withGeo.length;

  const outside = withGeo.filter((d) => !inPoland(d.lat as number, d.lng as number));
  const zeroish = outside.filter((d) => Math.abs(d.lat as number) < 0.5 && Math.abs(d.lng as number) < 0.5);
  const swapped = outside.filter((d) => {
    const lat = d.lat as number, lng = d.lng as number;
    return !inPoland(lat, lng) && inPoland(lng, lat); // po zamianie osi trafia w PL
  });
  const otherBad = outside.filter((d) => !zeroish.includes(d) && !swapped.includes(d));

  const tag = (d: (typeof all)[number]) => {
    const link = d.crmOfferLinks[0];
    if (!link) return `${d.sourceType}/—`;
    const i = link.integration;
    return `${i.provider}/${i.feedFormat} (${i.name})`;
  };

  const groupBy = (rows: typeof all) => {
    const m = new Map<string, number>();
    for (const d of rows) m.set(tag(d), (m.get(tag(d)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log("================ AUDYT GEOLOKALIZACJI ================");
  console.log(`Ofert w bazie:            ${total}`);
  console.log(`  z lat/lng:              ${withGeo.length}`);
  console.log(`  bez lat/lng (null):     ${noGeo}`);
  console.log("");
  console.log(`POZA POLSKĄ (bbox):       ${outside.length}  (${((outside.length / withGeo.length) * 100).toFixed(2)}% z geo)`);
  console.log(`  ├─ ~ (0,0) null-island: ${zeroish.length}   -> objaw "Afryka/Atlantyk"`);
  console.log(`  ├─ zamienione osie:     ${swapped.length}   -> objaw "Bliski Wschód/Syria"`);
  console.log(`  └─ inne (poza skalą):   ${otherBad.length}`);
  console.log("");

  console.log("--- POZA POLSKĄ wg źródła ---");
  for (const [k, n] of groupBy(outside)) console.log(`  ${String(n).padStart(4)}  ${k}`);

  console.log("");
  console.log("--- ZAMIENIONE OSIE wg źródła ---");
  for (const [k, n] of groupBy(swapped)) console.log(`  ${String(n).padStart(4)}  ${k}`);

  console.log("");
  console.log("--- (0,0) wg źródła ---");
  for (const [k, n] of groupBy(zeroish)) console.log(`  ${String(n).padStart(4)}  ${k}`);

  console.log("");
  console.log("--- PRÓBKA: do 30 ofert poza Polską ---");
  for (const d of outside.slice(0, 30)) {
    const cat = zeroish.includes(d) ? "ZERO" : swapped.includes(d) ? "SWAP" : "INNE";
    const loc = (d.locationLabel || d.locationFull || "—").slice(0, 38).padEnd(38);
    console.log(
      `  [${cat}] ${d.status.padEnd(9)} lat=${String(d.lat).slice(0, 9).padEnd(9)} lng=${String(d.lng).slice(0, 9).padEnd(9)} | ${loc} | ${tag(d)} | ext=${d.crmOfferLinks[0]?.externalId ?? "—"}`
    );
  }

  // Czy "SWAP" naprawdę trafiałby w PL — pokaż przykładowe przeliczenie
  if (swapped.length) {
    console.log("");
    console.log("--- DOWÓD SWAP: (lat,lng) -> po zamianie (lng,lat) ---");
    for (const d of swapped.slice(0, 8)) {
      console.log(`  ${d.locationLabel ?? "—"}: zapis (${d.lat}, ${d.lng})  =>  po zamianie (${d.lng}, ${d.lat})  [${d.lng},${d.lat} w PL]`);
    }
  }

  console.log("======================================================");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
