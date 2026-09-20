// Tytuły hubów decydują o CTR w wynikach Google, a nie o pozycji, więc jedyne, co je
// psuje, to ucięcie w połowie i brak liczby. Te dwie rzeczy testujemy.
//
// Punkt wyjścia (GSC 22.08–18.09.2026): 74,3 tys. wyświetleń przy CTR 1,33%, przy czym
// stary tytuł oddawał 17 z ~60 znaków szablonowi „| tylkodzialki.pl".

import { describe, it, expect } from 'vitest';
import { getSeoCity, getSeoType } from './seo-locations';
import {
  buildCategoryTitle,
  buildCityTitle,
  buildAreaTitle,
  pickTitle,
  TITLE_MAX_CHARS,
  META_COUNT_LEAD,
} from './seoCategoryContent';

const tychy = getSeoCity('tychy')!;
const ostrowiec = getSeoCity('ostrowiec-swietokrzyski')!;
const budowlane = getSeoType('budowlane')!;
const inwestycyjne = getSeoType('inwestycyjne')!;

describe('buildCategoryTitle', () => {
  it('prowadzi liczbą ofert i mówi o okolicy', () => {
    expect(buildCategoryTitle(tychy, budowlane, 275)).toBe(
      'Działki budowlane Tychy i okolice, 275 ofert na sprzedaż'
    );
  });

  it('odmienia „oferta” po polsku', () => {
    expect(buildCategoryTitle(tychy, budowlane, 22)).toContain('22 oferty');
    expect(buildCategoryTitle(tychy, budowlane, 25)).toContain('25 ofert');
  });

  // Małą podażą się nie chwalimy — ten sam próg co w meta description.
  it('poniżej progu nie pokazuje liczby', () => {
    const t = buildCategoryTitle(tychy, budowlane, META_COUNT_LEAD - 1);
    expect(t).toBe('Działki budowlane Tychy i okolice, oferty na sprzedaż');
    expect(t).not.toMatch(/\d/);
  });

  // Długa nazwa miasta + długi przymiotnik = pełny wariant się nie mieści. Ma odpaść
  // cały człon, nigdy nie zostać ucięty w pół słowa.
  it('skraca zamiast dać się uciąć', () => {
    const t = buildCategoryTitle(ostrowiec, inwestycyjne, 120);
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(t).toContain('120 ofert');
    expect(t).not.toContain('na sprzedaż');
  });
});

describe('buildCityTitle', () => {
  it('zachowuje frazę „na sprzedaż” i dokłada liczbę', () => {
    expect(buildCityTitle(getSeoCity('ostroleka')!, 78)).toBe(
      'Działki na sprzedaż Ostrołęka i okolice, 78 ofert'
    );
  });
});

describe('buildAreaTitle', () => {
  // Powiat i województwo to obszar administracyjny, nie promień wokół miasta:
  // „i okolice” byłoby tam nieprawdą, więc dokładamy samą liczbę.
  it('dokłada liczbę bez frazy o okolicy', () => {
    expect(buildAreaTitle('Działki na sprzedaż, powiat bełchatowski', 64)).toBe(
      'Działki na sprzedaż, powiat bełchatowski, 64 oferty'
    );
  });

  it('poniżej progu zostawia bazę bez zmian', () => {
    const base = 'Działki na sprzedaż, województwo opolskie';
    expect(buildAreaTitle(base, 3)).toBe(base);
  });
});

describe('pickTitle', () => {
  it('bierze pierwszy wariant, który się mieści', () => {
    expect(pickTitle(['x'.repeat(TITLE_MAX_CHARS + 1), 'krótki'])).toBe('krótki');
  });

  // Wyjście awaryjne: gdy nawet ostatni wariant jest za długi, oddajemy go zamiast pustki.
  it('gdy nic się nie mieści, oddaje ostatni wariant', () => {
    const long = 'y'.repeat(TITLE_MAX_CHARS + 5);
    expect(pickTitle([long + 'z', long])).toBe(long);
  });
});
