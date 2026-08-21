/* Normalizacja nazwy powiatu z `locationFull`. Osobny, bezzależnościowy moduł, bo to
 * reguła językowa: wygląda na oczywistą i cicho się psuje, a testy nie mogą ciągnąć bazy.
 *
 * Powód powstania: część feedów CRM podaje w ścieżce administracyjnej „powiat sieradzki",
 * część samo „sieradzki". Bez ścięcia prefiksu ten sam powiat liczył się dwa razy,
 * a etykieta wychodziła jako „powiat powiat sieradzki". */

/** „powiat sieradzki" → „sieradzki"; „sieradzki" zostaje bez zmian. */
export function stripPowiatPrefix(adj: string): string {
  return adj.replace(/^powiat\s+/i, '').trim();
}

/** Klucz zliczania: „powiat-sieradzki" i „sieradzki" muszą trafić do jednego kubełka. */
export function powiatKey(slug: string): string {
  return slug.replace(/^powiat-/, '');
}
