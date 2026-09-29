// Podpowiedź ceny w kreatorze: zamiast absurdalnego procentu przy literówce prosimy o sprawdzenie
// ceny, a podpowiedź ze starej wersji roboczej się nie pokazuje (2026-09-28).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WERSJA_PODPOWIEDZI, type PodpowiedzCeny } from '@/lib/kreatorDzialki';
import PodpowiedzCenyBox from './PodpowiedzCeny';

const podpowiedz: PodpowiedzCeny = {
  wersja: WERSJA_PODPOWIEDZI,
  ogloszenia: {
    etykieta: 'działki podobnej wielkości',
    mediana: 66,
    low: 40,
    high: 95,
    widelki: false,
    podobnaWielkosc: true,
    liczba: 9,
    promienKm: 6,
  },
  transakcje: null,
};

const html = (p: PodpowiedzCeny, cenaPln: number, powierzchniaM2 = 1000) =>
  renderToStaticMarkup(createElement(PodpowiedzCenyBox, { podpowiedz: p, cenaPln, powierzchniaM2 }));

describe('PodpowiedzCeny', () => {
  it('cena kilka razy za wysoka: prośba o sprawdzenie zamiast procentu', () => {
    const out = html(podpowiedz, 1_927_000);
    expect(out).toContain('kilka razy więcej niż podobne działki');
    expect(out).toContain('literówki');
    expect(out).not.toMatch(/\d+%/);
  });

  it('cena kilka razy za niska: pyta, czy to cena za całą działkę', () => {
    expect(html(podpowiedz, 15_000)).toContain('czy to cena za całą działkę');
  });

  it('zwykła różnica: procent jak dotąd', () => {
    expect(html(podpowiedz, 80_000)).toContain('o 21% więcej niż podobne działki');
  });

  it('podpowiedź ze starej wersji roboczej się nie pokazuje', () => {
    expect(html({ ...podpowiedz, wersja: undefined }, 80_000)).toBe('');
  });
});
