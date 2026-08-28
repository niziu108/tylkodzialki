import { describe, it, expect } from 'vitest';
import { buildOpisZDanych } from './opisGenerator';

describe('buildOpisZDanych', () => {
  it('składa pełny opis z kompletu danych', () => {
    const opis = buildOpisZDanych({
      transakcja: 'SPRZEDAZ',
      przeznaczenia: ['BUDOWLANA'],
      powierzchniaM2: 1200,
      cenaPln: 150000,
      locationFull: 'Bełchatów, gmina Bełchatów, powiat bełchatowski, województwo łódzkie',
      prad: 'PRZYLACZE_NA_DZIALCE',
      woda: 'WODOCIAG_NA_DZIALCE',
      kanalizacja: 'MIEJSKA_W_DRODZE',
      gaz: 'MOZLIWOSC_PODLACZENIA',
      swiatlowod: 'BRAK',
      mpzp: true,
      wymiary: '30×40 m',
      ksiegaWieczysta: 'AB1C/00012345/6',
    });

    expect(opis).toContain('Działka budowlana o powierzchni 1 200 m².');
    expect(opis).toContain('Lokalizacja: Bełchatów, gmina Bełchatów, powiat bełchatowski, województwo łódzkie.');
    expect(opis).toContain('Wymiary: 30×40 m.');
    expect(opis).toContain('Cena: 150 000 zł (około 125 zł/m²).');
    expect(opis).toContain('Na działce: prąd, woda.');
    expect(opis).toContain('W drodze: kanalizacja miejska.');
    expect(opis).toContain('Możliwość podłączenia: gaz.');
    expect(opis).toContain('Działka objęta miejscowym planem zagospodarowania przestrzennego.');
  });

  it('nie wypisuje numeru księgi wieczystej, tylko sam fakt jej prowadzenia', () => {
    const opis = buildOpisZDanych({ ksiegaWieczysta: 'AB1C/00012345/6' });

    expect(opis).toContain('Dla działki prowadzona jest księga wieczysta.');
    expect(opis).not.toContain('AB1C');
  });

  it('mówi wprost, gdy działka jest nieuzbrojona', () => {
    const opis = buildOpisZDanych({
      przeznaczenia: ['ROLNA'],
      powierzchniaM2: 5000,
      prad: 'BRAK_PRZYLACZA',
      woda: 'BRAK_PRZYLACZA',
      kanalizacja: 'BRAK',
      gaz: 'BRAK',
      swiatlowod: 'BRAK',
    });

    expect(opis).toContain('Działka rolna o powierzchni 5 000 m².');
    expect(opis).toContain('Działka nieuzbrojona.');
  });

  it('łączy kilka przeznaczeń spójnikiem, bez przecinka przed „i"', () => {
    const dwa = buildOpisZDanych({ przeznaczenia: ['BUDOWLANA', 'ROLNA'] });
    const trzy = buildOpisZDanych({ przeznaczenia: ['BUDOWLANA', 'ROLNA', 'LESNA'] });

    expect(dwa).toContain('Działka budowlana i rolna.');
    expect(trzy).toContain('Działka budowlana, rolna i leśna.');
  });

  it('przy wynajmie nie przelicza ceny na metr', () => {
    const opis = buildOpisZDanych({ transakcja: 'WYNAJEM', cenaPln: 1500, powierzchniaM2: 1000 });

    expect(opis).toContain('Cena najmu: 1 500 zł.');
    expect(opis).not.toContain('zł/m²');
  });

  it('pomija puste pola zamiast zostawiać dziury w zdaniach', () => {
    const opis = buildOpisZDanych({ przeznaczenia: ['BUDOWLANA'], klasaZiemi: '   ', wymiary: '' });

    expect(opis).toContain('Działka budowlana.');
    expect(opis).not.toContain('Wymiary');
    expect(opis).not.toContain('Klasa gruntu');
    expect(opis).not.toContain('undefined');
    expect(opis).not.toContain('NaN');
  });

  it('nie dopisuje niczego, czego nie ma w danych', () => {
    const opis = buildOpisZDanych({ przeznaczenia: ['REKREACYJNA'], powierzchniaM2: 800 });

    // Typowe wypełniacze, które dokłada model językowy, a których nikt nie potwierdził.
    for (const wymysl of ['spokojn', 'cich', 'urokliw', 'inwestycj', 'blisko', 'idealn', 'okazj']) {
      expect(opis.toLowerCase()).not.toContain(wymysl);
    }
  });
});
