import dotenv from "dotenv";
import type { OfertaDoRaportu, SprawdzonaDzialka, ZrodloDzialki } from "../src/lib/raportOferty";

// Env przed Prisma, jak w pozostałych skryptach.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Raport działki pod ofertą (`DzialkaRaport`, src/lib/raportOferty.ts): nadrabia oferty, dla
 * których da się uczciwie wskazać działkę ewidencyjną, czyli dokładna pinezka albo numer działki
 * z opisu biura potwierdzony w ULDK. Nowe oferty uzupełniają się same po pierwszym wejściu na
 * ofertę (after() w app/dzialka/[id]), więc to narzędzie do jednorazowego nadrobienia bazy
 * i do mierzenia skuteczności reguł.
 *
 * Bez `--apply` NIC nie zapisuje: ustala działki i pokazuje, ile się udaje i dlaczego nie.
 *
 * Uruchomienie:
 *   npm run raporty:backfill -- --limit 60          -> próba na sucho na 60 losowych ofertach
 *   npm run raporty:backfill -- --apply             -> zapis (pomija oferty z aktualnym raportem)
 *   npm run raporty:backfill -- --apply --odswiez   -> liczy od nowa także gotowe raporty
 *   --rownolegle 3                                  -> ile ofert naraz (domyślnie 2, najwyżej 4)
 */

// `ponow` = oferta ma już wiersz z BLAD. Skrypt ponawia go od razu (po to się go uruchamia),
// a strona oferty dopiero po dobie.
type Kandydat = { o: OfertaDoRaportu; zrodlo: ZrodloDzialki; klucz: string; ponow: boolean };

const APPLY = process.argv.includes("--apply");
const ODSWIEZ = process.argv.includes("--odswiez");

function liczbaZArgumentu(nazwa: string, domyslna: number): number {
  const i = process.argv.indexOf(nazwa);
  if (i === -1) return domyslna;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : domyslna;
}

const LIMIT = liczbaZArgumentu("--limit", Infinity);
// Grzeczność wobec GUGiK: ULDK i WMS to darmowe usługi publiczne.
const ROWNOLEGLE = Math.min(liczbaZArgumentu("--rownolegle", 2), 4);
const PRZERWA_MS = 200;
// Po ilu z rzędu błędach przerywamy (usługa leży, nie ma sensu dobijać).
const MAX_BLEDOW_POD_RZAD = 15;

const spij = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dolicz(mapa: Map<string, number>, klucz: string) {
  mapa.set(klucz, (mapa.get(klucz) ?? 0) + 1);
}

// Rozkład „powierzchnia z ewidencji / powierzchnia z ogłoszenia" dla działek znalezionych w ULDK.
// Z niego ustawiamy tolerancję MAX_ROZNICA_POWIERZCHNI w lib/dzialkaZOpisu.ts.
const GRANICE = [0.5, 0.67, 0.8, 0.9, 1.1, 1.25, 1.5, 2];
const PRZEDZIALY = [...GRANICE.map((g, i) => `${i === 0 ? 0 : GRANICE[i - 1]}-${g}`), `>=${GRANICE[GRANICE.length - 1]}`];

