import dotenv from "dotenv";

// Env musi być załadowany ZANIM zaimportujemy Prisma (jak w pozostałych skryptach CRM).
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Raport bezczynności ofert CRM — diagnostyka, nie rutynowe wygaszanie.
 *
 * Sprzedane działki Galactiki gasi `<oferta_usun>` (naprawione w domypl-sync.ts, zaległości
 * nadrabia scripts/crm-usun-backfill.ts). Ten skrypt liczy co innego: jak długo oferty stoją
 * bez potwierdzenia w eksporcie. Cisza nie jest dowodem sprzedaży — przy eksporcie różnicowym
 * znaczy tylko tyle, że biuro nic nie zmieniło (szczegóły i dowód: docs/CRM_WYGASZANIE_OFERT.md).
 * Przydaje się do wyłapania biur, którym eksport zastygł albo się zepsuł.
 *
 * Logika i bezpieczniki siedzą w src/lib/crm/expireStaleOffers.ts — ten plik to tylko CLI.
 *
 * Użycie:
 *   npm run crm:expire                       -> raport, nic nie zmienia (domyślnie próg 90 dni)
 *   npm run crm:expire -- --dni=120          -> ten sam raport przy innym progu
 *   npm run crm:expire -- --kalibracja       -> rozkłady, na których dobiera się próg
 *   npm run crm:expire -- --apply            -> wygasza (soft delete + wpis w CrmSyncLog)
 *   npm run crm:expire -- --apply --limit=50 -> ostrożny pierwszy przebieg
 *   npm run crm:expire -- --integracja=<id>  -> tylko jedno biuro
 *   npm run crm:expire -- --provider=ALL     -> wszystkie źródła, nie tylko GALACTICA
 */

// Uwaga: importy modułów dotykających bazy są dynamiczne (jak w pozostałych skryptach CRM),
// bo statyczne wykonałyby się PRZED dotenv.config() powyżej.
import type { CrmProvider } from "@prisma/client";
import type { ExpireStaleReport } from "../src/lib/crm/expireStaleOffers";

const DAY_MS = 24 * 60 * 60 * 1000;

