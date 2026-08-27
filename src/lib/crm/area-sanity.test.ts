import { describe, expect, it } from "vitest";
import { repairAreaFromHectares } from "./area-sanity";

/* Przypadki wzięte z produkcji (audyt bazy 2026-08-27, oferty aktywne poniżej 300 m²),
 * żeby test pilnował dokładnie tej granicy, na której bramka ma działać. */

describe("repairAreaFromHectares", () => {
  it("przelicza hektary z tytułu, gdy liczba zgadza się z polem metrów", () => {
    expect(
      repairAreaFromHectares(1, "Działka inwestycyjna 1,07 ha w sąsiedztwie jeziora")
    ).toBe(10_700);
  });

  it("radzi sobie z zaokrągleniem w górę przy połówce hektara", () => {
    expect(repairAreaFromHectares(5, "4,5 ha nad jeziorem | Mazury | Inwestycja")).toBe(45_000);
  });

  it("nie tyka poprawnej powierzchni zapisanej w hektarach", () => {
    // 0,0165 ha to dokładnie 165 m², czyli pole metrów jest już dobre.
    expect(repairAreaFromHectares(165, "Działka pod stragan 0,0165 ha przy Zakopiance")).toBe(165);
    expect(repairAreaFromHectares(231, "Działka w terenie budowlanym 0,0231 ha Poronin")).toBe(231);
  });

  it("ignoruje hektary, które opisują coś innego niż działkę", () => {
    // 10,6 ha to powierzchnia jeziora, działka ma swoje 57 m².
    expect(repairAreaFromHectares(57, "Domek nad Jeziorem Wójtowskim 10,6 ha, dzierżawa")).toBe(57);
  });

  it("zostawia małe, ale prawdziwe działki bez hektarów w tekście", () => {
    expect(repairAreaFromHectares(24, "Działka pod garaż z projektem budowlanym")).toBe(24);
    expect(repairAreaFromHectares(35, "Ładna działka rekreacyjna w Drzewcach")).toBe(35);
  });

  it("nie zgaduje przy arach, gdzie liczby się nie zgadzają", () => {
    expect(repairAreaFromHectares(18, "Ładnie położona działka rolna, 17 arów, media")).toBe(18);
  });

  it("nie rusza powierzchni od progu w górę, nawet z hektarami w tekście", () => {
    expect(repairAreaFromHectares(100, "Grunt 100 ha")).toBe(100);
    expect(repairAreaFromHectares(1_785, "Działka usługowo-przemysłowa 0,1785 ha Kęty")).toBe(1_785);
  });

  it("przepuszcza brak powierzchni bez zmian", () => {
    expect(repairAreaFromHectares(0, "Działka 2 ha")).toBe(0);
    expect(repairAreaFromHectares(-5, "Działka 2 ha")).toBe(-5);
  });

  it("znosi puste teksty i zapis słowny", () => {
    expect(repairAreaFromHectares(3, "")).toBe(3);
    expect(repairAreaFromHectares(2, "Sprzedam 2 hektary ziemi rolnej")).toBe(20_000);
  });

  it("bierze pierwszą zgodną liczbę, gdy tytuł i opis podają ją z inną dokładnością", () => {
    expect(
      repairAreaFromHectares(1, "Działka 1,07 ha nad jeziorem. Powierzchnia dokładnie 1,0766 ha.")
    ).toBe(10_700);
  });
});
