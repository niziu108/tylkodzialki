import { describe, it, expect } from 'vitest';
import { parseAdmin, adminFromColumns, powiatAdjGen, powiatAdjLoc } from './seoPowiaty';

describe('parseAdmin (ścieżka administracyjna z feedu)', () => {
  it('czyta powiat i województwo z pełnej ścieżki', () => {
    expect(parseAdmin('Wólka, Bełchatów, bełchatowski, łódzkie')).toEqual({
      powiatSlug: 'belchatowski',
      powiatAdj: 'bełchatowski',
      wojSlug: 'lodzkie',
    });
  });

  // Regresja: powiaty dwuczłonowe wypadały z osi, bo nazwa nie kończy się na „ki”.
  it('przyjmuje powiaty dwuczłonowe', () => {
    expect(parseAdmin('GARBÓW, TUSZYN, ŁÓDZKI WSCHODNI, ŁÓDZKIE')?.powiatAdj).toBe('łódzki wschodni');
    expect(parseAdmin('Ożarów, warszawski zachodni, mazowieckie')?.powiatAdj).toBe('warszawski zachodni');
  });

  it('pomija miasta na prawach powiatu (pokrywają je huby miast)', () => {
    expect(parseAdmin('Tychy, Zawiść, Tychy, Tychy m., ŚLĄSKIE')).toBeNull();
  });

  it('zwraca null, gdy ostatni token nie jest województwem', () => {
    expect(parseAdmin('Dąbrowica, koniński')).toBeNull();
    expect(parseAdmin('Łódzkie')).toBeNull();
    expect(parseAdmin(null)).toBeNull();
  });
});

describe('adminFromColumns (oś z ULDK)', () => {
  it('ścina prefiks „powiat”, żeby oba źródła trafiały do jednego kubełka', () => {
    const zUldk = adminFromColumns('łódzkie', 'powiat bełchatowski');
    const zFeedu = parseAdmin('Wólka, Bełchatów, bełchatowski, łódzkie');
    expect(zUldk).toEqual(zFeedu);
  });

  it('obsługuje powiat dwuczłonowy z ULDK', () => {
    expect(adminFromColumns('łódzkie', 'powiat łódzki wschodni')?.powiatSlug).toBe('lodzki-wschodni');
  });

  it('pomija miasto na prawach powiatu', () => {
    expect(adminFromColumns('mazowieckie', 'powiat Warszawa')).toBeNull();
    expect(adminFromColumns('śląskie', 'powiat Tychy')).toBeNull();
  });

  it('zwraca null przy brakujących danych albo nieznanym województwie', () => {
    expect(adminFromColumns(null, 'powiat bełchatowski')).toBeNull();
    expect(adminFromColumns('łódzkie', null)).toBeNull();
    expect(adminFromColumns('nieistniejące', 'powiat bełchatowski')).toBeNull();
  });
});

describe('odmiana nazwy powiatu', () => {
  it('odmienia powiat jednoczłonowy', () => {
    expect(powiatAdjGen('giżycki')).toBe('giżyckiego');
    expect(powiatAdjLoc('giżycki')).toBe('giżyckim');
  });

  // Regresja: przy dwuczłonowych odmieniał tylko ostatni wyraz („łódzki wschodniego”).
  it('odmienia oba człony powiatu dwuczłonowego', () => {
    expect(powiatAdjGen('łódzki wschodni')).toBe('łódzkiego wschodniego');
    expect(powiatAdjLoc('łódzki wschodni')).toBe('łódzkim wschodnim');
    expect(powiatAdjGen('warszawski zachodni')).toBe('warszawskiego zachodniego');
  });
});
