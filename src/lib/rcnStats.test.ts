// Klasyfikacja transakcji z Rejestru Cen Nieruchomości. To reguła produktowa, nie kosmetyka:
// grunt rolny szedł po ~7 zł/m², działka pod dom po ~100 zł/m², więc wrzucenie transakcji do
// złej puli nie wywala buildu, tylko cicho podaje kupującemu nieprawdziwą medianę
// ([[project-testy]], [[project_rcn_ceny_transakcyjne]]).
import { describe, expect, it } from 'vitest';
import { klasaTransakcji } from './rcnStats';

const t = (przeznaczenieMpzp: string | null, sposobUzytkowania: string | null = null) =>
  klasaTransakcji({ przeznaczenieMpzp, sposobUzytkowania });

describe('klasaTransakcji', () => {
  it('zabudowa mieszkaniowa jednorodzinna to działka budowlana', () => {
    expect(t('budownictwoMieszkanioweJednorodzinne')).toBe('budowlana');
  });

  it('decyzja o warunkach zabudowy też znaczy budowlana', () => {
    expect(t('decyzjaWarunkiZabudowy')).toBe('budowlana');
  });

  it('wpis łączony z terenem rolnym zostaje budowlany, bo to działka pod dom z kawałkiem pola', () => {
    expect(t('budownictwoMieszkanioweJednorodzinne;terenRolniczy')).toBe('budowlana');
  });

  it('sam teren rolniczy to grunt rolny', () => {
    expect(t('terenRolniczy')).toBe('rolna');
  });

  it('zabudowa zagrodowa gospodarstw rolnych idzie do rolnych (inny rynek niż dom pod miastem)', () => {
    expect(t('terenZabudowyZagrodowejGospodarstwRolnych')).toBe('rolna');
  });

  it('bez przeznaczenia decyduje sposób użytkowania', () => {
    expect(t(null, 'gruntyRolne')).toBe('rolna');
    expect(t(null, 'gruntyLesne')).toBe('rolna');
    expect(t(null, 'gruntyZabudowaneIZurbanizowane')).toBe('budowlana');
  });

  it('czego rejestr nie opisał, tego nie liczymy do żadnej mediany', () => {
    // „brakMPZPLubWZ" to najliczniejsza grupa po pustych i mieści zarówno pola, jak i działki
    // budowlane bez planu. Wrzucenie jej gdziekolwiek zafałszowałoby obie pule.
    expect(t('brakMPZPLubWZ')).toBeNull();
    expect(t('innyNiewymieniony')).toBeNull();
    expect(t(null, null)).toBeNull();
    expect(t(null, 'inne')).toBeNull();
  });

  it('nie łapie się na wielkość liter z rejestru', () => {
    expect(t('BUDOWNICTWOMIESZKANIOWEJEDNORODZINNE')).toBe('budowlana');
    expect(t(null, 'GruntyRolne')).toBe('rolna');
  });
});
