import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (jak w pozostałych skryptach CRM).
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Deduplikacja ofert powielonych przez podbijanie wersji w externalId (Galactica / DOMY.PL).
 *
 * Skąd problem: eksport podbija licznik w atrybucie `id` oferty (AKM-GS-55571-18 → -19 → -20).
 * Unikat CrmOfferLink(integrationId, externalId) widział nowy byt i tworzył kolejną kopię tej
 * samej działki. Bezpiecznik R1 (deactivateMissingOffers) tego nie sprzątał, bo wymaga pełnego
 * eksportu, a Galactica przysyła praktycznie same różnicowe (6 pełnych plików na 6828).
 *
 * Naprawa na przyszłość siedzi w src/lib/crm/domypl-sync.ts (findLinkByVersionedId).
 * Ten skrypt sprząta to, co już wpadło do bazy.
 *
 * Zasada: w każdej grupie zostaje NAJNOWSZA oferta (ma aktualną cenę i opis, i to jej id
 * trafi w kolejny zrzut). Starsze kopie idą na ZAKONCZONE — soft delete, dokładnie tak samo
 * jak normalne wygaszanie z CRM. Zero DELETE, wszystko odwracalne.
 *
 * Użycie:
 *   npm run crm:dedup            -> raport, nic nie zmienia
 *   npm run crm:dedup -- --apply -> wygasza duplikaty
 *   npm run crm:dedup -- --apply --integration=<id>  -> tylko jedna integracja
 */

// Ten sam wzorzec co w domypl-sync.ts: ucina wyłącznie sufiks wersji, nigdy numeru oferty.
const VERSIONED_EXTERNAL_ID = /^(.*G[SW]-\d+)-\d+$/i;

function baseExternalId(externalId: string): string {
  return externalId.match(VERSIONED_EXTERNAL_ID)?.[1] ?? externalId;
}

type Row = {
  dzialkaId: string;
  linkId: string;
  externalId: string;
  integrationId: string;
  integrationName: string;
  createdAt: Date;
  cenaPln: number;
  powierzchniaM2: number;
  tytul: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const integrationArg = process.argv
    .find((arg) => arg.startsWith("--integration="))
    ?.split("=")[1];

  const { prisma } = await import("../src/lib/prisma");

  const links = await prisma.crmOfferLink.findMany({
    where: {
      dzialka: { status: "AKTYWNE" },
      ...(integrationArg ? { integrationId: integrationArg } : {}),
    },
    select: {
      id: true,
      externalId: true,
      integrationId: true,
      integration: { select: { name: true } },
      dzialka: {
        select: {
          id: true,
          createdAt: true,
          cenaPln: true,
          powierzchniaM2: true,
          tytul: true,
        },
      },
    },
  });

  const rows: Row[] = links.map((link) => ({
    dzialkaId: link.dzialka.id,
    linkId: link.id,
    externalId: link.externalId,
    integrationId: link.integrationId,
    integrationName: link.integration.name,
    createdAt: link.dzialka.createdAt,
    cenaPln: link.dzialka.cenaPln,
    powierzchniaM2: link.dzialka.powierzchniaM2,
    tytul: link.dzialka.tytul,
  }));

  // Grupujemy po (integracja, bazowy externalId). Klucz jest celowo wąski: grupowanie po
  // treści skleiłoby realnie różne działki tego samego biura o tej samej cenie i powierzchni.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.integrationId}::${baseExternalId(row.externalId)}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const duplicated = [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const sorted = [...group].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      return { base: key.split("::")[1], keep: sorted[0], drop: sorted.slice(1) };
    });

  const toDropCount = duplicated.reduce((sum, g) => sum + g.drop.length, 0);

  console.log("");
  console.log(`Aktywnych ofert z CRM:        ${rows.length}`);
  console.log(`Grup z duplikatami:           ${duplicated.length}`);
  console.log(`Ofert zostaje (po jednej):    ${duplicated.length}`);
  console.log(`Kopii do wygaszenia:          ${toDropCount}`);
  console.log("");

  const perIntegration = new Map<string, number>();
  for (const group of duplicated) {
    const name = group.keep.integrationName;
    perIntegration.set(name, (perIntegration.get(name) ?? 0) + group.drop.length);
  }
  console.log("Kopie wg integracji:");
  for (const [name, count] of [...perIntegration].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${name}`);
  }
  console.log("");

  console.log("Przykłady (10 największych grup):");
  for (const group of [...duplicated].sort((a, b) => b.drop.length - a.drop.length).slice(0, 10)) {
    console.log(
      `  ${group.base}  (${group.drop.length + 1} kopii)  ${group.keep.cenaPln} zł / ${group.keep.powierzchniaM2} m²  ${group.keep.tytul}`
    );
    console.log(
      `    ZOSTAJE  ${group.keep.externalId.padEnd(20)} https://tylkodzialki.pl/dzialka/${group.keep.dzialkaId}`
    );
    for (const row of group.drop) {
      console.log(
        `    wygasza  ${row.externalId.padEnd(20)} https://tylkodzialki.pl/dzialka/${row.dzialkaId}`
      );
    }
  }
  console.log("");

  if (!apply) {
    console.log("TRYB RAPORTU — nic nie zmieniono. Aby wykonać: npm run crm:dedup -- --apply");
    await prisma.$disconnect();
    return;
  }

  // Ulubione zapisane na kopii przepinamy na ofertę, która zostaje — inaczej kupujący
  // straciłby działkę z listy tylko dlatego, że trafił akurat na duplikat.
  let movedFavorites = 0;
  let deactivated = 0;
  const now = new Date();

  for (const group of duplicated) {
    for (const row of group.drop) {
      const favorites = await prisma.favoriteDzialka.findMany({
        where: { dzialkaId: row.dzialkaId },
        select: { id: true, userId: true },
      });

      for (const favorite of favorites) {
        const alreadyHas = await prisma.favoriteDzialka.findUnique({
          where: {
            userId_dzialkaId: {
              userId: favorite.userId,
              dzialkaId: group.keep.dzialkaId,
            },
          },
          select: { id: true },
        });

        if (alreadyHas) {
          await prisma.favoriteDzialka.delete({ where: { id: favorite.id } });
        } else {
          await prisma.favoriteDzialka.update({
            where: { id: favorite.id },
            data: { dzialkaId: group.keep.dzialkaId },
          });
          movedFavorites += 1;
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.dzialka.update({
          where: { id: row.dzialkaId },
          data: { status: "ZAKONCZONE", endedAt: now, crmLastSyncedAt: now },
        });

        await tx.crmOfferLink.update({
          where: { id: row.linkId },
          data: { lastDeactivatedAt: now, isActiveInSource: false },
        });

        await tx.crmSyncLog.create({
          data: {
            integrationId: row.integrationId,
            dzialkaId: row.dzialkaId,
            offerLinkId: row.linkId,
            externalId: row.externalId,
            action: "DEACTIVATE",
            status: "SUCCESS",
            message: `Duplikat wersji eksportu — ta sama oferta żyje dalej jako ${group.keep.externalId}.`,
          },
        });
      });

      deactivated += 1;
      if (deactivated % 100 === 0) {
        console.log(`  ... wygaszono ${deactivated}/${toDropCount}`);
      }
    }
  }

  console.log("");
  console.log(`GOTOWE. Wygaszono kopii: ${deactivated}. Przepiętych ulubionych: ${movedFavorites}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Błąd deduplikacji CRM:", error);
  process.exit(1);
});
