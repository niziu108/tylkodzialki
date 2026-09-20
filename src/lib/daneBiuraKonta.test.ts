import { describe, expect, it } from 'vitest';
import { uzupelnienieDanychBiura } from './daneBiuraKonta';

const PUSTE_KONTO = {
  defaultBiuroNazwa: null,
  defaultBiuroOpiekun: null,
  defaultBiuroLogoUrl: null,
};

const KONTO_Z_LOGO_ADMINA = {
  defaultBiuroNazwa: 'EMJOT NIERUCHOMOŚCI',
  defaultBiuroOpiekun: 'MAGDALENA',
  defaultBiuroLogoUrl: 'https://img.tylkodzialki.pl/loga-biur/1782-emjot.webp',
};

const Z_FORMULARZA = {
  biuroNazwa: 'EMJOT',
  biuroOpiekun: 'Anna',
  biuroLogoUrl: 'https://img.tylkodzialki.pl/dzialki/1790-logo.webp',
};

describe('uzupelnienieDanychBiura', () => {
  it('puste konto dostaje dane z formularza (biuro bez logo od admina)', () => {
    expect(uzupelnienieDanychBiura(PUSTE_KONTO, 'BIURO', Z_FORMULARZA)).toEqual({
      defaultBiuroNazwa: 'EMJOT',
      defaultBiuroOpiekun: 'Anna',
      defaultBiuroLogoUrl: 'https://img.tylkodzialki.pl/dzialki/1790-logo.webp',
    });
  });

  it('danych, które na koncie są, formularz nie nadpisuje', () => {
    expect(uzupelnienieDanychBiura(KONTO_Z_LOGO_ADMINA, 'BIURO', Z_FORMULARZA)).toEqual({});
  });

  it('puste pola formularza nie kasują danych konta', () => {
    expect(
      uzupelnienieDanychBiura(KONTO_Z_LOGO_ADMINA, 'BIURO', {
        biuroNazwa: null,
        biuroOpiekun: null,
        biuroLogoUrl: null,
      })
    ).toEqual({});
  });

  it('ogłoszenie prywatne nie rusza danych biura na koncie', () => {
    expect(
      uzupelnienieDanychBiura(KONTO_Z_LOGO_ADMINA, 'PRYWATNIE', {
        biuroNazwa: null,
        biuroOpiekun: null,
        biuroLogoUrl: null,
      })
    ).toEqual({});
  });

  it('uzupełnia tylko brakujące pole, reszty nie dotyka', () => {
    expect(
      uzupelnienieDanychBiura(
        { ...KONTO_Z_LOGO_ADMINA, defaultBiuroLogoUrl: null },
        'BIURO',
        Z_FORMULARZA
      )
    ).toEqual({ defaultBiuroLogoUrl: 'https://img.tylkodzialki.pl/dzialki/1790-logo.webp' });
  });
});
