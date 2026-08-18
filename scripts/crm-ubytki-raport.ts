import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { prisma } from "../src/lib/prisma";

// RAPORT UBYTKÓW PODAŻY. Tylko odczyt — odpowiada na pytanie „dlaczego spadła liczba ofert"
// bez obchodzenia stron biur po kolei.
//
// Kluczowe rozróżnienie, które robi ten raport: „zgaszony link" ≠ „stracona oferta".
// Silniki gaszą też duplikaty wersji eksportu (ta sama działka wraca pod nowym externalId) —
// dla kupującego nic nie znika, bo bliźniak żyje dalej.
//
// Użycie:
//   npm run crm:ubytki               # ostatnia doba
//   npm run crm:ubytki -- --dni=7

const DNI_ARG = process.argv.find((a) => a.startsWith("--dni="));
const DNI = DNI_ARG ? Number(DNI_ARG.split("=")[1]) : 1;
const OD = new Date(Date.now() - (Number.isFinite(DNI) && DNI > 0 ? DNI : 1) * 24 * 3600 * 1000);

async function main() {
  console.log(`🔎 Ubytki podaży od ${OD.toISOString()} (${DNI} dni). Tylko odczyt.\n`);

  const kategorie = await prisma.$queryRaw<Array<{ kategoria: string; ile: bigint }>>`
    SELECT CASE
             WHEN "message" LIKE '%nie znaleziono jej w bazie%' THEN 'sygnał usunięcia oferty, której u nas nie ma (nie działka)'
             WHEN "message" LIKE '%oferta_usun%' THEN 'Galactica: <oferta_usun>'
             WHEN "message" LIKE '%DELETE z EstiCRM%' THEN 'EstiCRM: sekcja DELETE'
             WHEN "message" LIKE '%DELETE z ASARI%' THEN 'ASARI: sekcja DELETE'
             WHEN "message" LIKE '%LocumNet%' THEN 'LocumNet: removed / mlssta'
             WHEN "message" LIKE 'Duplikat wersji eksportu%' THEN 'duplikat wersji eksportu'
             WHEN "message" LIKE '%pełnego eksportu%' THEN 'brak w pełnym eksporcie'
             ELSE COALESCE("message", '(brak komunikatu)')
           END AS kategoria,
           COUNT(*)::bigint AS ile
    FROM "CrmSyncLog"
    WHERE "createdAt" >= ${OD} AND "action"::text IN ('DEACTIVATE','DELETE')
    GROUP BY 1 ORDER BY ile DESC LIMIT 12
  `;

  console.log("== Sygnały usunięcia wg źródła ==");
  for (const r of kategorie) console.log(`  ${String(r.ile).padStart(6)}  ${r.kategoria}`);

  const zgaszone = await prisma.crmOfferLink.count({
    where: { isActiveInSource: false, lastDeactivatedAt: { gte: OD } },
  });

  // Duplikaty: z komunikatu wyciągamy externalId bliźniaka i sprawdzamy, czy żyje.
  const duplikaty = await prisma.$queryRaw<Array<{ wynik: string; ile: bigint }>>`
    WITH dup AS (
      SELECT s."integrationId",
             substring(s."message" from 'żyje dalej jako ([^.]+)') AS blizniak,
             s."offerLinkId"
      FROM "CrmSyncLog" s
      WHERE s."createdAt" >= ${OD} AND s."message" LIKE 'Duplikat wersji eksportu%'
    )
    SELECT CASE
             WHEN b."id" IS NULL THEN 'bliźniaka BRAK w bazie (realny ubytek)'
             WHEN b."isActiveInSource" = false THEN 'bliźniak też zgaszony (realny ubytek)'
             WHEN d."status"::text = 'AKTYWNE' THEN 'bliźniak żywy i widoczny (NIE ubytek)'
             ELSE 'bliźniak aktywny w źródle, działka: ' || COALESCE(d."status"::text, 'brak')
           END AS wynik,
           COUNT(DISTINCT dup."offerLinkId")::bigint AS ile
    FROM dup
    LEFT JOIN "CrmOfferLink" b ON b."integrationId" = dup."integrationId" AND b."externalId" = dup.blizniak
    LEFT JOIN "Dzialka" d ON d."id" = b."dzialkaId"
    GROUP BY 1 ORDER BY ile DESC
  `;

  console.log("\n== Duplikaty wersji eksportu (te NIE są utratą podaży) ==");
  let pozorne = 0;
  for (const r of duplikaty) {
    console.log(`  ${String(r.ile).padStart(6)}  ${r.wynik}`);
    if (r.wynik.includes("NIE ubytek")) pozorne += Number(r.ile);
  }

  // Test poprawności: czy zgaszona oferta nadal przychodzi w feedzie biura.
  const wrocily = await prisma.$queryRaw<Array<{ ile: bigint }>>`
    SELECT COUNT(*)::bigint AS ile FROM "CrmOfferLink"
    WHERE "isActiveInSource" = false AND "lastDeactivatedAt" >= ${OD}
      AND "lastSeenAt" IS NOT NULL AND "lastSeenAt" > "lastDeactivatedAt"
  `;

  const wiek = await prisma.$queryRaw<Array<{ przedzial: string; ile: bigint }>>`
    SELECT CASE
             WHEN "lastSeenAt" IS NULL THEN 'brak daty'
             WHEN "lastSeenAt" > NOW() - INTERVAL '7 days'  THEN 'biuro wysyłało ją jeszcze w tym tygodniu'
             WHEN "lastSeenAt" > NOW() - INTERVAL '30 days' THEN 'przestało wysyłać 7-30 dni temu'
             WHEN "lastSeenAt" > NOW() - INTERVAL '90 days' THEN 'przestało wysyłać 1-3 miesiące temu'
             ELSE 'przestało wysyłać ponad 3 miesiące temu'
           END AS przedzial,
           COUNT(*)::bigint AS ile
    FROM "CrmOfferLink"
    WHERE "isActiveInSource" = false AND "lastDeactivatedAt" >= ${OD}
    GROUP BY 1 ORDER BY ile DESC
  `;

  console.log("\n== Jak dawno biuro przestało je wysyłać ==");
  for (const r of wiek) console.log(`  ${String(r.ile).padStart(6)}  ${r.przedzial}`);

  const wgBiura = await prisma.$queryRaw<Array<{ provider: string; path: string | null; ile: bigint; aktywne: bigint }>>`
    SELECT i."provider"::text AS provider, i."ftpRemotePath" AS path,
           COUNT(*) FILTER (WHERE l."isActiveInSource" = false AND l."lastDeactivatedAt" >= ${OD})::bigint AS ile,
           COUNT(*) FILTER (WHERE l."isActiveInSource" = true)::bigint AS aktywne
    FROM "CrmOfferLink" l
    JOIN "CrmIntegration" i ON i."id" = l."integrationId"
    GROUP BY 1, 2
    HAVING COUNT(*) FILTER (WHERE l."isActiveInSource" = false AND l."lastDeactivatedAt" >= ${OD}) > 0
    ORDER BY ile DESC LIMIT 15
  `;

  console.log("\n== Top biura (zgaszone / zostało aktywnych) ==");
  for (const r of wgBiura) {
    console.log(`  ${String(r.ile).padStart(5)} / ${String(r.aktywne).padStart(5)}  ${r.provider} ${r.path ?? ""}`);
  }

  const aktywneDzialki = await prisma.dzialka.count({ where: { status: "AKTYWNE" } });

  console.log("\n== Podsumowanie ==");
  console.log(`  zgaszonych linków:            ${zgaszone}`);
  console.log(`  z tego pozornych (duplikaty): ${pozorne}`);
  console.log(`  REALNY ubytek podaży:         ${zgaszone - pozorne}`);
  console.log(`  wróciło do feedu po zgaszeniu: ${wrocily[0].ile}  ← musi być 0, inaczej gasimy za ostro`);
  console.log(`  działki AKTYWNE w bazie:      ${aktywneDzialki}`);
}

main()
  .catch((error) => {
    console.error("💥 Raport przerwany:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
