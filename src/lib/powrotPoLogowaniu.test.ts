import { describe, expect, it } from 'vitest';
import { powrotPoLogowaniu } from './powrotPoLogowaniu';

const ORIGIN = 'https://tylkodzialki.pl';

describe('powrotPoLogowaniu', () => {
  it('przepuszcza ścieżki serwisu razem z query i kotwicą', () => {
    for (const sciezka of [
      '/panel/pakiety',
      '/panel/pakiety/sukces?session_id=cs_test_1',
      '/sprzedaj?autopublish=1',
      '/ulubione#lista',
    ]) {
      expect(powrotPoLogowaniu(sciezka, ORIGIN)).toBe(sciezka);
    }
  });

  it('pełny adres naszej domeny zamienia na ścieżkę (tak odsyła next-auth po błędzie Google)', () => {
    expect(powrotPoLogowaniu('https://tylkodzialki.pl/panel/ogloszenia/abc/edytuj', ORIGIN)).toBe(
      '/panel/ogloszenia/abc/edytuj'
    );
  });

  it('brak wartości albo sama strona główna prowadzi do panelu', () => {
    for (const raw of [null, undefined, '', '   ', '/', 'https://tylkodzialki.pl/']) {
      expect(powrotPoLogowaniu(raw, ORIGIN), String(raw)).toBe('/panel');
    }
  });

  it('odrzuca javascript:, data: i obce domeny, także w przebraniu', () => {
    for (const raw of [
      'javascript:alert(document.domain)',
      ' JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://example.com/',
      'https://tylkodzialki.pl.example.com/panel',
      'http://tylkodzialki.pl/panel', // inny protokół to inny origin
      '//example.com',
      '/\\example.com',
      '\\\\example.com',
      '/\t/example.com', // parser URL wycina tabulator i zostaje //example.com
      '/.//example.com',
    ]) {
      expect(powrotPoLogowaniu(raw, ORIGIN), raw).toBe('/panel');
    }
  });
});
