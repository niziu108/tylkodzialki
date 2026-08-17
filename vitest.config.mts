import { defineConfig } from 'vitest/config';

/* Testy jednostkowe czystych reguł (bez bazy, bez sieci): odmiana liczebników,
 * rozpoznawanie województw, bramki geo. Wszystkie testowane moduły są bezzależnościowe,
 * więc cały zestaw idzie w ułamku sekundy i można go wołać przy każdej zmianie.
 *
 * Powód powstania: błąd „szukanie »wielkopolskie« zwraca Opolszczyznę" przeżył
 * na produkcji, bo nie było czego uruchomić. Reguły językowe i granice administracyjne
 * to dokładnie ten rodzaj kodu, który wygląda na oczywisty i cicho się psuje. */
export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