function numberArg(name: string): number | undefined {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Zły argument --${name}=${raw}`);
  return value;
}

function stringArg(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

async function providerArg(): Promise<CrmProvider | null | undefined> {
  const raw = stringArg("provider");
  if (raw === undefined) return undefined;
  if (raw.toUpperCase() === "ALL") return null;
  const { CrmProvider: providers } = await import("@prisma/client");
  if (!(raw.toUpperCase() in providers)) throw new Error(`Nieznany provider: ${raw}`);
  return raw.toUpperCase() as CrmProvider;
}

/**
 * Kalibracja progu. Dwa rozkłady, na które trzeba patrzeć razem:
 *  - wiek `lastSeenAt` aktywnych ofert (ile w ogóle jest przestarzałych),
 *  - przerwy między kolejnymi wystąpieniami tej samej oferty w plikach (ile ciszy potrafi
 *    wytrzymać oferta, która żyje) — to one mówią, gdzie próg przestaje być fałszywką.
 */
async function runCalibration(provider: CrmProvider | null) {
  const { prisma } = await import("../src/lib/prisma");
  const now = Date.now();
  const where = provider ? { integration: { provider } } : {};

  const links = await prisma.crmOfferLink.findMany({
    where: { ...where, isActiveInSource: true, dzialka: { status: "AKTYWNE" } },
    select: {
      integrationId: true,
      lastSeenAt: true,
      integration: { select: { name: true, provider: true } },
    },
  });

  const perIntegration = new Map<string, { name: string; provider: string; ages: number[] }>();
  for (const link of links) {
    if (!link.lastSeenAt) continue;
    const entry = perIntegration.get(link.integrationId) ?? {
      name: link.integration.name,
      provider: link.integration.provider,
      ages: [],
    };
    entry.ages.push(Math.floor((now - link.lastSeenAt.getTime()) / DAY_MS));
    perIntegration.set(link.integrationId, entry);
  }

  console.log("");
  console.log("=== WIEK lastSeenAt AKTYWNYCH OFERT (per integracja) ===");
  console.log(
    "integracja".padEnd(34) + "aktyw".padStart(7) + "mediana".padStart(9) + "≥45d".padStart(7) + "≥60d".padStart(7) + "≥90d".padStart(7) + "≥120d".padStart(7)
  );
  const rows = [...perIntegration.entries()].sort((a, b) => b[1].ages.length - a[1].ages.length);
  for (const [id, entry] of rows) {
    const sorted = [...entry.ages].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(
      `${entry.name.slice(0, 24).padEnd(26)}${id.slice(-6).padEnd(8)}` +
        String(entry.ages.length).padStart(7) +
        String(median).padStart(9) +
        String(entry.ages.filter((a) => a >= 45).length).padStart(7) +
        String(entry.ages.filter((a) => a >= 60).length).padStart(7) +
        String(entry.ages.filter((a) => a >= 90).length).padStart(7) +
        String(entry.ages.filter((a) => a >= 120).length).padStart(7)
    );
  }

  const logs = await prisma.crmSyncLog.findMany({
    where: {
      ...(provider ? { integration: { provider } } : {}),
      action: { in: ["CREATE", "UPDATE", "REACTIVATE"] },
      status: "SUCCESS",
    },
    select: { offerLinkId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const history = new Map<string, Date[]>();
  for (const log of logs) {
    if (!log.offerLinkId) continue;
    const arr = history.get(log.offerLinkId) ?? [];
    arr.push(log.createdAt);
    history.set(log.offerLinkId, arr);
  }

  const gaps: number[] = [];
  for (const dates of history.values()) {
    for (let i = 1; i < dates.length; i += 1) {
      gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / DAY_MS);
    }
  }

  const oldestLog = logs[0]?.createdAt;
  console.log("");
  console.log("=== CISZA, PO KTÓREJ OFERTA JEDNAK WRÓCIŁA (koszt fałszywego wygaszenia) ===");
  console.log(`okno obserwacji: ${oldestLog ? Math.floor((now - oldestLog.getTime()) / DAY_MS) : "?"} dni, przerw: ${gaps.length}`);
  for (const threshold of [30, 45, 60, 75, 90, 120]) {
    const hit = gaps.filter((gap) => gap >= threshold).length;
    console.log(
      `  próg ${String(threshold).padStart(3)}d: ${String(hit).padStart(5)} ofert wróciłoby po wygaszeniu (${((hit / Math.max(1, gaps.length)) * 100).toFixed(2)}% przerw)`
    );
  }
  console.log("");
  console.log("Próg dobieramy tam, gdzie ta liczba schodzi do marginesu — przerwy dłuższe niż okno");
  console.log("obserwacji są jeszcze niewidoczne, więc kalibrację warto powtórzyć za kilka miesięcy.");

  await prisma.$disconnect();
}

function printReport(report: ExpireStaleReport) {
  const { options } = report;

  console.log("");
  console.log(
    `Próg ciszy: ${options.days} dni | kanał musi mieć plik z ostatnich ${options.feedMaxAgeDays} dni | ` +
      `min. ${options.minFilesSince} plików po ostatnim wystąpieniu | hamulec udziału: ${options.maxSharePercent}%`
  );
  console.log(
    `Zakres: ${options.provider ?? "wszystkie źródła"}${options.integrationId ? ` / integracja ${options.integrationId}` : ""}${options.limit !== null ? ` | limit ${options.limit}` : ""}`
  );
  console.log("");
  console.log(`Aktywnych ofert w zakresie:   ${report.totalActive}`);
  console.log(`Przestarzałych (>${options.days}d):       ${report.totalStale}`);
  console.log(`Do wygaszenia po bezpiecznikach: ${report.totalToExpire}`);
  console.log("");

  const acted = report.integrations.filter((entry) => entry.toExpire.length > 0);
  const skipped = report.integrations.filter((entry) => entry.skipReason && entry.staleOffers > 0);

  console.log("Biura, w których coś gaśnie:");
  if (acted.length === 0) console.log("  (żadne)");
  for (const entry of acted.sort((a, b) => b.toExpire.length - a.toExpire.length)) {
    const share = ((entry.toExpire.length / entry.activeOffers) * 100).toFixed(0);
    console.log(
      `  ${String(entry.toExpire.length).padStart(4)} z ${String(entry.activeOffers).padStart(4)} (${share.padStart(3)}%)  ${entry.name}  [${entry.integrationId.slice(-6)}]  ost. plik: ${entry.lastFileDaysAgo}d temu`
    );
  }

  console.log("");
  console.log("Biura pominięte przez bezpieczniki (decyzja ręczna):");
  if (skipped.length === 0) console.log("  (żadne)");
  for (const entry of skipped.sort((a, b) => b.staleOffers - a.staleOffers)) {
    console.log(
      `  ${String(entry.staleOffers).padStart(4)} przestarzałych z ${String(entry.activeOffers).padStart(4)}  ${entry.name}  [${entry.integrationId.slice(-6)}]`
    );
    console.log(`        powód: ${entry.skipReason}`);
  }

  const examples = report.integrations
    .flatMap((entry) => entry.toExpire.map((offer) => ({ ...offer, biuro: entry.name })))
    .sort((a, b) => b.staleDays - a.staleDays)
    .slice(0, 15);

  if (examples.length > 0) {
    console.log("");
    console.log("Najstarsze przykłady (15):");
    for (const offer of examples) {
      console.log(
        `  ${String(offer.staleDays).padStart(3)}d cisza, ${String(offer.filesSince).padStart(4)} plików po niej  ${offer.externalId.padEnd(20)} ${String(offer.cenaPln).padStart(9)} zł / ${offer.powierzchniaM2} m²`
      );
      console.log(`      https://tylkodzialki.pl/dzialka/${offer.dzialkaId}  ${offer.tytul.slice(0, 70)}`);
    }
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const calibration = process.argv.includes("--kalibracja");
  const provider = await providerArg();

  const { EXPIRE_STALE_DEFAULTS, expireStaleCrmOffers } = await import(
    "../src/lib/crm/expireStaleOffers"
  );

  if (calibration) {
    await runCalibration(provider === undefined ? "GALACTICA" : provider);
    return;
  }

  const report = await expireStaleCrmOffers({
    days: numberArg("dni") ?? EXPIRE_STALE_DEFAULTS.days,
    feedMaxAgeDays: numberArg("swiezosc-kanalu"),
    minFilesSince: numberArg("min-plikow"),
    maxSharePercent: numberArg("max-udzial"),
    limit: numberArg("limit"),
    integrationId: stringArg("integracja"),
    ...(provider === undefined ? {} : { provider }),
    apply,
  });

  printReport(report);

  console.log("");
  if (apply) {
    console.log(`GOTOWE. Wygaszono ofert: ${report.expired}.`);
    console.log("Każda wróci sama (REACTIVATE), jeśli pojawi się w kolejnym pliku z CRM.");
  } else {
    console.log("TRYB RAPORTU — nic nie zmieniono. Aby wykonać: npm run crm:expire -- --apply");
  }

  const { prisma } = await import("../src/lib/prisma");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Błąd wygaszania ofert CRM:", error);
  process.exit(1);
});
