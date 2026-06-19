/**
 * Test offline silnika IMO (Sprint 7).
 *
 * Weryfikuje na sztucznym pliku XML w PRAWDZIWEJ strukturze IMO/Oferty.net, bez bazy i FTP:
 *  - R-A: klasyfikacja działki z kontenera <dzial tab="dzialki"> (tylko IMOX),
 *  - R-B: sprzedaż/wynajem z kontenera <dzial typ="..."> (tylko IMOX),
 *  - R-C: zbieranie <oferta_usun> do listy ID do dezaktywacji,
 *  - lokalizacja: miasto na prawach powiatu (Toruń) z fallbackiem miasto<-powiat,
 *  - izolacja: ścieżka Galactiki pozostaje bez zmian (ignoruje kontener <dzial>).
 *
 * WAŻNE: <dzial> jest KONTENEREM grupującym oferty (rodzicem <oferta>), a nie elementem
 * w środku oferty. Tak wygląda realny eksport IMO (potwierdzone na paczce produkcyjnej).
 *
 * Uruchom: npx tsx scripts/crm-imo-selftest.ts
 */
import { Readable } from "stream";
import type { CrmProvider } from "@prisma/client";

// Moduł domypl-sync importuje @/lib/r2, który waliduje zmienne R2 przy starcie.
// Parser nie korzysta z R2 ani z bazy, więc podstawiamy atrapy tylko po to,
// żeby import przeszedł. Dynamiczny import musi nastąpić PO ustawieniu env.
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

// Przypisane w main() po dynamicznym imporcie (top-level await niedostępne w CJS).
let streamParseDomyPlOffers: StreamParseFn;

// Pojedyncza oferta BEZ <dzial> w środku — kategoria i typ pochodzą z kontenera.
function offer(opts: {
  id: string;
  title?: string;
  woj?: string;
  miasto?: string | null;
  powiat?: string;
}) {
  const title = opts.title
    ? `<param nazwa="advertisement_text" typ="text">${opts.title}</param>`
    : "";
  const woj = opts.woj ?? "mazowieckie";
  // miasto === null oznacza "nie wysyłaj pola miasto" — tak wygląda oferta z miasta na prawach
  // powiatu (nazwa miasta jest tylko w polu powiat), jak w paczkach IMO z Torunia.
  const miasto = opts.miasto === undefined ? "Warszawa" : opts.miasto;
  const locParts = [`<param nazwa="wojewodztwo" typ="text">${woj}</param>`];
  if (opts.powiat) locParts.push(`<param nazwa="powiat" typ="text">${opts.powiat}</param>`);
  if (miasto) locParts.push(`<param nazwa="miasto" typ="text">${miasto}</param>`);
  return `
      <oferta>
        <id>${opts.id}</id>
        <cena waluta="PLN">250000,0000</cena>
        ${title}
        <param nazwa="powierzchnia" typ="real">1000</param>
        ${locParts.join("\n        ")}
      </oferta>`;
}

// Kontener <dzial> grupujący oferty (jak w realnym eksporcie IMO).
function dzial(tab: string, typ: string, offers: string) {
  return `    <dzial tab="${tab}" typ="${typ}">${offers}
    </dzial>`;
}

const XML = `<?xml version="1.0" encoding="utf-8"?>
<plik>
  <header>
    <agencja>Testowe Biuro IMO</agencja>
    <data>2026-06-19 10:00:00</data>
    <zawartosc_pliku>calosc</zawartosc_pliku>
  </header>
  <lista_ofert>
    <dzial tab="domy" typ="sprzedaz" />
${dzial(
  "dzialki",
  "sprzedaz",
  offer({ id: "100" }) +
    offer({ id: "200T", woj: "kujawsko-pomorskie", miasto: null, powiat: "Toruń" }) +
    offer({ id: "GS-200", title: "Atrakcyjna oferta" })
)}
${dzial(
  "dzialki",
  "wynajem",
  offer({ id: "101" }) + offer({ id: "130W" })
)}
${dzial("mieszkania", "sprzedaz", offer({ id: "102" }))}
    <oferta_usun><id>999</id></oferta_usun>
  </lista_ofert>
</plik>`;

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
    "akceptuje dzialki z kontenerow (100, 101, 130W, 200T, GS-200), odrzuca mieszkanie 102",
    JSON.stringify(imoIds) === JSON.stringify(["100", "101", "130W", "200T", "GS-200"]),
    `dostalem: ${JSON.stringify(imoIds)}`
  );

  const o100 = imo.offers.find((o) => o.externalId === "100");
  check(
    "100: SPRZEDAZ z kontenera <dzial typ=sprzedaz>",
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
    "101: WYNAJEM z kontenera <dzial typ=wynajem>",
    o101?.transakcja === "WYNAJEM",
    `transakcja=${o101?.transakcja}`
  );

  const o130 = imo.offers.find((o) => o.externalId === "130W");
  check(
    "130W: WYNAJEM z kontenera mimo braku prefiksu GW (kluczowy przypadek R-B)",
    o130?.transakcja === "WYNAJEM",
    `transakcja=${o130?.transakcja}`
  );

  const gs = imo.offers.find((o) => o.externalId === "GS-200");
  check(
    "GS-200: SPRZEDAZ z kontenera (IMOX ufa <dzial typ>, nie prefiksowi)",
    gs?.transakcja === "SPRZEDAZ",
    `transakcja=${gs?.transakcja}`
  );

  const torun = imo.offers.find((o) => o.externalId === "200T");
  check(
    "200T: miasto na prawach powiatu (Torun) zaakceptowane, miasto z fallbacku na powiat",
    !!torun && (torun.locationLabel?.includes("Toruń") ?? false),
    `locationLabel=${torun?.locationLabel}`
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
    "akceptuje tylko GS-200 (prefiks), ignoruje kontenery <dzial> przy 100/101/130W/200T/102",
    JSON.stringify(galIds) === JSON.stringify(["GS-200"]),
    `dostalem: ${JSON.stringify(galIds)}`
  );

  const galGs = gal.offers.find((o) => o.externalId === "GS-200");
  check(
    "GS-200: SPRZEDAZ (Galactica ignoruje kontener, kod GS=sprzedaz, tytul neutralny)",
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
