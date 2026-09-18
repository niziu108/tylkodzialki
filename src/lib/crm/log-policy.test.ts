import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MAX_LOG_PAYLOAD_BYTES, payloadForLog, shouldStoreLogPayload } from "./log-policy";

const KORZEN = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Pola `payload` w wywołaniach crmSyncLog.create / createMany, które nie idą przez payloadForLog.
 * Łapie typowy zapis wprost w wywołaniu, bo tak powstał błąd z 16.09.2026.
 */
function nieprzepuszczonePayloady(nazwaPliku: string, kod: string) {
  const zrodlo = ts.createSourceFile(nazwaPliku, kod, ts.ScriptTarget.Latest, true);
  const problemy: string[] = [];
  let sprawdzone = 0;

  const zglos = (node: ts.Node) => {
    const { line } = zrodlo.getLineAndCharacterOfPosition(node.getStart(zrodlo));
    problemy.push(`${nazwaPliku}:${line + 1}`);
  };

  const sprawdzPayload = (node: ts.Node) => {
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === "payload") {
      sprawdzone += 1;
      zglos(node);
    } else if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === "payload"
    ) {
      sprawdzone += 1;
      const wartosc = node.initializer;
      const przezRegule = ts.isCallExpression(wartosc) && wartosc.expression.getText(zrodlo) === "payloadForLog";
      if (!przezRegule) zglos(node);
    }
    ts.forEachChild(node, sprawdzPayload);
  };

  const szukajZapisow = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /\bcrmSyncLog\.create(Many)?$/.test(node.expression.getText(zrodlo))) {
      node.arguments.forEach(sprawdzPayload);
    }
    ts.forEachChild(node, szukajZapisow);
  };

  szukajZapisow(zrodlo);
  return { problemy, sprawdzone };
}

describe("shouldStoreLogPayload", () => {
  it("nie zapisuje payloadu przy rutynowej aktualizacji", () => {
    // Tu leżało 8 GB z 10 GB tabeli logów: kopia XML-a przy każdej ofercie, każdego dnia.
    expect(shouldStoreLogPayload("UPDATE", "SUCCESS")).toBe(false);
    expect(shouldStoreLogPayload("REACTIVATE", "SUCCESS")).toBe(false);
    expect(shouldStoreLogPayload("DEACTIVATE", "SUCCESS")).toBe(false);
    expect(shouldStoreLogPayload("DELETE", "SUCCESS")).toBe(false);
  });

  it("zachowuje payload tam, gdzie jest jedynym śladem", () => {
    expect(shouldStoreLogPayload("ERROR", "ERROR")).toBe(true);
    expect(shouldStoreLogPayload("CREATE", "SUCCESS")).toBe(true);
    expect(shouldStoreLogPayload("SKIP_NO_CREDITS", "ERROR")).toBe(true);
    // Każdy wpis ze statusem ERROR, niezależnie od akcji.
    expect(shouldStoreLogPayload("UPDATE", "ERROR")).toBe(true);
  });
});

describe("payloadForLog", () => {
  it("zwraca undefined dla akcji bez payloadu", () => {
    expect(payloadForLog("UPDATE", "SUCCESS", { a: 1 })).toBeUndefined();
  });

  it("przepuszcza payload w całości, gdy mieści się w limicie", () => {
    const payload = { externalId: "ABC", cena: 120000 };
    expect(payloadForLog("CREATE", "SUCCESS", payload)).toBe(payload);
  });

  it("zostawia w całości CREATE wielkości prawdziwej oferty EstiCRM", () => {
    // Pomiar 18.09.2026: największy CREATE z EstiCRM miał 20,3 tys. znaków (surowy rawOffer).
    // Przy dawnym sufitcie 8 kB przycięte były wszystkie CREATE z EstiCRM, 30 na 30.
    const oferta = { externalId: "EST-1", rawOffer: { opis: "x".repeat(20_300) } };
    expect(payloadForLog("CREATE", "SUCCESS", oferta)).toBe(oferta);
  });

  it("przycina payload ponad limit do poprawnego JSON-a", () => {
    const wielki = { opis: "x".repeat(MAX_LOG_PAYLOAD_BYTES * 2) };
    const wynik = payloadForLog("CREATE", "SUCCESS", wielki) as Record<string, unknown>;

    expect(wynik.przyciety).toBe(true);
    expect(String(wynik.fragment)).toHaveLength(MAX_LOG_PAYLOAD_BYTES);
    expect(() => JSON.stringify(wynik)).not.toThrow();
  });

  it("radzi sobie z brakiem payloadu", () => {
    expect(payloadForLog("ERROR", "ERROR", undefined)).toBeUndefined();
  });
});

describe("zapisy CrmSyncLog w kodzie", () => {
  // 16.09.2026: silniki tworzyły wpisy UPDATE wprost w transakcji processOffer, obok logSync,
  // i reguła wyżej ich nie obejmowała: 23,7 tys. pełnych XML-i ofert na dobę, 123 MB.
  it("wykrywa payload zapisany z pominięciem reguły", () => {
    const kod = `
      await tx.crmSyncLog.create({ data: { action: "UPDATE", payload: offer.payload } });
      await prisma.crmSyncLog.createMany({ data: ids.map((id) => ({ id, payload })) });
      await tx.crmSyncLog.create({ data: { payload: payloadForLog("CREATE", "SUCCESS", offer.payload) } });
      await logSync(id, { action: "ERROR", status: "ERROR", payload: offer.payload });
    `;

    expect(nieprzepuszczonePayloady("przyklad.ts", kod).problemy).toEqual(["przyklad.ts:2", "przyklad.ts:3"]);
  });

  it("każdy payload w crmSyncLog.create w src i app idzie przez payloadForLog", () => {
    const wyniki = ["src", "app"]
      .flatMap((katalog) =>
        readdirSync(path.join(KORZEN, katalog), { recursive: true, encoding: "utf8" })
          .filter((plik) => /\.tsx?$/.test(plik) && !plik.endsWith(".test.ts"))
          .map((plik) => path.join(katalog, plik))
      )
      .map((plik) => ({ plik, kod: readFileSync(path.join(KORZEN, plik), "utf8") }))
      .filter(({ kod }) => kod.includes("crmSyncLog.create"))
      .map(({ plik, kod }) => nieprzepuszczonePayloady(plik, kod));

    // Skaner, który nic nie znalazł, przepuściłby wszystko, a logSync w silnikach ma pole payload.
    expect(wyniki.reduce((suma, wynik) => suma + wynik.sprawdzone, 0)).toBeGreaterThan(0);
    expect(wyniki.flatMap((wynik) => wynik.problemy)).toEqual([]);
  });
});
