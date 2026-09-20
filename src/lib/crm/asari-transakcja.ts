import type { TransakcjaTyp } from "@prisma/client";

/**
 * Rodzaj transakcji oferty ASARI: sprzedaż albo wynajem (dzierżawa).
 *
 * Problem, który to naprawia: silnik ASARI nie czytał operacji, więc każda działka wchodziła
 * jako sprzedaż. Dzierżawa placu za 4000 zł miesięcznie stała na portalu jako „działka
 * 5000 m² na sprzedaż za 4000 zł" (19.09.2026: 10 aktywnych ofert w 3 biurach, 5 z nich
 * z Północy) i zaniżała mediany cen za metr. Serwis zna wynajem (plakietka „NA WYNAJEM",
 * cena „/mc", filtr w wyszukiwarce i alertach), a silnik DOMY.PL mapuje go tak samo.
 *
 * Źródła, w kolejności:
 *  1. pole „operacja" (w standardzie ASARI id 43): SPRZEDAŻ albo WYNAJEM,
 *  2. litera transakcji w kodzie sygnatury: `396/3877/OGW` (G = grunt, W = wynajem), OGS = sprzedaż.
 * W próbkach 5 biur i w eksporcie Północy (3072 oferty) oba źródła zgadzają się w każdej ofercie.
 *
 * KUPNO i NAJEM to w ASARI poszukiwania klientów, nie oferty, więc zwracamy null (odrzucić).
 * Bez obu sygnałów zostaje sprzedaż, jak dotąd: tak wygląda eksport w formacie ASARI z innego
 * CRM, z samymi numerami w sygnaturach (NextNest).
 */
export function asariTransakcja(
  operacja: string | null | undefined,
  signature: string
): TransakcjaTyp | null {
  const op = normalize(operacja);

  if (op) {
    if (op.includes("sprzeda")) return "SPRZEDAZ";
    if (op.includes("wynaj") || op.includes("dzierzaw")) return "WYNAJEM";
    if (op.includes("kupno") || op.startsWith("najem")) return null;
  }

  const code = signature.trim().split("/").pop()?.trim().toUpperCase() ?? "";
  const letter = code.match(/^O[A-Z]([SW])$/)?.[1];
  if (letter === "W") return "WYNAJEM";

  return "SPRZEDAZ";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .trim();
}
