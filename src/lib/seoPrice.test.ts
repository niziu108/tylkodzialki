// Reguły prowadzenia ceny w raporcie „Sprawdź działkę". Bez bazy i sieci — sprawdzamy same
// progi, bo to one decydują, czy pokazujemy liczbę, czy milczymy ([[project-testy]]).
import { describe, expect, it } from 'vitest';
import {
  SIMILAR_SIZE_LADDER,
  isFarAndThin,
  isWideSpread,
  similarSizeRange,
} from './seoHub';

describe('similarSizeRange', () => {
  it('otacza powierzchnię działki widełkami z pierwszego stopnia drabinki', () => {
    expect(similarSizeRange(1000)).toEqual({ minM2: 600, maxM2: 1700 });
  });

  it('kolejne stopnie drabinki poszerzają widełki, zamiast rezygnować z podobieństwa', () => {
    const a = similarSizeRange(1000, 0);
    const b = similarSizeRange(1000, 1);
    const c = similarSizeRange(1000, 2);
    expect(b.minM2).toBeLessThan(a.minM2);
    expect(b.maxM2).toBeGreaterThan(a.maxM2);
    expect(c.minM2).toBeLessThan(b.minM2);
    expect(c.maxM2).toBeGreaterThan(b.maxM2);
  });

  it('poza drabinkę nie wychodzimy — najszerszy stopień jest ostatni', () => {
    expect(similarSizeRange(1000, 99)).toEqual(similarSizeRange(1000, SIMILAR_SIZE_LADDER.length - 1));
  });

  it('działka pod dom nie łapie się w widełki wielohektarowego pola', () => {
    const band = similarSizeRange(979);
    expect(band.maxM2).toBeLessThan(30_000);
    expect(band.minM2).toBeGreaterThan(0);
  });

  it('widełki rosną proporcjonalnie do metrażu', () => {
    const male = similarSizeRange(800);
    const duze = similarSizeRange(8000);
    expect(duze.minM2 / male.minM2).toBeCloseTo(10, 5);
  });

  it('każdy stopień otacza rozmiar działki z obu stron', () => {
    for (const s of SIMILAR_SIZE_LADDER) {
      expect(s.low).toBeLessThan(1);
      expect(s.high).toBeGreaterThan(1);
    }
  });
});

describe('bramki milczenia', () => {
  it('rozrzut p90/p10 od 3x w górę to dwa rynki naraz', () => {
    expect(isWideSpread({ low: 100, median: 200, high: 300 })).toBe(true);
    expect(isWideSpread({ low: 100, median: 130, high: 250 })).toBe(false);
    expect(isWideSpread(null)).toBe(false);
  });

  it('cienka próbka z najdalszego koła nie prowadzi raportu', () => {
    expect(isFarAndThin(10, 5)).toBe(true);
    expect(isFarAndThin(10, 20)).toBe(false);
    expect(isFarAndThin(3, 5)).toBe(false);
  });
});
