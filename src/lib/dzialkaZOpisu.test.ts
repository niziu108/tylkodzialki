import { describe, expect, it } from 'vitest';
import {
  kluczZOpisu,
  ladnaNazwaObrebu,
  miejscowoscZEtykiety,
  numeryZOpisu,
  pasujeDoOferty,
  regionyDoSzukania,
} from './dzialkaZOpisu';

describe('numeryZOpisu: numer działki', () => {
  // Zapisy wzięte z prawdziwych opisów biur (RE/MAX, Galactica, ASARI).
  it('czyta typowe zapisy z opisów biur', () => {
    expect(numeryZOpisu('Podstawowe informacje: - nr działki 43 - powierzchnia 3.600 m² (0,36 ha)').numery).toEqual(['43']);
    expect(numeryZOpisu('PARAMETRY DZIAŁKI: numer działki: 450/2 powierzchnia: około 775 m2').numery).toEqual(['450/2']);
    expect(numeryZOpisu('✔ Powierzchnia: 1781 m² ✔ Numer działki: 17887/11 ✔ Forma własności').numery).toEqual(['17887/11']);
    expect(numeryZOpisu('Wielkość 1454 m2 (nr działki 184/3)pozwala na wybudowanie domu').numery).toEqual(['184/3']);
    expect(numeryZOpisu('Numer działki ewidencyjnej: 1660 Powierzchnia: 1 503 m²').numery).toEqual(['1660']);
  });

  it('rozpoznaje „działka nr" i skróty', () => {
    expect(numeryZOpisu('Na sprzedaż działka nr 12/3 w Kani.').numery).toEqual(['12/3']);
    expect(numeryZOpisu('dz. nr 5, pow. 1200 m2').numery).toEqual(['5']);
    expect(numeryZOpisu('działka o numerze ewidencyjnym 7/2').numery).toEqual(['7/2']);
    expect(numeryZOpisu('nr ewid. 35/4, obręb Kania').numery).toEqual(['35/4']);
  });

  it('czyta opis z tagami i encjami z eksportu CRM', () => {
    expect(numeryZOpisu('<p>Dzia&#322;ka nr&nbsp;<b>98/1</b></p>').numery).toEqual(['98/1']);
  });

  it('czyta liczbę mnogą „numery działek"', () => {
    // RE/MAX, Rycerka Górna: oferta pięciu osobnych działek.
    expect(
      numeryZOpisu('Liczba działek: 5 Numery działek: 119/2, 130/15, 145, 793/14, 6866/23 Przeznaczenie w MPZP').numery
    ).toEqual(['119/2', '130/15', '145']);
    expect(numeryZOpisu('Sprzedam 2 działek nr 12 i 13').numery).toEqual(['12', '13']);
  });

  it('zbiera kilka działek z jednej oferty', () => {
    expect(numeryZOpisu('Sprzedam działki nr 105/10 i 105/12, razem 2400 m2').numery).toEqual(['105/10', '105/12']);
  });

  it('nie bierze metrażu, numeru oferty ani księgi wieczystej za numer działki', () => {
    expect(numeryZOpisu('Działka 1200 m2, nr oferty 345, tel. 600 123 456').numery).toEqual([]);
    expect(numeryZOpisu('Księga wieczysta nr PT1B/00012345/6').numery).toEqual([]);
    expect(numeryZOpisu('nr działki 1500 m2').numery).toEqual([]);
  });

  it('wyciąga pełny identyfikator i nie robi z niego osobnego numeru', () => {
    const z = numeryZOpisu('Działka 060606_2.0014.AR_3.756 na sprzedaż, numer działki 143803_2.0028.325/8.');
    expect(z.identyfikatory).toEqual(['060606_2.0014.AR_3.756', '143803_2.0028.325/8']);
    expect(z.numery).toEqual([]);
  });
});

