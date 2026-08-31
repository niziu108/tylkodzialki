// Przypadki wzięte z prawdziwych feedów (pełne eksporty 8 biur, 193 działki z wypełnionym
// polem `drogadojazdowa`). Rozkład wartości był taki: asfaltowa 31%, LOKALNA DROGA 15%,
// CICHA ULICA 13%, kostka 10%, inna 7%, asfalt 4%, utwardzona 2%, szutrowa 2%.

import { describe, it, expect } from 'vitest';
import { mapDojazd, maTwardyDojazd, DOJAZD_LABEL } from './dojazd';

describe('mapDojazd', () => {
  it('sprowadza warianty asfaltu do jednego stanu', () => {
    for (const v of ['asfaltowa', 'asfalt', 'Asfaltowa', 'ASFALTOWA', 'asfaltowa/betonowa', 'droga asfaltowa']) {
      expect(mapDojazd(v), v).toBe('ASFALT');
    }
  });

  // Kostka to osobna kategoria, nie odmiana asfaltu: inna nawierzchnia, inna cena wykonania,
  // a kupujacy widzi w ofercie dokladnie to, co jest. Dla filtra obie sa twarde.
  it('kostka ma własną kategorię', () => {
    expect(mapDojazd('kostka')).toBe('KOSTKA');
    expect(mapDojazd('kostka brukowa')).toBe('KOSTKA');
    expect(mapDojazd('bruk')).toBe('KOSTKA');
    expect(maTwardyDojazd(mapDojazd('kostka'))).toBe(true);
    expect(maTwardyDojazd(mapDojazd('asfalt'))).toBe(true);
  });

  it('rozpoznaje drogę utwardzoną', () => {
    for (const v of ['utwardzona', 'Utwardzona', 'droga utwardzona', 'szutrowa', 'szuter', 'żwirowa', 'tłuczeń']) {
      expect(mapDojazd(v), v).toBe('UTWARDZONA');
    }
  });

  it('rozpoznaje drogę gruntową', () => {
    for (const v of ['gruntowa', 'droga gruntowa', 'polna', 'ziemna', 'piaszczysta']) {
      expect(mapDojazd(v), v).toBe('GRUNTOWA');
    }
  });

  // Pułapka jak z województwami („wielkopolskie" zawiera „opolskie"): samo szukanie podciągu
  // wrzuciłoby „nieutwardzoną" do UTWARDZONEJ, czyli pokazalibyśmy polną drogę jako utwardzoną.
  it('nie myli zaprzeczenia z formą twierdzącą', () => {
    expect(mapDojazd('nieutwardzona')).toBe('GRUNTOWA');
    expect(mapDojazd('nie utwardzona')).toBe('GRUNTOWA');
    expect(mapDojazd('droga nieutwardzona')).toBe('GRUNTOWA');
  });

  // Leśna osobno, a nie jako odmiana gruntowej: przy działce rekreacyjnej pod lasem to zaleta.
  it('droga leśna ma własną kategorię', () => {
    expect(mapDojazd('droga leśna')).toBe('LESNA');
    expect(mapDojazd('leśna')).toBe('LESNA');
    expect(maTwardyDojazd(mapDojazd('droga leśna'))).toBe(false);
  });

  it('rozpoznaje brak dojazdu', () => {
    for (const v of ['brak', 'brak dojazdu', 'bez dojazdu', 'brak drogi', 'bez drogi']) {
      expect(mapDojazd(v), v).toBe('BRAK_DOJAZDU');
    }
  });

  // Te wartości mówią o charakterze drogi, nie o nawierzchni. Filtr twardy nie może zgadywać:
  // „główna droga" bywa asfaltem, ale bywa też szutrem.
  it('nie zgaduje nawierzchni z opisu charakteru drogi', () => {
    // „droga wewnętrzna" to status prawny, nie nawierzchnia — bywa i asfaltem, i błotem.
    for (const v of ['LOKALNA DROGA', 'CICHA ULICA', 'GŁÓWNA DROGA', 'inna', 'droga wewnętrzna', 'osiedlowa']) {
      expect(mapDojazd(v), v).toBe('BRAK_INFORMACJI');
    }
  });

  it('z wartości łączonej bierze najlepszą nawierzchnię', () => {
    expect(mapDojazd('CICHA ULICA,ASFALTOWA,LOKALNA DROGA')).toBe('ASFALT');
    expect(mapDojazd('lokalna droga, szutrowa')).toBe('UTWARDZONA');
  });

  it('brak wartości daje brak informacji, nigdy fałszywego asfaltu', () => {
    expect(mapDojazd(null)).toBe('BRAK_INFORMACJI');
    expect(mapDojazd(undefined)).toBe('BRAK_INFORMACJI');
    expect(mapDojazd('')).toBe('BRAK_INFORMACJI');
    expect(mapDojazd('   ')).toBe('BRAK_INFORMACJI');
    expect(mapDojazd(42)).toBe('BRAK_INFORMACJI');
  });
});

describe('maTwardyDojazd', () => {
  it('przepuszcza tylko potwierdzoną nawierzchnię twardą', () => {
    expect(maTwardyDojazd('ASFALT')).toBe(true);
    expect(maTwardyDojazd('UTWARDZONA')).toBe(true);
  });

  // Sedno filtra twardego: oferta bez informacji NIE MOŻE trafić do wyników „dojazd utwardzony".
  it('odrzuca gruntową, brak dojazdu i brak informacji', () => {
    expect(maTwardyDojazd('GRUNTOWA')).toBe(false);
    expect(maTwardyDojazd('BRAK_DOJAZDU')).toBe(false);
    expect(maTwardyDojazd('BRAK_INFORMACJI')).toBe(false);
    expect(maTwardyDojazd(null)).toBe(false);
    expect(maTwardyDojazd(undefined)).toBe(false);
  });
});

describe('etykiety', () => {
  it('każdy stan ma etykietę dla UI', () => {
    for (const stan of ['ASFALT', 'KOSTKA', 'UTWARDZONA', 'GRUNTOWA', 'LESNA', 'BRAK_DOJAZDU', 'BRAK_INFORMACJI'] as const) {
      expect(DOJAZD_LABEL[stan]).toBeTruthy();
    }
  });
});
