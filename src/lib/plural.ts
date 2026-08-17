/**
 * Odmiana liczebnika po polsku. Wydzielone z `alertEmails.ts`, bo tej samej reguły
 * potrzebują też interfejsy (np. przycisk „Pokaż 137 ofert z tego obszaru"), a moduł
 * maili ciąga za sobą pół backendu i nie nadaje się do importu w komponencie klienckim.
 *
 * Trzy kategorie: 1 / 2-4 / reszta, z wyjątkiem nastek (12-14 idą do „reszty"),
 * bo „12 oferty" brzmi jak automat tłumaczący z angielskiego.
 */
export type PluralCategory = 'one' | 'few' | 'many';

export function pluralCat(n: number): PluralCategory {
  if (n === 1) return 'one';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'few';
  return 'many';
}

/** `plural(5, 'oferta', 'oferty', 'ofert')` → `'ofert'`. Zwraca samo słowo, bez liczby. */
export function plural(n: number, one: string, few: string, many: string): string {
  const cat = pluralCat(n);
  return cat === 'one' ? one : cat === 'few' ? few : many;
}
