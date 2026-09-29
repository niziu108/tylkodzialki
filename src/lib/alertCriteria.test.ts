import { describe, it, expect } from 'vitest';
import { alertPlaceName, buildAlertLabel, type AlertCriteria } from './alertCriteria';

const base: AlertCriteria = {
  query: null,
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  przeznaczenia: [],
  transakcja: [],
  lat: null,
  lng: null,
  radiusKm: null,
};

describe('alertPlaceName', () => {
  it('zostawia samą nazwę miejsca z tekstu geokodera', () => {
    expect(alertPlaceName('97-400 Bełchatów, Polska')).toBe('Bełchatów');
    expect(alertPlaceName('Warszawa, Polska')).toBe('Warszawa');
    expect(alertPlaceName('ul. Malinowa 5, 97-300 Piotrków Trybunalski, Polska')).toBe('Piotrków Trybunalski');
    expect(alertPlaceName('Kleszczów')).toBe('Kleszczów');
  });
});

describe('buildAlertLabel', () => {
  it('pokazuje promień przy alercie z punktem', () => {
    const c = { ...base, query: '97-400 Bełchatów, Polska', lat: 51.37, lng: 19.36, radiusKm: 20 };
    expect(buildAlertLabel(c)).toBe('Działki Bełchatów + 20 km');
  });

  it('bez punktu sama nazwa, bez promienia', () => {
    expect(buildAlertLabel({ ...base, query: 'Bełchatów' })).toBe('Działki Bełchatów');
  });

  it('punkt bez nazwy = promień słownie', () => {
    const c = { ...base, lat: 51.37, lng: 19.36, radiusKm: 10, przeznaczenia: ['BUDOWLANA' as const], priceMax: 200000 };
    expect(buildAlertLabel(c)).toBe('Działki budowlane w promieniu 10 km do 200 tys.');
  });
});
