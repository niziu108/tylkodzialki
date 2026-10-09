// Do 09.10.2026 kreator /sprzedaj zapisywał EXACT już po wyborze miejscowości albo adresu z
// podpowiedzi Google, bez wskazania działki na mapie (poprawka a5f701b). Taka „dokładna" pinezka
// to środek miejscowości: na mapie udawała działkę, a raport pod ofertą liczył się z cudzej działki
// (sprawdzone 09.10: 16 aktywnych ofert, w tym 2 z gotowym raportem). Zamiast przepisywać dane,
// czytamy je jako APPROX. Sprzedający, który wskaże działkę na mapie, wraca do EXACT sam.
//
// Rozpoznanie: punkt z geokodowania Google ma `placeId` i współrzędne z 7 miejscami po przecinku
// (np. 51.3342901). Kliknięcie na mapie daje pełną precyzję double (51.28627313112202).
// Porównujemy z zaokrągleniem, nie liczymy cyfr: Google oddaje też 51.90023679999999.

type LokalizacjaOferty = {
  locationMode: string | null;
  lat: number | null;
  lng: number | null;
  placeId?: string | null;
};

function zSiatki7(v: number): boolean {
  return Math.abs(v - Math.round(v * 1e7) / 1e7) < 1e-9;
}

/** Punkt wzięty z podpowiedzi Google (środek miejscowości/adresu), a nie wskazany na mapie. */
export function punktZPodpowiedzi(o: LokalizacjaOferty): boolean {
  return (
    !!o.placeId &&
    typeof o.lat === 'number' &&
    typeof o.lng === 'number' &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng) &&
    zSiatki7(o.lat) &&
    zSiatki7(o.lng)
  );
}

/** Tryb lokalizacji do pokazania i do raportu: EXACT z podpowiedzi Google traktujemy jak APPROX. */
export function trybLokalizacji(o: LokalizacjaOferty): 'EXACT' | 'APPROX' {
  if (o.locationMode !== 'EXACT') return 'APPROX';
  return punktZPodpowiedzi(o) ? 'APPROX' : 'EXACT';
}
