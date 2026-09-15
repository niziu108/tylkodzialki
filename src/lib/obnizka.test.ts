import { describe, expect, it } from 'vitest';
import { obnizkaPct } from './obnizka';

const POW = 1000;

describe('obnizkaPct', () => {
  it('liczy obniżkę jak strona oferty (zaokrąglony procent)', () => {
    expect(obnizkaPct({ cenaPln: 359000, powierzchniaM2: 35400 }, { cenaPln: 251000, powierzchniaM2: 35400 })).toBe(30);
    expect(obnizkaPct({ cenaPln: 200000, powierzchniaM2: POW }, { cenaPln: 184000, powierzchniaM2: POW })).toBe(8);
  });

  it('próg 5% jest włącznie, drobnej korekty nie wyróżnia', () => {
    expect(obnizkaPct({ cenaPln: 100000, powierzchniaM2: POW }, { cenaPln: 95000, powierzchniaM2: POW })).toBe(5);
    expect(obnizkaPct({ cenaPln: 200000, powierzchniaM2: POW }, { cenaPln: 195000, powierzchniaM2: POW })).toBeNull();
  });

  it('podwyżka i brak zmiany to nie obniżka', () => {
    expect(obnizkaPct({ cenaPln: 100000, powierzchniaM2: POW }, { cenaPln: 120000, powierzchniaM2: POW })).toBeNull();
    expect(obnizkaPct({ cenaPln: 100000, powierzchniaM2: POW }, { cenaPln: 100000, powierzchniaM2: POW })).toBeNull();
  });

  it('zmiana metrażu to inna oferta, nie obniżka', () => {
    // Prawdziwy przypadek z CRM: 50 000 m² za 390 tys. zamienione na 15 500 m² za 130 tys.
    expect(obnizkaPct({ cenaPln: 390000, powierzchniaM2: 50000 }, { cenaPln: 130000, powierzchniaM2: 15500 })).toBeNull();
  });

  it('znosi zaokrąglenie metrażu o metr', () => {
    expect(obnizkaPct({ cenaPln: 100000, powierzchniaM2: 850 }, { cenaPln: 90000, powierzchniaM2: 851 })).toBe(10);
  });

  it('spadek powyżej 50% przy tym samym metrażu traktuje jak literówkę', () => {
    expect(obnizkaPct({ cenaPln: 1500000, powierzchniaM2: POW }, { cenaPln: 150000, powierzchniaM2: POW })).toBeNull();
  });

  it('bez ceny nie ma obniżki', () => {
    expect(obnizkaPct({ cenaPln: 0, powierzchniaM2: POW }, { cenaPln: 90000, powierzchniaM2: POW })).toBeNull();
  });
});
