import { describe, it, expect } from 'vitest';
import { plural, pluralCat } from './plural';

const oferty = (n: number) => plural(n, 'ofertę', 'oferty', 'ofert');

describe('pluralCat', () => {
  it('1 to forma pojedyncza', () => {
    expect(pluralCat(1)).toBe('one');
  });

  it('2-4 to forma „few"', () => {
    for (const n of [2, 3, 4, 22, 23, 24, 102, 1002]) {
      expect(pluralCat(n), `dla ${n}`).toBe('few');
    }
  });

  // Najczęstszy błąd w polskich interfejsach: „12 oferty" zamiast „12 ofert".
  it('nastki 12-14 idą do „many", mimo końcówki 2-4', () => {
    for (const n of [12, 13, 14, 112, 113, 114, 1012]) {
      expect(pluralCat(n), `dla ${n}`).toBe('many');
    }
  });

  it('0 i reszta to „many"', () => {
    for (const n of [0, 5, 11, 15, 21, 25, 100, 137]) {
      expect(pluralCat(n), `dla ${n}`).toBe('many');
    }
  });
});

describe('plural — etykieta przycisku na mapie', () => {
  it('dobiera formę rzeczownika', () => {
    expect(oferty(1)).toBe('ofertę');
    expect(oferty(2)).toBe('oferty');
    expect(oferty(5)).toBe('ofert');
    expect(oferty(12)).toBe('ofert');
    expect(oferty(22)).toBe('oferty');
    expect(oferty(137)).toBe('ofert');
    expect(oferty(8272)).toBe('oferty');
  });
});
