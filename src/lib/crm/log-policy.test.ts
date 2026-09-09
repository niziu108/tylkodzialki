import { describe, expect, it } from "vitest";
import { MAX_LOG_PAYLOAD_BYTES, payloadForLog, shouldStoreLogPayload } from "./log-policy";

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
