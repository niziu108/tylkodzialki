/* Promień wyszukiwania z punktu — jedno źródło prawdy dla strony głównej, /kup i hubów SEO.
 *
 * Osobny, „czysty" moduł (bez 'use client') CELOWO: te stałe czyta też komponent serwerowy
 * app/kup/page.tsx przy SSR pierwszej strony wyników. Gdy mieszkały w KupSearch.tsx ('use client'),
 * serwer dostawał z importu nie liczbę 20, tylko referencję do komponentu klienckiego — więc
 * `Number(...)` dawało NaN, do zapytania szedł `radius=undefined`, a wyszukiwarka po cichu gubiła
 * promień i schodziła na samo dopasowanie tekstowe (zapytanie „Radomsko” zwracało Radom).
 * Wartości nie-komponentowe muszą leżeć poza granicą 'use client'. */
export const KM_OPTIONS = [5, 10, 20, 40] as const;

export type RadiusKm = (typeof KM_OPTIONS)[number];

// Domyślny promień wyszukiwania z punktu (główna + /kup). Podbity z 5 na 20 km: przy
// rzadkiej podaży 5 km w mniejszym mieście dawało „pusto", a kupujący działkę i tak
// myśli regionem, nie adresem (huby SEO celowo używają 40 km). User zawęzi Zasięgiem.
export const DEFAULT_RADIUS_KM: RadiusKm = 20;

export function isRadiusKm(value: unknown): value is RadiusKm {
  return (KM_OPTIONS as readonly number[]).includes(value as number);
}

/** Promień z adresu URL: nieznana/brakująca wartość schodzi do domyślnych 20 km. */
export function parseRadiusKm(raw: string | null | undefined): RadiusKm {
  const parsed = Number(raw);
  return isRadiusKm(parsed) ? parsed : DEFAULT_RADIUS_KM;
}
