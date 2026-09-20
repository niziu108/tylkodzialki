import { describe, expect, it } from "vitest";
import { asariTransakcja } from "./asari-transakcja";

/* Przypadki z eksportu Północy (19.09.2026) i próbek ASARI 5 biur: pole 43 „operacja"
 * i kod sygnatury OGS / OGW zgadzały się w każdej ofercie. */

describe("asariTransakcja", () => {
  it("dzierżawa z Północy wchodzi jako wynajem, nie sprzedaż", () => {
    expect(asariTransakcja("WYNAJEM", "396/3877/OGW")).toBe("WYNAJEM");
    expect(asariTransakcja("WYNAJEM", "400/3877/OGW")).toBe("WYNAJEM");
  });

  it("zwykła działka na sprzedaż zostaje sprzedażą", () => {
    expect(asariTransakcja("SPRZEDAŻ", "44037/3877/OGS")).toBe("SPRZEDAZ");
  });

  it("pole operacji wygrywa z kodem sygnatury", () => {
    expect(asariTransakcja("SPRZEDAŻ", "1/2/OGW")).toBe("SPRZEDAZ");
    expect(asariTransakcja("WYNAJEM", "1/2/OGS")).toBe("WYNAJEM");
  });

  it("rozumie dzierżawę i zapis bez polskich znaków", () => {
    expect(asariTransakcja("DZIERŻAWA", "12")).toBe("WYNAJEM");
    expect(asariTransakcja("sprzedaz", "12")).toBe("SPRZEDAZ");
  });

  it("odrzuca poszukiwania klientów: kupno i najem", () => {
    expect(asariTransakcja("KUPNO", "5/3877/OGS")).toBeNull();
    expect(asariTransakcja("NAJEM", "5/3877/OGW")).toBeNull();
  });

  it("bez pola operacji czyta literę z kodu sygnatury", () => {
    expect(asariTransakcja(null, "8/14328/OGW")).toBe("WYNAJEM");
    expect(asariTransakcja("", "3/4324/OGW")).toBe("WYNAJEM");
    expect(asariTransakcja(undefined, "12/18661/OGS")).toBe("SPRZEDAZ");
  });

  it("nieznana operacja nie odrzuca oferty, decyduje kod", () => {
    expect(asariTransakcja("ZAMIANA", "7/100/OGW")).toBe("WYNAJEM");
    expect(asariTransakcja("ZAMIANA", "7/100/OGS")).toBe("SPRZEDAZ");
  });

  it("eksport bez kodu w sygnaturze zostaje przy sprzedaży (NextNest)", () => {
    expect(asariTransakcja(null, "20512")).toBe("SPRZEDAZ");
    expect(asariTransakcja(null, "PAT21335")).toBe("SPRZEDAZ");
  });
});
