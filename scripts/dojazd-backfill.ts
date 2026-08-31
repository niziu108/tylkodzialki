import dotenv from "dotenv";

// Env przed Prisma, jak w pozostałych skryptach CRM.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Uzupełnia `Dzialka.dojazd` dla ofert zaimportowanych PRZED wdrożeniem tego pola.
 *
 * Skąd dane, skoro pola wtedy nie zapisywaliśmy: silniki od zawsze odkładają surowy payload
 * oferty w `CrmSyncLog`. Dla DOMY.PL (Galactica, IMOX, Propertly) siedzi tam `params.drogadojazdowa`,
 * dla EstiCRM `groundRoad`. Bez tego skryptu filtr zapełniałby się tygodniami, bo oferta dostaje
 * nową wartość dopiero, gdy biuro ją zaktualizuje, a paczki różnicowe dotykają ułamka portfela.
 *
 * Bezpieczeństwo: rusza WYŁĄCZNIE oferty z `dojazd = BRAK_INFORMACJI`, czyli nigdy nie nadpisuje
 * wartości odczytanej na żywo z feedu. Powtarzalny: drugi przebieg nie ma już czego poprawiać.
 *
 * Uruchomienie:
 *   npm run dojazd:backfill          -> raport, NIC nie zapisuje
 *   npm run dojazd:backfill -- --apply
 */

const APPLY = process.argv.includes("--apply");

type Payload = {
  params?: Record<string, unknown>;
  groundRoad?: unknown;
} | null;

function surowaWartosc(payload: Payload): string | null {
  if (!payload || typeof payload !== "object") return null;

  const zParams = payload.params?.drogadojazdowa;
  if (typeof zParams === "string" && zParams.trim()) return zParams;

  // EstiCRM zapisuje albo tekst, albo węzeł ze słownikiem — bierzemy tylko czytelny tekst.
  if (typeof payload.groundRoad === "string" && payload.groundRoad.trim()) return payload.groundRoad;

  return null;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { mapDojazd } = await import("../src/lib/dojazd");

  console.log(APPLY ? "TRYB ZAPISU\n" : "TRYB RAPORTU (nic nie zapisuję, dodaj --apply)\n");

  // Najnowszy payload per działka. DISTINCT ON zamiast pętli po ofertach: logów są miliony,
  // a interesuje nas tylko ostatni stan każdej z nich.
  const wiersze = await prisma.$queryRaw<Array<{ dzialkaId: string; payload: Payload }>>`
    SELECT DISTINCT ON (l."dzialkaId") l."dzialkaId", l.payload
    FROM "CrmSyncLog" l
    JOIN "Dzialka" d ON d.id = l."dzialkaId"
    WHERE l."dzialkaId" IS NOT NULL
      AND l.payload IS NOT NULL
      AND l.action IN ('CREATE', 'UPDATE')
      AND d."dojazd" = 'BRAK_INFORMACJI'
    ORDER BY l."dzialkaId", l."createdAt" DESC`;

  console.log(`Ofert do sprawdzenia: ${wiersze.length}`);

  const wgStanu = new Map<string, string[]>();
  let bezWartosci = 0;

  for (const w of wiersze) {
    const raw = surowaWartosc(w.payload);
    if (!raw) {
      bezWartosci += 1;
      continue;
    }
    const stan = mapDojazd(raw);
    if (stan === "BRAK_INFORMACJI") {
      bezWartosci += 1;
      continue;
    }
    const lista = wgStanu.get(stan) ?? [];
    lista.push(w.dzialkaId);
    wgStanu.set(stan, lista);
  }

  const doZapisu = [...wgStanu.entries()].sort((a, b) => b[1].length - a[1].length);
  const suma = doZapisu.reduce((s, [, ids]) => s + ids.length, 0);

  console.log(`Bez czytelnej wartości (zostają BRAK_INFORMACJI): ${bezWartosci}`);
  console.log(`Do uzupełnienia: ${suma}\n`);
  for (const [stan, ids] of doZapisu) {
    console.log(`  ${stan.padEnd(16)} ${String(ids.length).padStart(5)}`);
  }

  if (!APPLY) {
    console.log("\nNic nie zapisano. Aby wykonać: npm run dojazd:backfill -- --apply");
    await prisma.$disconnect();
    return;
  }

  let zapisane = 0;
  for (const [stan, ids] of doZapisu) {
    for (let i = 0; i < ids.length; i += 500) {
      const partia = ids.slice(i, i + 500);
      const r = await prisma.dzialka.updateMany({
        // Warunek na BRAK_INFORMACJI powtórzony świadomie: między odczytem a zapisem mógł
        // przebiec import i ustawić wartość na żywo. Ta ma pierwszeństwo przed odtworzoną.
        where: { id: { in: partia }, dojazd: "BRAK_INFORMACJI" },
        data: { dojazd: stan as never },
      });
      zapisane += r.count;
    }
  }

  console.log(`\nZaktualizowano ofert: ${zapisane}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Błąd backfillu dojazdu:", e);
  process.exitCode = 1;
});
