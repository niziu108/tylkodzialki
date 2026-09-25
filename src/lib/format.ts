// Wspólne formatowanie liczb/cen dla kart oferty (lista, podobne, popup mapy) — jedno źródło prawdy,
// żeby cena, zł/m² i obsługa „brak ceny" wyglądały IDENTYCZNIE na każdej powierzchni.

export function formatPLN(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatIntPL(value: number): string {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Etykieta ceny na karcie. Brak ceny lub 0 (zdarza się przy imporcie CRM) → `null`,
 * a karta pokazuje wtedy pigułkę „Zapytaj o cenę" zamiast mylącego „0 zł".
 */
export function offerPriceLabel(cena: number | null | undefined): string | null {
  if (cena == null || !Number.isFinite(cena) || cena <= 0) return null;
  return formatPLN(cena);
}

/** zł/m² (zaokrąglone). 0, gdy brak ceny lub powierzchni — wtedy nie pokazujemy. */
export function pricePerM2(cena: number | null | undefined, area: number | null | undefined): number {
  if (!cena || !area || cena <= 0 || area <= 0) return 0;
  return Math.round(cena / area);
}

/** Data ISO (RRRR-MM-DD…) jako DD.MM.RRRR. Tu, a nie w komponencie 'use client': funkcja z takiego
 * pliku importowana do komponentu serwerowego jest referencją klienta, nie funkcją. */
export function plDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
