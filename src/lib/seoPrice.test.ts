// Reguły prowadzenia ceny w raporcie „Sprawdź działkę". Bez bazy i sieci — sprawdzamy same
// progi, bo to one decydują, czy pokazujemy liczbę, czy milczymy ([[project-testy]]).
import { describe, expect, it } from 'vitest';
import {
  FACTOR_MIN_DELTA,
  FACTOR_MIN_SAMPLE,
  MIN_SAMPLE,
  SIMILAR_SIZE_HIGH,
  SIMILAR_SIZE_LOW,
  isFarAndThin,
  isWideSpread,
  similarSizeRange,
} from './seoHub';

describe('similarSizeRange', () => {
  it('otacza powierzchnię działki widełkami wg stałych', () => {
    expect(similarSizeRange(1000)).toEqual({ minM2: 600, maxM2: 1700 });
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

  it('stałe trzymają sensowny kierunek', () => {
    expect(SIMILAR_SIZE_LOW).toBeLessThan(1);
    expect(SIMILAR_SIZE_HIGH).toBeGreaterThan(1);
  });
});

describe('progi czynników cenowych', () => {
  it('wymagają większej próbki niż zwykła mediana', () => {
    expect(FACTOR_MIN_SAMPLE).toBeGreaterThan(MIN_SAMPLE);
  });

  it('odcinają różnice, które są szumem', () => {
    expect(FACTOR_MIN_DELTA).toBeGreaterThan(0);
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