describe('numeryZOpisu: obręb', () => {
  it('czyta nazwę i numer obrębu', () => {
    const z = numeryZOpisu('w obrębie 003 Bór Zapilski, numer działki 323/1');
    expect(z.obrebyNumery).toEqual(['003']);
    expect(z.obrebyNazwy).toEqual(['Bór Zapilski']);
    expect(z.numery).toEqual(['323/1']);
  });

  it('radzi sobie z opisem pisanym wersalikami', () => {
    const z = numeryZOpisu('OBRĘB KANIA, DZIAŁKA NR 27/33');
    expect(z.obrebyNazwy).toEqual(['KANIA']);
    expect(z.numery).toEqual(['27/33']);
  });

  it('ucina nazwę na słowie, które już nie jest obrębem', () => {
    expect(numeryZOpisu('obręb Kania Gmina Somianka').obrebyNazwy).toEqual(['Kania']);
  });

  it('nie myli „w obrębie działki" z nazwą obrębu', () => {
    expect(numeryZOpisu('W obrębie działki rosną drzewa').obrebyNazwy).toEqual([]);
  });
});

describe('kluczZOpisu', () => {
  it('bez numeru działki nie ma czego sprawdzać', () => {
    expect(kluczZOpisu(numeryZOpisu('Piękna działka w obrębie Kania'))).toBeNull();
  });

  it('zmiana numeru w opisie zmienia klucz', () => {
    const a = kluczZOpisu(numeryZOpisu('nr działki 12/3'));
    const b = kluczZOpisu(numeryZOpisu('nr działki 12/4'));
    expect(a).not.toBeNull();
    expect(a).not.toEqual(b);
  });
});

describe('regionyDoSzukania', () => {
  it('najpierw obręb z opisu, potem miejscowość, na końcu numer obrębu', () => {
    const z = numeryZOpisu('obręb 0003 Bór Zapilski, nr działki 323/1');
    expect(regionyDoSzukania(z, 'Bór Zapilski')).toEqual(['Bór Zapilski', '0003']);
    expect(regionyDoSzukania(numeryZOpisu('nr działki 43'), 'Kania')).toEqual(['Kania']);
  });
});

describe('miejscowoscZEtykiety', () => {
  it('bierze pierwszy człon etykiety', () => {
    expect(miejscowoscZEtykiety('Radziwiłłów, Puszcza Mariańska')).toBe('Radziwiłłów');
  });

  it('pomija ulicę z numerem domu', () => {
    expect(miejscowoscZEtykiety('ul. Dworska 5, Sieradz')).toBe('Sieradz');
  });

  it('pusta etykieta to brak miejscowości', () => {
    expect(miejscowoscZEtykiety(null)).toBeNull();
    expect(miejscowoscZEtykiety('')).toBeNull();
  });
});

describe('ladnaNazwaObrebu', () => {
  it('zamienia wersaliki z ewidencji na zwykły zapis', () => {
    expect(ladnaNazwaObrebu('RADZIWIŁŁÓW')).toBe('Radziwiłłów');
    expect(ladnaNazwaObrebu('BÓR ZAPILSKI')).toBe('Bór Zapilski');
  });

  it('numer obrębu i zapis mieszany zostawia bez zmian', () => {
    expect(ladnaNazwaObrebu('0028')).toBe('0028');
    expect(ladnaNazwaObrebu('Stara Wieś')).toBe('Stara Wieś');
  });
});

describe('pasujeDoOferty', () => {
  it('przyjmuje działkę blisko pinezki o zgodnej powierzchni', () => {
    expect(pasujeDoOferty({ areaM2: 3233, km: 0.4 }, 3269)).toBe(true);
  });

  it('odrzuca działkę daleko od oferty', () => {
    expect(pasujeDoOferty({ areaM2: 1000, km: 12 }, 1000)).toBe(false);
  });

  it('odrzuca, gdy ogłoszenie sprzedaje wyraźnie inny metraż', () => {
    // Część większej działki („do wydzielenia") albo kilka działek w jednej ofercie.
    expect(pasujeDoOferty({ areaM2: 12000, km: 1 }, 1500)).toBe(false);
    expect(pasujeDoOferty({ areaM2: 1300, km: 1 }, 1000)).toBe(false);
    expect(pasujeDoOferty({ areaM2: 750, km: 1 }, 1000)).toBe(false);
  });

  it('znosi zaokrąglony metraż z ogłoszenia', () => {
    expect(pasujeDoOferty({ areaM2: 1080, km: 1 }, 1000)).toBe(true);
    expect(pasujeDoOferty({ areaM2: 5300, km: 2 }, 5000)).toBe(true);
  });

  it('bez powierzchni w ogłoszeniu nie potwierdzi działki', () => {
    expect(pasujeDoOferty({ areaM2: 1000, km: 1 }, 0)).toBe(false);
  });
});
