import fs from "node:fs";
import path from "node:path";

/**
 * Tabela gmin, których plany miejscowe krajowa integracja MPZP bierze z hostingu GISON
 * (src/lib/mpzpGisonGminy.ts). Źródło: publiczny rejestr usług GUGiK (EZiUDP, eksport CSV), czyli
 * ten sam, z którego krajowa integracja zna adresy serwerów gmin. Bez bazy danych.
 *
 * Po co: serwery GISON wiszą dla krajowej integracji falami (wszystkie gminy naraz, ~60 s i „brak
 * wyniku"), a ten sam serwer pytany wprost odpowiada w ułamku sekundy. Pomiar 2026-09-16 opisany
 * w lib/mpzp.ts przy `getMpzpAtPoint`.
 *
 * Do tabeli trafia tylko gmina, której JEDYNĄ usługą przeglądania planów miejscowych w rejestrze
 * jest https://rastry.gison.pl/wms/<profil>. Gmina z kilkoma usługami (np. GISON i drugi dostawca)
 * zostaje przy samej krajowej integracji, bo GISON nie ma wtedy wszystkich jej planów. Odpada też
 * profil, którego usługa nie ma warstw z WARSTWY (część gmin ma starszy układ bez obrysu gminy):
 * zapytanie wprost skończyłoby się tam wyjątkiem i tylko opóźniało odczyt.
 *
 * Katalog metadanych GISON NIE nadaje się na źródło: we wrześniu 2026 wymieniał 19 gmin, które
 * rejestr GUGiK prowadzi już u innego dostawcy.
 *
 * Uruchomienie (raz na kilka miesięcy albo gdy log pokaże gminę spoza tabeli):
 *   npm run mpzp:gison
 */

const REJESTR_CSV = "https://integracja.gugik.gov.pl/eziudp/api.php?&format=csv";
const PLIK = path.join(__dirname, "..", "src", "lib", "mpzpGisonGminy.ts");
const GISON_WMS = /^https:\/\/rastry\.gison\.pl\/wms\/([a-z0-9_]+)\/?$/;
// Warstwy, o które lib/mpzp.ts pyta serwer GISON (GISON_WARSTWY); każda musi być odpytywalna.
const WARSTWY = ["maska", "app.AktPlanowaniaPrzestrzennego.MPZP"];

async function maWarstwy(profil: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://rastry.gison.pl/wms/${profil}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`,
      { signal: AbortSignal.timeout(30_000) }
    );
    const xml = await res.text();
    return WARSTWY.every((w) =>
      new RegExp(`<Layer[^>]*queryable="1"[^>]*>\\s*<Name>${w.replace(/\./g, "\\.")}</Name>`).test(xml)
    );
  } catch {
    return false;
  }
}

// CSV rejestru: średnik, pola w cudzysłowach, cudzysłów w polu podwojony.
function wierszeCsv(tekst: string): string[][] {
  const wiersze: string[][] = [];
  let wiersz: string[] = [];
  let pole = "";
  let wCudzyslowie = false;
  for (let i = 0; i < tekst.length; i++) {
    const znak = tekst[i];
    if (wCudzyslowie) {
      if (znak !== '"') pole += znak;
      else if (tekst[i + 1] === '"') {
        pole += '"';
        i++;
      } else wCudzyslowie = false;
    } else if (znak === '"') wCudzyslowie = true;
    else if (znak === ";") {
      wiersz.push(pole);
      pole = "";
    } else if (znak === "\n") {
      wiersz.push(pole.replace(/\r$/, ""));
      wiersze.push(wiersz);
      wiersz = [];
      pole = "";
    } else pole += znak;
  }
  if (pole || wiersz.length) wiersze.push([...wiersz, pole]);
  return wiersze;
}

async function main() {
  const res = await fetch(REJESTR_CSV, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`rejestr GUGiK: HTTP ${res.status}`);
  const [naglowek, ...dane] = wierszeCsv((await res.text()).replace(/^﻿/, ""));
  const kol = (nazwa: string) => {
    const i = naglowek.indexOf(nazwa);
    if (i === -1) throw new Error(`rejestr GUGiK: brak kolumny „${nazwa}", zmienił się format eksportu`);
    return i;
  };
  const [TERYT, ZBIOR, PRZEGLADANIE] = [kol("TERYT"), kol("Zbiór"), kol("Usługa Przeglądania")];

  // TERYT gminy (6 cyfr, bez typu po podkreślniku) -> wszystkie adresy usług przeglądania MPZP.
  const uslugi = new Map<string, Set<string>>();
  for (const w of dane) {
    const teryt = w[TERYT]?.match(/^(\d{6})(?:_\d)?$/)?.[1];
    if (!teryt || !/miejscowych planów zagospodarowania/i.test(w[ZBIOR] ?? "")) continue;
    const adresy = (w[PRZEGLADANIE] ?? "")
      .split(/,\s*/)
      .map((a) => a.replace(/^WMS=/i, "").trim())
      .filter(Boolean);
    const zbior = uslugi.get(teryt) ?? new Set<string>();
    adresy.forEach((a) => zbior.add(a));
    uslugi.set(teryt, zbior);
  }

  const kandydaci: [string, string][] = [];
  let wielu = 0;
  for (const [teryt, adresy] of uslugi) {
    const profile = [...adresy].map((a) => a.match(GISON_WMS)?.[1] ?? null);
    if (!profile.some(Boolean)) continue;
    if (profile.length !== 1 || !profile[0]) {
      wielu++;
      continue;
    }
    kandydaci.push([teryt, profile[0]]);
  }

  // Grzecznie wobec GISON: po 4 zapytania naraz.
  const gminy: [string, string][] = [];
  const bezWarstw: string[] = [];
  for (let i = 0; i < kandydaci.length; i += 4) {
    const paczka = kandydaci.slice(i, i + 4);
    const wyniki = await Promise.all(paczka.map(([, profil]) => maWarstwy(profil)));
    paczka.forEach((g, j) => (wyniki[j] ? gminy.push(g) : bezWarstw.push(g[1])));
  }
  gminy.sort(([a], [b]) => a.localeCompare(b));
  if (gminy.length < 300) throw new Error(`podejrzanie mało gmin GISON (${gminy.length}), tabela bez zmian`);

  const dzis = new Date().toISOString().slice(0, 10);
  const tresc = `// Wygenerowane przez scripts/mpzp-gison-gminy.ts (npm run mpzp:gison) z rejestru usług GUGiK
// (EZiUDP) ${dzis}. Nie edytować ręcznie. TERYT gminy (6 cyfr) -> profil gminy na hostingu GISON,
// czyli usługa https://rastry.gison.pl/wms/<profil>, z której plany bierze krajowa integracja.
export const GISON_GMINY: Record<string, string> = {
${gminy.map(([t, p]) => `  '${t}': '${p}',`).join("\n")}
};
`;
  fs.writeFileSync(PLIK, tresc);
  console.log(`Zapisano ${gminy.length} gmin GISON do ${path.relative(process.cwd(), PLIK)}.`);
  console.log(`Pominięte gminy z GISON i drugą usługą planów: ${wielu}.`);
  console.log(`Pominięte profile bez warstw ${WARSTWY.join(", ")}: ${bezWarstw.length} (${bezWarstw.join(", ")}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
