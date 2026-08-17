import { describe, expect, it } from "vitest";
import { limitFeedsByTotalBytes, totalFeedBytes } from "./feed-batching";

const MB = 1024 * 1024;

function feed(name: string, sizeMb: number | null) {
  return { remoteFileName: name, size: sizeMb === null ? null : sizeMb * MB };
}

describe("limitFeedsByTotalBytes", () => {
  it("przepuszcza wszystko, gdy mieści się w limicie", () => {
    const files = [feed("a.zip", 100), feed("b.zip", 200)];
    expect(limitFeedsByTotalBytes(files, 1024 * MB)).toHaveLength(2);
  });

  it("ucina listę na przekroczeniu limitu, zachowując kolejność", () => {
    const files = [feed("a.zip", 400), feed("b.zip", 400), feed("c.zip", 400)];
    const limited = limitFeedsByTotalBytes(files, 900 * MB);

    expect(limited.map((f) => f.remoteFileName)).toEqual(["a.zip", "b.zip"]);
    expect(totalFeedBytes(limited)).toBe(800 * MB);
  });

  it("zawsze bierze pierwszy plik, nawet gdy sam przekracza limit", () => {
    // Inaczej pojedyncza paczka 708 MB przy niskim limicie zablokowałaby integrację na zawsze.
    const files = [feed("wielka.zip", 708), feed("mala.zip", 5)];
    const limited = limitFeedsByTotalBytes(files, 100 * MB);

    expect(limited.map((f) => f.remoteFileName)).toEqual(["wielka.zip"]);
  });

  it("traktuje brak rozmiaru jako zero i nie gubi pliku", () => {
    const files = [feed("bez-rozmiaru.zip", null), feed("b.zip", 10)];
    expect(limitFeedsByTotalBytes(files, 100 * MB)).toHaveLength(2);
  });

  it("wyłącza limit przy wartości nieliczbowej lub <= 0", () => {
    const files = [feed("a.zip", 900), feed("b.zip", 900)];

    expect(limitFeedsByTotalBytes(files, Number.NaN)).toHaveLength(2);
    expect(limitFeedsByTotalBytes(files, 0)).toHaveLength(2);
  });

  it("na pustej liście zwraca pustą listę", () => {
    expect(limitFeedsByTotalBytes([], 100 * MB)).toEqual([]);
  });
});
