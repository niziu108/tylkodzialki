// Geometria obrysu działki na kadrze mapy w PDF. Bez sieci: sam przelicznik współrzędnych.
// Powód osobnego testu: błąd tutaj nie wywala niczego, tylko rysuje zielony wielokąt obok
// działki, a na wydruku wygląda wiarygodnie ([[project-testy]]).
import { describe, expect, it } from 'vitest';
import { obrysSvgPath } from './raportPdf';
import type { ParcelReport } from './uldk';

// Kwadrat ~100 m wokół punktu, w WGS84.
function dzialka(lat: number, lng: number): ParcelReport {
  const d = 0.0005;
  return {
    rings: [
      [
        { lat: lat - d, lng: lng - d },
        { lat: lat - d, lng: lng + d },
        { lat: lat + d, lng: lng + d },
        { lat: lat + d, lng: lng - d },
      ],
    ],
  } as unknown as ParcelReport;
}

const R = 20037508.34;
const x3857 = (lng: number) => (lng * R) / 180;
const y3857 = (lat: number) => (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);

function kadr(lat: number, lng: number, polSzer: number) {
  const cx = x3857(lng);
  const cy = y3857(lat);
  return { minX: cx - polSzer, maxX: cx + polSzer, minY: cy - polSzer / 2, maxY: cy + polSzer / 2 };
}

describe('obrys działki na kadrze', () => {
  it('zamyka każdy pierścień i zachowuje liczbę wierzchołków', () => {
    const d = obrysSvgPath(dzialka(52, 21), kadr(52, 21, 200));
    expect(d.startsWith('M ')).toBe(true);
    expect(d.trim().endsWith('Z')).toBe(true);
    expect((d.match(/,/g) ?? []).length).toBe(4);
  });

  it('działka na wschód od środka kadru rysuje się bardziej w prawo', () => {
    const box = kadr(52, 21, 400);
    const srodek = obrysSvgPath(dzialka(52, 21), box);
    const wschod = obrysSvgPath(dzialka(52, 21.002), box);
    const pierwszyX = (s: string) => Number(s.replace('M ', '').split(',')[0]);
    expect(pierwszyX(wschod)).toBeGreaterThan(pierwszyX(srodek));
  });

  it('działka na północ rysuje się wyżej, czyli z mniejszym Y (układ SVG)', () => {
    const box = kadr(52, 21, 400);
    const srodek = obrysSvgPath(dzialka(52, 21), box);
    const polnoc = obrysSvgPath(dzialka(52.002, 21), box);
    const pierwszyY = (s: string) => Number(s.replace('M ', '').split(' ')[0].split(',')[1]);
    expect(pierwszyY(polnoc)).toBeLessThan(pierwszyY(srodek));
  });

  it('pomija zdegenerowane pierścienie (mniej niż trzy punkty)', () => {
    const parcel = { rings: [[{ lat: 52, lng: 21 }, { lat: 52.001, lng: 21 }]] } as unknown as ParcelReport;
    expect(obrysSvgPath(parcel, kadr(52, 21, 200))).toBe('');
  });
});
