import { describe, expect, it } from "vitest";
import { resolveFeedSignals, type DeleteSignal, type OfferSignal } from "./feed-signals";

type Offer = { externalId: string; updatedAt: number | null; wersja: string };

function isSameOrNewer(candidate: Offer, current: Offer): boolean {
  const c = candidate.updatedAt;
  const p = current.updatedAt;
  if (c != null && p != null) return c >= p;
  if (c != null) return true;
  if (p != null) return false;
  return true;
}

function offer(externalId: string, fileAt: number, updatedAt: number | null, wersja = "a"): OfferSignal<Offer> {
  return { externalId, fileAt, offer: { externalId, updatedAt, wersja } };
}

function del(externalId: string, fileAt: number): DeleteSignal {
  return { externalId, fileAt };
}

const resolve = (offers: OfferSignal<Offer>[], deletes: DeleteSignal[]) =>
  resolveFeedSignals(offers, deletes, isSameOrNewer);

describe("resolveFeedSignals", () => {
  it("ignoruje DELETE ze starszej paczki, gdy oferta wróciła w nowszej", () => {
    // Przypadek z produkcji: 2090/13397/OGS — biuro usunęło ofertę, potem wystawiło ją ponownie.
    const result = resolve([offer("A", 300, 300)], [del("A", 100)]);

    expect(result.offers.map((o) => o.externalId)).toEqual(["A"]);
    expect(result.deletedExternalIds).toEqual([]);
    expect(result.ignoredDeletes).toEqual(["A"]);
  });

  it("gasi ofertę, gdy DELETE przyszedł po jej ostatnim wystąpieniu", () => {
    const result = resolve([offer("A", 100, 100)], [del("A", 300)]);

    expect(result.offers).toEqual([]);
    expect(result.deletedExternalIds).toEqual(["A"]);
    expect(result.ignoredDeletes).toEqual([]);
  });

  it("przy remisie dat wygrywa DELETE (zachowanie sprzed poprawki)", () => {
    const result = resolve([offer("A", 100, 100)], [del("A", 100)]);

    expect(result.offers).toEqual([]);
    expect(result.deletedExternalIds).toEqual(["A"]);
  });

  it("feed bez dat modyfikacji zachowuje się jak przed poprawką — DELETE gasi", () => {
    const result = resolve([offer("A", 0, null)], [del("A", 0)]);

    expect(result.offers).toEqual([]);
    expect(result.deletedExternalIds).toEqual(["A"]);
  });

  it("o wieku decyduje najpóźniejsze wystąpienie oferty, nie kolejność wejścia", () => {
    // Ta sama oferta w pełnym eksporcie (stary) i w paczce przyrostowej (nowa), podane w złej kolejności.
    const result = resolve([offer("A", 500, 500), offer("A", 100, 100)], [del("A", 300)]);

    expect(result.offers).toHaveLength(1);
    expect(result.deletedExternalIds).toEqual([]);
  });

  it("o treści decyduje externalUpdatedAt, nie data pliku", () => {
    const result = resolve(
      [offer("A", 100, 900, "nowa"), offer("A", 500, 100, "stara")],
      []
    );

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].wersja).toBe("nowa");
  });

  it("DELETE oferty spoza plików ofert leci dalej do wygaszenia", () => {
    const result = resolve([offer("A", 100, 100)], [del("B", 50)]);

    expect(result.offers.map((o) => o.externalId)).toEqual(["A"]);
    expect(result.deletedExternalIds).toEqual(["B"]);
  });

  it("liczy się najnowszy DELETE, gdy jest ich kilka", () => {
    const result = resolve([offer("A", 200, 200)], [del("A", 50), del("A", 400)]);

    expect(result.offers).toEqual([]);
    expect(result.deletedExternalIds).toEqual(["A"]);
  });

  it("deduplikuje oferty per externalId", () => {
    const result = resolve(
      [offer("A", 100, 100), offer("A", 200, 200), offer("B", 100, 100)],
      []
    );

    expect(result.offers).toHaveLength(2);
    expect(result.offers.map((o) => o.externalId).sort()).toEqual(["A", "B"]);
  });
});
