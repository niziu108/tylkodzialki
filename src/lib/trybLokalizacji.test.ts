import { describe, expect, it } from 'vitest';
import { trybLokalizacji } from './trybLokalizacji';

// Współrzędne z prawdziwych ofert (stan bazy 09.10.2026).
describe('trybLokalizacji', () => {
  it('EXACT z podpowiedzi Google (środek miejscowości) czyta jako APPROX', () => {
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: 'x', lat: 51.3342901, lng: 19.3636232 })).toBe('APPROX');
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: 'x', lat: 53.360814, lng: 20.4274873 })).toBe('APPROX');
    // Szum zmiennoprzecinkowy z Google: nadal 7 miejsc po przecinku.
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: 'x', lat: 51.90023679999999, lng: 18.4927635 })).toBe('APPROX');
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: 'x', lat: 51.30104900000001, lng: 19.383141 })).toBe('APPROX');
  });

  it('zostawia EXACT dla punktu wskazanego na mapie', () => {
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: null, lat: 51.28627313112202, lng: 19.35752659743653 })).toBe('EXACT');
    // Najpierw podpowiedź, potem kliknięcie działki: placeId zostaje, punkt ma pełną precyzję.
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: 'x', lat: 51.19441601107553, lng: 19.31806254189452 })).toBe('EXACT');
  });

  it('bez placeId nie zgaduje, nawet przy krótkich współrzędnych', () => {
    expect(trybLokalizacji({ locationMode: 'EXACT', placeId: null, lat: 51.3342901, lng: 19.3636232 })).toBe('EXACT');
  });

  it('APPROX zostaje APPROX', () => {
    expect(trybLokalizacji({ locationMode: 'APPROX', placeId: null, lat: 52.1, lng: 21.0 })).toBe('APPROX');
  });
});
