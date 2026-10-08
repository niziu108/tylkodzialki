import { describe, expect, it } from 'vitest';
import { regionOfRow } from './cenyPolska';

describe('regionOfRow: województwo oferty pod ceny /ceny', () => {
  it('bierze kolumnę z ULDK z polskimi znakami', () => {
    expect(regionOfRow({ adminWoj: 'świętokrzyskie' })?.slug).toBe('swietokrzyskie');
    expect(regionOfRow({ adminWoj: 'warmińsko-mazurskie' })?.slug).toBe('warminsko-mazurskie');
  });

  it('nie myli województw zawierających się w sobie (cały slug, nie podciąg)', () => {
    expect(regionOfRow({ adminWoj: 'zachodniopomorskie' })?.slug).toBe('zachodniopomorskie');
    expect(regionOfRow({ adminWoj: 'kujawsko-pomorskie' })?.slug).toBe('kujawsko-pomorskie');
    expect(regionOfRow({ adminWoj: 'wielkopolskie' })?.slug).toBe('wielkopolskie');
  });

  it('bez kolumny ULDK sięga po ostatni token locationFull (też wielkie litery i „województwo")', () => {
    expect(regionOfRow({ adminWoj: null, locationFull: 'Kielce, kielecki, Świętokrzyskie' })?.slug).toBe(
      'swietokrzyskie'
    );
    expect(regionOfRow({ locationFull: 'Suwałki, PODLASKIE' })?.slug).toBe('podlaskie');
    expect(regionOfRow({ locationFull: 'Opole, województwo opolskie' })?.slug).toBe('opolskie');
  });

  it('zwraca null, gdy nie da się ustalić województwa', () => {
    expect(regionOfRow({ adminWoj: null, locationFull: 'Dąbrowica, koniński' })).toBeNull();
    expect(regionOfRow({})).toBeNull();
  });
});
