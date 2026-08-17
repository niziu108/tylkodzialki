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

  /* REGRESJA (zmierzone na produkcji): polskie miasta noszą przymiotniki regionalne
   * albo przypadkiem zawierają cudzy rdzeń. Dopasowanie „gdziekolwiek się zawiera"
   * wrzucało wtedy całe województwo na szczyt wyników — szukający działki pod Kłodzkiem
   * dostawał Piotrków i Bełchatów przed tym, czego szukał. */
  it('nie bierze nazwy miasta za województwo', () => {
    const miasta: Array<[string, string]> = [
      ['Kłodzko', 'zawiera rdzeń łódzkiego: k-ŁODZK-o'],
      ['Bystrzyca Kłodzka', 'jw.'],
      ['Biała Podlaska', 'leży w lubelskim'],
      ['Sokołów Podlaski', 'leży w mazowieckim'],
      ['Radzyń Podlaski', 'leży w lubelskim'],
      ['Środa Śląska', 'leży w dolnośląskim'],
      ['Zagórze Śląskie', 'leży w dolnośląskim'],
      ['Oborniki Śląskie', 'leży w dolnośląskim'],
      ['Gorzów Wielkopolski', 'leży w lubuskim'],
      ['Głogów Małopolski', 'leży w podkarpackim'],
      ['Jabłonowo Pomorskie', 'leży w kujawsko-pomorskim'],
      ['Kamień Pomorski', 'leży w zachodniopomorskim'],
      ['Tomaszów Mazowiecki', 'leży w łódzkim'],
      ['Rawa Mazowiecka', 'leży w łódzkim'],
    ];
    for (const [miasto, powod] of miasta) {
      expect(detectVoivodeship(miasto), `${miasto} — ${powod}`).toBeNull();
    }
  });

  it('rozpoznaje województwo mimo dokleików typu „woj." czy „działki"', () => {
    expect(detectVoivodeship('woj. mazowieckie')?.label).toBe('mazowieckie');
    expect(detectVoivodeship('województwo śląskie')?.label).toBe('śląskie');
    expect(detectVoivodeship('działki mazowieckie')?.label).toBe('mazowieckie');
    expect(detectVoivodeship('działki budowlane wielkopolskie')?.label).toBe('wielkopolskie');
    expect(detectVoivodeship('lubelskie na sprzedaż')?.label).toBe('lubelskie');
  });

  it('rozpoznaje formy odmienione i potoczne', () => {
    expect(detectVoivodeship('mazurskie')?.label).toBe('warmińsko-mazurskie');
    expect(detectVoivodeship('kujawsko-pomorskie')?.label).toBe('kujawsko-pomorskie');
    expect(detectVoivodeship('warmińsko-mazurskie')?.label).toBe('warmińsko-mazurskie');
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
