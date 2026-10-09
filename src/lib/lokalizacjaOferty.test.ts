// Przypadki z bazy (09.10.2026): etykiety z feedów CRM i oś administracyjna z geokodowania.

import { describe, it, expect } from 'vitest';
import { ladnaLokalizacja, pelnaLokalizacja } from './lokalizacjaOferty';
import { formatOpis } from './formatOpis';

describe('ladnaLokalizacja', () => {
  it('zamienia wersaliki z feedu na zwykłą pisownię', () => {
    expect(ladnaLokalizacja('NOWA WIEŚ')).toBe('Nowa Wieś');
    expect(ladnaLokalizacja('BROGI')).toBe('Brogi');
    expect(ladnaLokalizacja('BIELSKO-BIAŁA')).toBe('Bielsko-Biała');
  });

  it('nie rusza nazw wpisanych normalnie', () => {
    expect(ladnaLokalizacja('Człuchów')).toBe('Człuchów');
    expect(ladnaLokalizacja('Kalnik, Kępa Kalnicka')).toBe('Kalnik, Kępa Kalnicka');
  });

  it('usuwa powtórzenie tej samej nazwy', () => {
    expect(ladnaLokalizacja('KOSTOMŁOTY PIERWSZE, Kostomłoty Pierwsze')).toBe('Kostomłoty Pierwsze');
  });
});

describe('pelnaLokalizacja', () => {
  it('składa miejscowość, gminę, powiat i województwo', () => {
    expect(
      pelnaLokalizacja({ label: 'NOWA WIEŚ', gmina: 'Pasłęk', powiat: 'powiat elbląski', woj: 'warmińsko-mazurskie' })
    ).toBe('Nowa Wieś, gm. Pasłęk, pow. elbląski, woj. warmińsko-mazurskie');
  });

  it('pomija gminę równą miejscowości (z dopiskiem „miasto" też)', () => {
    expect(
      pelnaLokalizacja({ label: 'Człuchów', gmina: 'Człuchów (miasto)', powiat: 'powiat człuchowski', woj: 'pomorskie' })
    ).toBe('Człuchów, pow. człuchowski, woj. pomorskie');
    expect(
      pelnaLokalizacja({ label: 'WIERZBICA', gmina: 'WIERZBICA', powiat: 'powiat radomski', woj: 'mazowieckie' })
    ).toBe('Wierzbica, pow. radomski, woj. mazowieckie');
  });

  it('pomija powiat miasta na prawach powiatu', () => {
    expect(pelnaLokalizacja({ label: 'Kraków', gmina: 'Kraków', powiat: 'powiat Kraków', woj: 'małopolskie' })).toBe(
      'Kraków, woj. małopolskie'
    );
  });

  it('bez osi administracyjnej zostaje sama miejscowość', () => {
    expect(pelnaLokalizacja({ label: 'BROGI' })).toBe('Brogi');
  });
});

describe('formatOpis: punkty pisane ręcznie', () => {
  it('rozkleja myślnik doklejony do kropki i robi z punktów listę', () => {
    const html = formatOpis(
      'Ma ograniczenia, które są atutem.- Wyznaczona strefa budowlana.\n- Ogromna przestrzeń.\n- Zakaz podziału.'
    );
    expect(html).toBe(
      '<p>Ma ograniczenia, które są atutem.</p><ul><li>Wyznaczona strefa budowlana.</li><li>Ogromna przestrzeń.</li><li>Zakaz podziału.</li></ul>'
    );
  });

  it('nie rusza myślnika w zdaniu', () => {
    expect(formatOpis('Trasa S7 (Gdańsk - Warszawa) obok.')).toBe('<p>Trasa S7 (Gdańsk - Warszawa) obok.</p>');
  });

  it('pojedyncza linia z myślnikiem zostaje tekstem', () => {
    expect(formatOpis('Cena do negocjacji\n- dzwoń śmiało')).toBe('<p>Cena do negocjacji<br />- dzwoń śmiało</p>');
  });

  it('tekst po liście wraca do akapitu', () => {
    expect(formatOpis('Atuty:\n- cisza\n- las\nZapraszam')).toBe(
      '<p>Atuty:</p><ul><li>cisza</li><li>las</li></ul><p>Zapraszam</p>'
    );
  });
});
