import { Readable } from "stream";
import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { xmlIntegrityProblem, xmlStreamIntegrityProblem } from "./xml-integrity";

describe("xmlIntegrityProblem: plik urwany w trakcie wgrywania", () => {
  const offer = (n: number) =>
    `<offer><signature>${n}/3877/OGS</signature><description><![CDATA[Działka & <b>opis</b>]]></description></offer>\n`;
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<PACKAGE>\n`;
  const complete = `${head}${offer(1)}${offer(2)}<DELETE><offers><signature>9/3877/OGS</signature></offers></DELETE></PACKAGE>\n`;

  it("przepuszcza kompletny plik z CDATA i sekcją DELETE", () => {
    expect(xmlIntegrityProblem(complete)).toBeNull();
  });

  it("odrzuca każde urwanie, także na granicy elementu", () => {
    expect(xmlIntegrityProblem(`${head}${offer(1)}${offer(2)}`)).not.toBeNull(); // brak </PACKAGE>
    expect(xmlIntegrityProblem(`${head}${offer(1)}<offer>`)).not.toBeNull();
    expect(xmlIntegrityProblem(`${head}${offer(1)}<offer><signature>2/38`)).not.toBeNull();
    expect(xmlIntegrityProblem(head)).not.toBeNull();
    expect(xmlIntegrityProblem("")).not.toBeNull();
  });

  it("powód istnienia bramki: sam parser przyjmuje urwany plik bez błędu", () => {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseTagValue: false });
    const doc = parser.parse(`${head}${offer(1)}${offer(2)}`);

    expect(doc.PACKAGE.offer).toHaveLength(2);
  });
});

describe("xmlIntegrityProblem: formaty EstiCRM i LocumNet", () => {
  const esti = (offers: string) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<offers export="full">\n${offers}</offers>\n`;
  const estiOffer = (id: number) =>
    `<offer><id>${id}</id><price>250000</price><descriptionWebsite><![CDATA[<p>Działka &amp; las</p>]]></descriptionWebsite>` +
    `<pictures><picture>${id}_1.jpg</picture><picture>${id}_2.jpg</picture></pictures></offer>\n`;

  const locum = (offers: string, removed = "<idof mlssta='4'>0</idof>") =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<root><info><FullExport>False</FullExport></info>` +
    `<oferty>${offers}</oferty><removed>${removed}</removed></root>\n`;
  const locumOffer = (idof: number) =>
    `<oferta><idof>${idof}</idof><typnie code='202'>Grunty - działka budowlana</typnie><mlssta>2</mlssta>` +
    `<opis><![CDATA[Opis & <b>pogrubienie</b>]]></opis></oferta>`;

  it("przepuszcza kompletne paczki", () => {
    expect(xmlIntegrityProblem(esti(estiOffer(1) + estiOffer(2)))).toBeNull();
    expect(xmlIntegrityProblem(locum(locumOffer(7930200) + locumOffer(7930201)))).toBeNull();
  });

  it("odrzuca paczkę uciętą w środku listy zdjęć (parser zgubiłby zdjęcia bez błędu)", () => {
    const full = esti(estiOffer(1));
    const cut = full.slice(0, full.indexOf("<picture>1_2.jpg"));

    expect(xmlIntegrityProblem(cut)).not.toBeNull();

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseTagValue: false });
    expect(parser.parse(cut).offers.offer.pictures.picture).toBe("1_1.jpg");
  });

  it("odrzuca paczkę LocumNet bez sekcji removed i zamknięcia korzenia", () => {
    const full = locum(locumOffer(1) + locumOffer(2));
    expect(xmlIntegrityProblem(full.slice(0, full.indexOf("<removed>")))).not.toBeNull();
  });

  it("świadomie odrzuca XML kompletny, ale brudny (nieescapowany &)", () => {
    expect(xmlIntegrityProblem(esti("<offer><id>1</id><description>Dom & ogród</description></offer>"))).not.toBeNull();
  });
});

describe("xmlStreamIntegrityProblem: przebieg kontrolny SAX dla DOMY.PL", () => {
  const domy = (offers: string, deletes = "") =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<plik><header><zawartosc_pliku>pełny</zawartosc_pliku></header>` +
    `<lista_ofert><dzial tab="dzialki" typ="sprzedaz">${offers}</dzial>${deletes}</lista_ofert></plik>\n`;
  const domyOffer = (id: string) =>
    `<oferta><id>${id}</id><cena waluta="PLN">250000,0000</cena>` +
    `<param nazwa="opis" typ="text"><linia>Działka &amp; łąka</linia></param></oferta>`;

  const stream = (text: string, chunkSize = text.length || 1) => {
    const bytes = Buffer.from(text, "utf8");
    const chunks: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) chunks.push(bytes.subarray(i, i + chunkSize));
    return Readable.from(chunks);
  };

  const complete = domy(domyOffer("LER-GS-3541-2") + domyOffer("GS-28954"), "<oferta_usun><id>LER-GS-3541-1</id></oferta_usun>");

  it("przepuszcza kompletną paczkę, także podaną małymi kawałkami (znaki UTF-8 na granicy kawałków)", async () => {
    expect(await xmlStreamIntegrityProblem(stream(complete))).toBeNull();
    expect(await xmlStreamIntegrityProblem(stream(complete, 7))).toBeNull();
  });

  it("odrzuca paczkę uciętą na granicy elementu i w środku tagu", async () => {
    const withoutRootEnd = complete.slice(0, complete.lastIndexOf("</lista_ofert>"));
    expect(await xmlStreamIntegrityProblem(stream(withoutRootEnd))).not.toBeNull();
    expect(await xmlStreamIntegrityProblem(stream(complete.slice(0, complete.indexOf("<cena")) + "<ce"))).not.toBeNull();
  });

  it("odrzuca pusty plik i sam nagłówek, których SAX sam nie zgłasza", async () => {
    expect(await xmlStreamIntegrityProblem(stream(""))).not.toBeNull();
    expect(await xmlStreamIntegrityProblem(stream(`<?xml version="1.0" encoding="UTF-8"?>\n`))).not.toBeNull();
  });

  it("zgłasza błąd odczytu strumienia (np. uszkodzony wpis ZIP)", async () => {
    const broken = new Readable({
      read() {
        this.destroy(new Error("FILE_ENDED"));
      },
    });

    expect(await xmlStreamIntegrityProblem(broken)).toContain("FILE_ENDED");
  });

  it("zamyka strumień źródłowy po sprawdzeniu, także przy błędzie w połowie pliku", async () => {
    const ok = stream(complete);
    await xmlStreamIntegrityProblem(ok);
    expect(ok.destroyed).toBe(true);

    const dirty = stream(domy("<oferta><id>1</id><opis>Dom & ogród</opis></oferta>".repeat(50)), 64);
    expect(await xmlStreamIntegrityProblem(dirty)).not.toBeNull();
    expect(dirty.destroyed).toBe(true);
  });
});
