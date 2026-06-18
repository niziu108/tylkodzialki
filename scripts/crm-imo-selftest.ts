/**
 * Test offline silnika IMO (Sprint 7).
 *
 * Weryfikuje na sztucznym pliku XML, bez bazy i bez FTP:
 *  - R-A: klasyfikacja działki z <dzial tab="dzialki"> (tylko IMOX),
 *  - R-B: transakcja sprzedaż/wynajem z <dzial typ="..."> (tylko IMOX),
 *  - R-C: zbieranie <oferta_usun> do listy ID do dezaktywacji,
 *  - izolacja: ścieżka Galactiki pozostaje bez zmian (ignoruje <dzial>).
 *
 * Aktywne usuwanie z R-C (deactivateExternalIds) jest bramkowane providerem IMOX
 * w syncCrmIntegrationNow; tu sprawdzamy samo zbieranie ID przez parser.
 *
 * Uruchom: npx tsx scripts/crm-imo-selftest.ts
 */
import { Readable } from "stream";
import type { CrmProvider } from "@prisma/client";

// Modul domypl-sync importuje @/lib/r2, ktory waliduje zmienne R2 przy starcie.
// Parser nie korzysta z R2 ani z bazy, wiec podstawiamy atrapy tylko po to,
// zeby import przeszedl. Dynamiczny import musi nastapic PO ustawieniu env.
for (const key of [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
]) {
  if (!process.env[key]) process.env[key] = "selftest";
}

type DomyplMod = typeof import("@/lib/crm/domypl-sync");
type StreamParseFn = DomyplMod["__domyplInternalsForTest"]["streamParseDomyPlOffers"];
type ParsedOffer = Parameters<Parameters<StreamParseFn>[2]>[0];

// Przypisane w main() po dynamicznym imporcie (top-level await niedostepne w CJS).
let streamParseDomyPlOffers: StreamParseFn;

function offer(opts: {
  id: string;
  dzialTab?: string;
  dzialTyp?: string;
  title?: string;
}) {
  const dzial =
    opts.dzialTab || opts.dzialTyp
      ? `<dzial${opts.dzialTab ? ` tab="${opts.dzialTab}"` : ""}${
          opts.dzialTyp ? ` typ="${opts.dzialTyp}"` : ""
        }/>`
      : "";
  const title = opts.title
    ? `<param nazwa="advertisement_text">${opts.title}</param>`
    : "";
  return `
  <oferta>
    <id>${opts.id}</id>
    ${dzial}
    <cena>250000</cena>
    ${title}
    <param nazwa="powierzchnia">1000</param>
    <param nazwa="wojewodztwo">mazowieckie</param>
    <param nazwa="miasto">Warszawa</param>
  </oferta>`;
}

// Pełny eksport (calosc). Cztery oferty + jedno usunięcie różnicowe.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<oferty>
  <header>
    <data>2026-06-18 10:00:00</data>
    <agencja>Testowe Biuro IMO</agencja>
    <zawartosc_pliku>calosc</zawartosc_pliku>
  </header>
  ${offer({ id: "100", dzialTab: "dzialki", dzialTyp: "sprzedaz" })}
  ${offer({ id: "101", dzialTab: "dzialki", dzialTyp: "wynajem" })}
  ${offer({ id: "102", dzialTab: "mieszkania", dzialTyp: "sprzedaz" })}
  ${offer({
    id: "GS-200",
    dzialTab: "dzialki",
    dzialTyp: "wynajem",
    title: "Atrakcyjna oferta",
  })}
  <oferta_usun><id>999</id></oferta_usun>
</oferty>`;

async function parseAll(provider: CrmProvider) {
  const offers: ParsedOffer[] = [];
  const res = await streamParseDomyPlOffers(
    Readable.from([XML]),
    provider,
    async (o) => {
      offers.push(o);
    }
  );
  return { offers, deletedExternalIds: res.deletedExternalIds };
}

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function main() {
  streamParseDomyPlOffers = (
    await import("@/lib/crm/domypl-sync")
  ).__domyplInternalsForTest.streamParseDomyPlOffers;

  console.log("\n== IMOX ==");
  const imo = await parseAll("IMOX");
  const imoIds = imo.offers.map((o) => o.externalId).sort();
  check(
    "akceptuje dzialki (100, 101, GS-200), odrzuca mieszkanie 102",
    JSON.stringify(imoIds) === JSON.stringify(["100", "101", "GS-200"]),
    `dostalem: ${JSON.stringify(imoIds)}`
  );

  const o100 = imo.offers.find((o) => o.externalId === "100");
  check(
    "100: SPRZEDAZ z <dzial typ=sprzedaz>",
    o100?.transakcja === "SPRZEDAZ",
    `transakcja=${o100?.transakcja}`
  );
  check(
    "100: domyslne przeznaczenie BUDOWLANA przy pustym typdzialki",
    !!o100 && o100.przeznaczenia.includes("BUDOWLANA"),
    `przeznaczenia=${JSON.stringify(o100?.przeznaczenia)}`
  );

  const o101 = imo.offers.find((o) => o.externalId === "101");
  check(
    "101: WYNAJEM z <dzial typ=wynajem>",
    o101?.transakcja === "WYNAJEM",
    `transakcja=${o101?.transakcja}`
  );

  const gs = imo.offers.find((o) => o.externalId === "GS-200");
  check(
    "GS-200: WYNAJEM (IMOX ufa <dzial typ>, nie prefiksowi GS)",
    gs?.transakcja === "WYNAJEM",
    `transakcja=${gs?.transakcja}`
  );

  check(
    "R-C: zebrano <oferta_usun> id=999",
    JSON.stringify(imo.deletedExternalIds) === JSON.stringify(["999"]),
    `deletedExternalIds=${JSON.stringify(imo.deletedExternalIds)}`
  );

  console.log("\n== GALACTICA (sciezka musi zostac bez zmian) ==");
  const gal = await parseAll("GALACTICA");
  const galIds = gal.offers.map((o) => o.externalId).sort();
  check(
    "akceptuje tylko GS-200 (prefiks), ignoruje <dzial> przy 100/101/102",
    JSON.stringify(galIds) === JSON.stringify(["GS-200"]),
    `dostalem: ${JSON.stringify(galIds)}`
  );

  const galGs = gal.offers.find((o) => o.externalId === "GS-200");
  check(
    "GS-200: SPRZEDAZ (Galactica ignoruje <dzial typ=wynajem>, kod GS=sprzedaz)",
    galGs?.transakcja === "SPRZEDAZ",
    `transakcja=${galGs?.transakcja}`
  );

  console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Blad testu:", e);
  process.exit(1);
});
