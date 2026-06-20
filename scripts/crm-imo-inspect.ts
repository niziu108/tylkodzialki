/**
 * Narzędzie diagnostyczne: przepuszcza plik oferty.xml (rozpakowany z paczki IMO/domy.pl)
 * przez TEN SAM parser co produkcja i wypisuje raport: ile ofert zaakceptowanych,
 * rozbicie sprzedaż/wynajem, przeznaczenia, oraz powody odrzuceń. Bez bazy i FTP.
 *
 * Uruchom:  npx tsx scripts/crm-imo-inspect.ts <sciezka_do_oferty.xml> [PROVIDER]
 *   PROVIDER domyślnie IMOX.
 */
import dotenv from "dotenv";
import fs from "fs";
import type { CrmProvider } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
// Atrapy R2, gdyby env nie był ustawiony (parser i tak nie używa R2).
for (const key of [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
]) {
  if (!process.env[key]) process.env[key] = "inspect";
}

async function main() {
  const filePath = process.argv[2];
  const provider = (process.argv[3] || "IMOX") as CrmProvider;

  if (!filePath) {
    console.error("Użycie: npx tsx scripts/crm-imo-inspect.ts <sciezka_do_oferty.xml> [PROVIDER]");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`Nie znaleziono pliku: ${filePath}`);
    process.exit(1);
  }

  const { __domyplInternalsForTest } = await import("@/lib/crm/domypl-sync");
  const { streamParseDomyPlOffers } = __domyplInternalsForTest;

  // Przechwytujemy logi parsera: zliczamy powody odrzuceń, wyciszamy resztę [CRM DEBUG].
  const rejReasons: Record<string, number> = {};
  const rejected: Array<{ id: string; reason: string }> = [];
  const origLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const s = args.map((a) => String(a)).join(" ");
    if (s.includes("Odrzucono")) {
      const m = s.match(
        /Odrzucono:\s*(\S+)\s+(to nie jest działka|brak ceny|brak powierzchni|brak lokalizacji|brak externalId)/
      );
      const reason = m ? m[2] : "inny";
      const id = m ? m[1] : "?";
      rejReasons[reason] = (rejReasons[reason] ?? 0) + 1;
      rejected.push({ id, reason });
    }
    if (!s.includes("[CRM DEBUG]")) origLog(...args);
  };

  const transakcje: Record<string, number> = {};
  const przeznaczenia: Record<string, number> = {};
  const woda: Record<string, number> = {};
  const gaz: Record<string, number> = {};
  const prad: Record<string, number> = {};
  const kanalizacja: Record<string, number> = {};
  let accepted = 0;

  const bump = (m: Record<string, number>, k: string) => {
    m[k] = (m[k] ?? 0) + 1;
  };

  const stream = fs.createReadStream(filePath);
  const res = await streamParseDomyPlOffers(stream, provider, async (o) => {
    accepted += 1;
    bump(transakcje, o.transakcja);
    for (const p of o.przeznaczenia) bump(przeznaczenia, p);
    bump(woda, o.woda);
    bump(gaz, o.gaz);
    bump(prad, o.prad);
    bump(kanalizacja, o.kanalizacja);
  });

  console.log = origLog;

  const rejCount = rejected.length;
  console.log(`\n=== RAPORT (provider=${provider}) ===`);
  console.log(`Plik: ${filePath}`);
  console.log(`Zaakceptowane: ${accepted}`);
  console.log(`  transakcje:    ${JSON.stringify(transakcje)}`);
  console.log(`  przeznaczenia: ${JSON.stringify(przeznaczenia)}`);
  console.log(`  woda:          ${JSON.stringify(woda)}`);
  console.log(`  gaz:           ${JSON.stringify(gaz)}`);
  console.log(`  prad:          ${JSON.stringify(prad)}`);
  console.log(`  kanalizacja:   ${JSON.stringify(kanalizacja)}`);
  console.log(`Odrzucone: ${rejCount}`);
  console.log(`  powody: ${JSON.stringify(rejReasons)}`);
  if (rejCount > 0) {
    console.log("  szczegóły odrzuceń:");
    for (const r of rejected) console.log(`    ${r.id}: ${r.reason}`);
  }
  console.log(`oferta_usun (do dezaktywacji): ${JSON.stringify(res.deletedExternalIds)}`);
  console.log(`Razem ofert w pliku (zaakceptowane + odrzucone): ${accepted + rejCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Błąd:", e);
    process.exit(1);
  });
