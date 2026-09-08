import { describe, expect, it } from 'vitest';
import {
  buildParcelQueries,
  looksLikeParcelId,
  normalizeParcelNumber,
  normalizeRegionName,
  powiatLabelFromUldk,
  regionVariants,
  splitRegionAndNumber,
} from './uldkQuery';

describe('looksLikeParcelId', () => {
  it('rozpoznaje pełny identyfikator ewidencyjny', () => {
    expect(looksLikeParcelId('100102_2.0006.100')).toBe(true);
    expect(looksLikeParcelId(' 022503_5.0003.134 ')).toBe(true);
    expect(looksLikeParcelId('146510_8.0502.1/3')).toBe(true);
  });

  it('znosi identyfikator z numerem arkusza mapy', () => {
    // Realny wynik z ULDK: 060606_2.0014.AR_3.756
    expect(looksLikeParcelId('060606_2.0014.AR_3.756')).toBe(true);
  });

  it('nie bierze nazwy obrębu ani samego numeru za identyfikator', () => {
    expect(looksLikeParcelId('Domiechowice')).toBe(false);
    expect(looksLikeParcelId('123/4')).toBe(false);
    expect(looksLikeParcelId('Stara Wieś 756')).toBe(false);
  });
});

describe('normalizacja wpisanych danych', () => {
  it('skleja numer z ukośnikiem rozdzielonym spacjami', () => {
    expect(normalizeParcelNumber(' 123 / 4 ')).toBe('123/4');
  });

  it('ścina etykietę „obręb" wklejoną z dokumentu', () => {
    expect(normalizeRegionName('obręb: Domiechowice')).toBe('Domiechowice');
    expect(normalizeRegionName('Obreb ewidencyjny 0006')).toBe('0006');
  });
});

describe('regionVariants', () => {
  // Każdy powiat zapisuje numer obrębu inaczej: Zelów „8", Bełchatów „08", Błonie „0008".
  // Kto wpisze „8", musi znaleźć swoją działkę niezależnie od tego zapisu.
  it('dla numeru obrębu pyta o wszystkie szerokości pola', () => {
    expect(regionVariants('8')).toEqual(['8', '08', '008', '0008']);
  });

  it('zaczyna od tego, co wpisał user', () => {
    expect(regionVariants('0008')[0]).toBe('0008');
    expect(regionVariants('0008')).toContain('8');
  });

  it('dla nazwy obrębu zostawia jeden wariant', () => {
    expect(regionVariants('Domiechowice')).toEqual(['Domiechowice']);
    expect(regionVariants('Stara Wieś')).toEqual(['Stara Wieś']);
  });
});

describe('splitRegionAndNumber', () => {
  it('rozdziela obręb i numer wpisane w jedno pole', () => {
    expect(splitRegionAndNumber('Domiechowice 100')).toEqual({
      region: 'Domiechowice',
      number: '100',
    });
  });

  it('trzyma wieloczłonowe nazwy obrębów w całości', () => {
    expect(splitRegionAndNumber('Stara Wieś 756')).toEqual({ region: 'Stara Wieś', number: '756' });
  });

  it('radzi sobie z numerem po podziale działki', () => {
    expect(splitRegionAndNumber('Dąbrowa 12/1')).toEqual({ region: 'Dąbrowa', number: '12/1' });
  });

  it('nie zgaduje, gdy ostatni człon nie jest numerem działki', () => {
    expect(splitRegionAndNumber('Stara Wieś')).toBeNull();
    expect(splitRegionAndNumber('Domiechowice')).toBeNull();
  });
});

describe('buildParcelQueries', () => {
  it('składa nazwę obrębu z numerem działki', () => {
    expect(buildParcelQueries('Domiechowice', '100')).toEqual(['Domiechowice 100']);
  });

  it('dla numeru obrębu pyta o wszystkie warianty zapisu', () => {
    expect(buildParcelQueries('8', '123')).toEqual(['8 123', '08 123', '008 123', '0008 123']);
  });

  it('wklejony identyfikator idzie do ULDK bez wariantów', () => {
    expect(buildParcelQueries('100102_2.0006.100', '')).toEqual(['100102_2.0006.100']);
    expect(buildParcelQueries('', '100102_2.0006.100')).toEqual(['100102_2.0006.100']);
  });

  it('znosi wszystko wpisane w jedno pole', () => {
    expect(buildParcelQueries('Domiechowice 100', '')).toEqual(['Domiechowice 100']);
  });

  it('bez numeru działki nie pyta wcale', () => {
    expect(buildParcelQueries('Domiechowice', '')).toEqual([]);
    expect(buildParcelQueries('', '123')).toEqual([]);
  });
});

describe('powiatLabelFromUldk', () => {
  // ULDK zwraca raz „powiat zgorzelecki", raz samo „bełchatowski".
  it('dokłada brakujące słowo „powiat"', () => {
    expect(powiatLabelFromUldk('bełchatowski')).toBe('powiat bełchatowski');
    expect(powiatLabelFromUldk('powiat zgorzelecki')).toBe('powiat zgorzelecki');
    expect(powiatLabelFromUldk('')).toBe('');
  });
});
