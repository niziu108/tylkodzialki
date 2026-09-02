import { describe, it, expect } from 'vitest';
import { parseRcnXml, normalizujPowierzchnieM2, doZapisu, mediana } from './rcn';

const XML = `<GETFEATUREINFO>
<DZIALKA>
<TERYT>1016</TERYT>
<TRAN_LOKALNY_ID_IIP>ABC-123</TRAN_LOKALNY_ID_IIP>
<TRAN_RODZAJ_TRANS>wolnyRynek</TRAN_RODZAJ_TRANS>
<TRAN_SPRZEDAJACY>osobaFizyczna</TRAN_SPRZEDAJACY>
<TRAN_KUPUJACY>osobaFizyczna</TRAN_KUPUJACY>
<TRAN_CENA_BRUTTO>64000</TRAN_CENA_BRUTTO>
<DOK_DATA>2025-04-03 02:00:00+02</DOK_DATA>
<NIER_RODZAJ>nieruchomoscGruntowaNiezabudowana</NIER_RODZAJ>
<NIER_UDZIAL>1/1</NIER_UDZIAL>
<NIER_POW_GRUNTU>0.0889</NIER_POW_GRUNTU>
<DZI_ID_DZIALKI>101601_1.0007.319</DZI_ID_DZIALKI>
<DZI_NR_DZIALKI>319</DZI_NR_DZIALKI>
<DZI_PRZEZN_WMPZP></DZI_PRZEZN_WMPZP>
</DZIALKA>
</GETFEATUREINFO>`;

describe('parseRcnXml', () => {
  it('wyciąga rekord i jego pola', () => {
    const [r] = parseRcnXml(XML);
    expect(r.TERYT).toBe('1016');
    expect(r.TRAN_CENA_BRUTTO).toBe('64000');
    expect(r.DZI_PRZEZN_WMPZP).toBe('');
  });

  it('zwraca pustą listę, gdy nie ma rekordów', () => {
    expect(parseRcnXml('<GETFEATUREINFO></GETFEATUREINFO>')).toEqual([]);
  });
});

describe('normalizujPowierzchnieM2', () => {
  // Powiaty podają różne jednostki. To jest sedno poprawności zł/m².
  it('traktuje małe wartości jako hektary', () => {
    expect(normalizujPowierzchnieM2('0.0889')).toBe(889);
    expect(normalizujPowierzchnieM2('0.1713')).toBe(1713);
    expect(normalizujPowierzchnieM2('1')).toBe(10000);
  });

  it('traktuje duże wartości jako metry (powiat 2464 podaje tak)', () => {
    expect(normalizujPowierzchnieM2('15013')).toBe(15013);
    expect(normalizujPowierzchnieM2('16007')).toBe(16007);
  });

  it('przyjmuje przecinek dziesiętny', () => {
    expect(normalizujPowierzchnieM2('0,17')).toBe(1700);
  });

  it('odrzuca puste, zerowe i niebędące liczbą', () => {
    for (const v of ['', '0', '-1', 'brak', null, undefined]) {
      expect(normalizujPowierzchnieM2(v)).toBeNull();
    }
  });
});

describe('doZapisu', () => {
  it('liczy zł/m² przez powierzchnię nieruchomości', () => {
    const d = doZapisu(parseRcnXml(XML)[0]);
    expect(d).not.toBeNull();
    expect(d!.powierzchniaM2).toBe(889);
    expect(d!.cenaBruttoPln).toBe(64000);
    expect(Math.round(d!.cenaZaM2)).toBe(72);
    expect(d!.dataTransakcji.toISOString().slice(0, 10)).toBe('2025-04-03');
    expect(d!.przeznaczenieMpzp).toBeNull(); // puste pole nie udaje wartości
  });

  it('odrzuca rekord bez ceny', () => {
    const r = { ...parseRcnXml(XML)[0], TRAN_CENA_BRUTTO: '0' };
    expect(doZapisu(r)).toBeNull();
  });

  // Regresja: bez tego progu Częstochowa dawała 150 mln m² i 0 zł/m².
  it('odrzuca zł/m² poza widełkami zdrowego rozsądku', () => {
    const tanie = { ...parseRcnXml(XML)[0], TRAN_CENA_BRUTTO: '100', NIER_POW_GRUNTU: '5' };
    expect(doZapisu(tanie)).toBeNull(); // 100 zł za 5 ha
    const drogie = { ...parseRcnXml(XML)[0], TRAN_CENA_BRUTTO: '9000000', NIER_POW_GRUNTU: '0.01' };
    expect(doZapisu(drogie)).toBeNull(); // 90 000 zł/m²
  });

  it('odrzuca rekord bez poprawnej daty albo bez kluczy', () => {
    expect(doZapisu({ ...parseRcnXml(XML)[0], DOK_DATA: '' })).toBeNull();
    expect(doZapisu({ ...parseRcnXml(XML)[0], DZI_ID_DZIALKI: '' })).toBeNull();
  });

  // Filtry rodzaju i udziału celowo NIE działają przy zapisie, tylko przy odczycie.
  it('zapisuje także transakcje, które przy odczycie odfiltrujemy', () => {
    const r = { ...parseRcnXml(XML)[0], TRAN_RODZAJ_TRANS: 'sprzedazZBonifikata', NIER_UDZIAL: '1/2' };
    const d = doZapisu(r);
    expect(d).not.toBeNull();
    expect(d!.rodzajTransakcji).toBe('sprzedazZBonifikata');
    expect(d!.udzial).toBe('1/2');
  });
});

describe('mediana', () => {
  it('liczy dla nieparzystej i parzystej liczby elementów', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });
  it('pusta lista daje null', () => {
    expect(mediana([])).toBeNull();
  });
});