function przedzial(stosunek: number): string {
  const i = GRANICE.findIndex((g) => stosunek < g);
  return PRZEDZIALY[i === -1 ? PRZEDZIALY.length - 1 : i];
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const raporty = await import("../src/lib/raportOferty");

  const oferty = await prisma.dzialka.findMany({
    where: { status: "AKTYWNE" },
    select: raporty.OFERTA_DO_RAPORTU_SELECT,
  });

  // Istniejące raporty. Przed migracją tabeli nie ma, a próba na sucho i tak ma działać.
  const istniejace = new Map<string, { klucz: string; status: string }>();
  try {
    const rows = await prisma.dzialkaRaport.findMany({ select: { dzialkaId: true, klucz: true, status: true } });
    for (const r of rows) istniejace.set(r.dzialkaId, r);
  } catch (e) {
    if (APPLY) throw e;
    console.log("(tabeli DzialkaRaport jeszcze nie ma: liczę wszystko od zera)\n");
  }

  const kandydaci: Kandydat[] = [];
  for (const o of oferty) {
    const wejscie = raporty.wejscieRaportu(o);
    if (!wejscie) continue;
    const jest = istniejace.get(o.id);
    if (!ODSWIEZ && jest && jest.klucz === wejscie.klucz && jest.status !== "BLAD") continue;
    kandydaci.push({ o, ...wejscie, ponow: jest?.status === "BLAD" });
  }

  // Próba na sucho idzie na losowej próbce, żeby nie mierzyć samych najnowszych ofert jednego biura.
  if (!APPLY) {
    for (let i = kandydaci.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kandydaci[i], kandydaci[j]] = [kandydaci[j], kandydaci[i]];
    }
  }
  const doRoboty = Number.isFinite(LIMIT) ? kandydaci.slice(0, LIMIT) : kandydaci;

  const pinezki = kandydaci.filter((k) => k.zrodlo === "PINEZKA").length;
  console.log(`Aktywne oferty: ${oferty.length}`);
  console.log(
    `Do sprawdzenia: ${kandydaci.length} (dokładna pinezka ${pinezki}, numer w opisie ${kandydaci.length - pinezki})`
  );
  console.log(`W tym przebiegu: ${doRoboty.length}, naraz: ${ROWNOLEGLE}`);
  console.log(APPLY ? "TRYB: zapis do bazy" : "TRYB: próba na sucho, NIC nie zapisuje. Dodaj --apply, żeby zapisać.");
  console.log("");

  const wyniki = new Map<string, number>();
  const powody = new Map<string, number>();
  const stosunki = new Map<string, number>();
  const odrzucone: string[] = [];
  let zrobione = 0;
  let bledyPodRzad = 0;
  let przerwane = false;

  async function sprawdz(k: Kandydat) {
    try {
      if (APPLY) {
        const wynik = await raporty.odswiezRaportOferty(k.o.id, { wymus: ODSWIEZ || k.ponow });
        dolicz(wyniki, wynik);
        bledyPodRzad = wynik === "BLAD" ? bledyPodRzad + 1 : 0;
        return;
      }

      const sprawdzone: SprawdzonaDzialka[] = [];
      const wynik = await raporty.ustalDzialke(k.o, k.zrodlo, sprawdzone);
      bledyPodRzad = 0;
      dolicz(wyniki, `${k.zrodlo} ${wynik.status}`);
      for (const s of sprawdzone) if (s.stosunek != null) dolicz(stosunki, przedzial(s.stosunek));

      if (wynik.status === "BRAK") {
        dolicz(powody, wynik.powod);
        if (sprawdzone.length > 0 && odrzucone.length < 15) {
          const opisy = sprawdzone.map(
            (s) => `${s.id} ${s.km == null ? "?" : s.km.toFixed(1)} km, x${s.stosunek == null ? "?" : s.stosunek.toFixed(2)}`
          );
          odrzucone.push(`${k.o.id} | ${k.o.locationLabel ?? ""} | ${k.o.powierzchniaM2} m² | ${opisy.join("; ")}`);
        }
      }
    } catch (e) {
      dolicz(wyniki, "BLAD");
      bledyPodRzad++;
      if (bledyPodRzad === MAX_BLEDOW_POD_RZAD) console.error("Ostatni błąd:", e);
    } finally {
      zrobione++;
      if (zrobione % 25 === 0 || zrobione === doRoboty.length) {
        console.log(`  ${zrobione}/${doRoboty.length}  ${[...wyniki].map(([w, n]) => `${w}=${n}`).join("  ")}`);
      }
    }
  }

  let nastepna = 0;
  await Promise.all(
    Array.from({ length: ROWNOLEGLE }, async () => {
      while (!przerwane && nastepna < doRoboty.length) {
        await sprawdz(doRoboty[nastepna++]);
        if (bledyPodRzad >= MAX_BLEDOW_POD_RZAD && !przerwane) {
          przerwane = true;
          console.error(`\nPrzerwane: ${MAX_BLEDOW_POD_RZAD} błędów pod rząd.`);
        }
        await spij(PRZERWA_MS);
      }
    })
  );

  console.log("\nWyniki:");
  for (const [w, n] of [...wyniki].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${w}`);

  if (powody.size > 0) {
    console.log("\nDlaczego bez raportu:");
    for (const [p, n] of [...powody].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${p}`);
  }

  if (stosunki.size > 0) {
    console.log("\nPowierzchnia z ewidencji / z ogłoszenia (działki znalezione w ULDK):");
    for (const p of PRZEDZIALY) if (stosunki.get(p)) console.log(`  ${p.padEnd(9)} ${stosunki.get(p)}`);
  }

  if (odrzucone.length > 0) {
    console.log("\nPrzykłady odrzuconych:");
    for (const l of odrzucone) console.log(`  ${l}`);
  }

  if (!APPLY) console.log("\nNic nie zapisano (brak --apply).");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
