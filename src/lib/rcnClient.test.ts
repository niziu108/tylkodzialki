// Pokrycie kafla przy pobieraniu RCN: od tego zależy, czy zapytamy o każdą działkę osobno
// (sąsiednie działki na obrazku zlewają się w jedną plamę, patrz rcnClient).
import { describe, expect, it } from 'vitest';
import { pokryjObrys } from './rcnClient';

const kafel = { south: 0, west: 0, north: 1, east: 1 };

describe('pokryjObrys', () => {
  it('oznacza wnętrze działki z marginesem i nic poza nim', () => {
    const px = 100;
    const pokryte = new Uint8Array(px * px);
    // Kwadrat 0.2-0.4 szerokości i długości = piksele 20-40 (oś Y odwrócona: północ u góry).
    pokryjObrys(pokryte, [[0.2, 0.6], [0.4, 0.6], [0.4, 0.8], [0.2, 0.8], [0.2, 0.6]], kafel, px);
    const jest = (x: number, y: number) => pokryte[y * px + x] === 1;
    expect(jest(30, 30)).toBe(true); // środek
    expect(jest(20, 30)).toBe(true); // na granicy
    expect(jest(18, 30)).toBe(true); // w marginesie linii
    expect(jest(10, 30)).toBe(false); // sąsiednia działka zostaje do odpytania
    expect(jest(30, 50)).toBe(false);
  });

  it('dwie stykające się działki: druga zostaje niepokryta po pierwszej', () => {
    const px = 100;
    const pokryte = new Uint8Array(px * px);
    pokryjObrys(pokryte, [[0.2, 0.6], [0.4, 0.6], [0.4, 0.8], [0.2, 0.8]], kafel, px);
    // Środek sąsiedniej działki 0.4-0.6 (piksel 50,30) nadal czeka na własne zapytanie.
    expect(pokryte[30 * px + 50]).toBe(0);
  });
});
