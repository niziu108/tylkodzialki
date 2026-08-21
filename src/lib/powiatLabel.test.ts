import { describe, it, expect } from 'vitest';
import { stripPowiatPrefix, powiatKey } from './powiatLabel';

describe('stripPowiatPrefix', () => {
  it('ścina prefiks „powiat" z nazw podawanych przez część feedów', () => {
    expect(stripPowiatPrefix('powiat sieradzki')).toBe('sieradzki');
    expect(stripPowiatPrefix('Powiat Sieradzki')).toBe('Sieradzki');
  });

  it('nie rusza nazwy podanej już bez prefiksu', () => {
    expect(stripPowiatPrefix('sieradzki')).toBe('sieradzki');
    expect(stripPowiatPrefix('zduńskowolski')).toBe('zduńskowolski');
  });

  // Nazwa powiatu może brzmieć podobnie do prefiksu — ścinamy tylko osobne słowo,
  // inaczej zjedlibyśmy początek prawdziwej nazwy.
  it('nie ścina, gdy „powiat" jest częścią nazwy bez spacji', () => {
    expect(stripPowiatPrefix('powiatowy')).toBe('powiatowy');
  });
});

describe('powiatKey', () => {
  it('sprowadza oba warianty slugu do jednego kubełka', () => {
    expect(powiatKey('powiat-sieradzki')).toBe('sieradzki');
    expect(powiatKey('sieradzki')).toBe('sieradzki');
  });

  it('zostawia slug, w którym „powiat" nie jest prefiksem', () => {
    expect(powiatKey('nowopowiat-ski')).toBe('nowopowiat-ski');
  });
});
