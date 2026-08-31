import { describe, it, expect } from 'vitest';
import { osaDistance, suggestPlaces, type PlaceEntry } from './dzialkiSuggest';

describe('osaDistance', () => {
  it('liczy zamianę sąsiednich liter jako jedną pomyłkę', () => {
    // Najczęstsza literówka z klawiatury — w czystym Levenshteinie kosztowałaby 2
    // i wypadłaby z podpowiedzi razem z zupełnie innymi nazwami.
    expect(osaDistance('radmosko', 'radomsko')).toBe(1);
    expect(osaDistance('warszwaa', 'warszawa')).toBe(1);
  });

  it('liczy brak, nadmiar i podmianę litery', () => {
    expect(osaDistance('radomsk', 'radomsko')).toBe(1);
    expect(osaDistance('radomssko', 'radomsko')).toBe(1);
    expect(osaDistance('radomsku', 'radomsko')).toBe(1);
    expect(osaDistance('belchatow', 'belchatow')).toBe(0);
  });

  it('nie liczy dalej, niż trzeba (zwraca ponad limit)', () => {
    expect(osaDistance('radom', 'radomsko', 2)).toBeGreaterThan(2);
    expect(osaDistance('gdansk', 'krakow', 2)).toBeGreaterThan(2);
  });
});

describe('suggestPlaces', () => {
  const slownik: PlaceEntry[] = [
    { label: 'Radomsko', lat: 51.0678, lng: 19.4454, count: 7 },
    { label: 'Radom', lat: 51.4027, lng: 21.1471, count: 30 },
    { label: 'Radomin', lat: 53.0703, lng: 19.1284, count: 2 },
    { label: 'Bełchatów', lat: 51.3688, lng: 19.3564, count: 74 },
    { label: 'Brok', lat: 52.6996, lng: 21.8598, count: 3 },
  ];

  it('podpowiada miejscowość mimo literówki', () => {
    expect(suggestPlaces('Radmosko', slownik)[0]?.label).toBe('Radomsko');
    expect(suggestPlaces('Radmosko, Polska', slownik)[0]?.label).toBe('Radomsko');
    expect(suggestPlaces('Belchatow', slownik)[0]?.label).toBe('Bełchatów');
    expect(suggestPlaces('działki Bechatow budowlane', slownik)[0]?.label).toBe('Bełchatów');
  });

  /* Sedno: podpowiedź ma ratować literówkę, a nie podsuwać INNE miasto o podobnej nazwie.
     Radom, Radomsko i Radomin to trzy różne miejsca w trzech różnych województwach. */
  it('nie podsuwa innej miejscowości o wspólnym rdzeniu', () => {
    const dlaRadomia = suggestPlaces('Radom', slownik).map((s) => s.label);
    expect(dlaRadomia).not.toContain('Radomsko');
    expect(dlaRadomia).not.toContain('Radomin');
  });

  it('przy krótkiej nazwie wymaga trafienia co do litery', () => {
    // „Brok" ma 4 znaki: jedna pomyłka to już zwykle inna miejscowość.
    expect(suggestPlaces('Brog', slownik)).toHaveLength(0);
    expect(suggestPlaces('Brok', slownik)[0]?.label).toBe('Brok');
  });

  it('przy równym dopasowaniu wygrywa większa podaż', () => {
    const remis: PlaceEntry[] = [
      { label: 'Zalesie', lat: 52, lng: 21, count: 1 },
      { label: 'Zalesie', lat: 51, lng: 20, count: 9 },
    ];
    expect(suggestPlaces('Zalesie', remis)[0]?.count).toBe(9);
  });

  it('nie zgaduje przy pustym albo bezsensownym zapytaniu', () => {
    expect(suggestPlaces('', slownik)).toHaveLength(0);
    expect(suggestPlaces('działka budowlana', slownik)).toHaveLength(0);
  });
});
