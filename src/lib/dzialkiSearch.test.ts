import { describe, it, expect } from 'vitest';
import { VOIVODESHIPS, detectVoivodeship, detectCity } from './dzialkiSearch';

describe('detectVoivodeship', () => {
  it('rozpoznaje każde z 16 województw po własnej nazwie', () => {
    for (const woj of VOIVODESHIPS) {
      expect(detectVoivodeship(woj.label)?.label, woj.label).toBe(woj.label);
    }
  });

  it('rozpoznaje województwo wewnątrz dłuższego zapytania', () => {
    for (const woj of VOIVODESHIPS) {
      expect(detectVoivodeship(`działki ${woj.label}`)?.label, woj.label).toBe(woj.label);
      expect(detectVoivodeship(`${woj.label} działka budowlana`)?.label, woj.label).toBe(woj.label);
    }
  });

  /* REGRESJA (błąd żył na produkcji): nazwy województw zawierają się w sobie —
   * „wielk-OPOLSK-ie" zawiera alias opolskiego, „zachodni-OPOMORSK-ie" i
   * „kujawsko-POMORSK-ie" zawierają alias pomorskiego. Dopasowanie po pierwszym
   * trafieniu w kolejności tablicy oddawało zapytanie o Wielkopolskę Opolszczyźnie.
   * Dopasowanie MUSI iść od najdłuższego aliasu. */
  it('nie myli nazw zawierających się w sobie', () => {
    expect(detectVoivodeship('wielkopolskie')?.label).toBe('wielkopolskie');
    expect(detectVoivodeship('opolskie')?.label).toBe('opolskie');
    expect(detectVoivodeship('małopolskie')?.label).toBe('małopolskie');
    expect(detectVoivodeship('zachodniopomorskie')?.label).toBe('zachodniopomorskie');
    expect(detectVoivodeship('pomorskie')?.label).toBe('pomorskie');
    expect(detectVoivodeship('kujawsko-pomorskie')?.label).toBe('kujawsko-pomorskie');
    expect(detectVoivodeship('dolnośląskie')?.label).toBe('dolnośląskie');
    expect(detectVoivodeship('śląskie')?.label).toBe('śląskie');
  });

  it('radzi sobie bez polskich znaków (tak wpisuje część użytkowników)', () => {
    expect(detectVoivodeship('wielkopolskie')?.label).toBe('wielkopolskie');
    expect(detectVoivodeship('malopolskie')?.label).toBe('małopolskie');
    expect(detectVoivodeship('slaskie')?.label).toBe('śląskie');
    expect(detectVoivodeship('lodzkie')?.label).toBe('łódzkie');
    expect(detectVoivodeship('swietokrzyskie')?.label).toBe('świętokrzyskie');
  });

  it('nie zgaduje przy braku nazwy województwa', () => {
    expect(detectVoivodeship('')).toBeNull();
    expect(detectVoivodeship('działka budowlana nad jeziorem')).toBeNull();
  });
});

describe('detectCity', () => {
  it('rozpoznaje miasta wieloczłonowe', () => {
    expect(detectCity('Gorzów Wielkopolski')?.label).toBe('Gorzów Wielkopolski');
    expect(detectCity('Zielona Góra')?.label).toBe('Zielona Góra');
    expect(detectCity('gorzow wielkopolski')?.label).toBe('Gorzów Wielkopolski');
  });

  it('rozpoznaje miasta jednoczłonowe', () => {
    expect(detectCity('Warszawa')?.label).toBe('Warszawa');
    expect(detectCity('Łódź')?.label).toBe('Łódź');
    expect(detectCity('lodz')?.label).toBe('Łódź');
  });

  it('nie zgaduje przy braku miasta', () => {
    expect(detectCity('')).toBeNull();
    expect(detectCity('działka rolna')).toBeNull();
  });
});
