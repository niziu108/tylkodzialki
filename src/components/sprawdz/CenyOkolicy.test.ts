// Sekcja „Ceny w okolicy" pod ofertą. Bez bazy i sieci: karmimy gotową wyceną i aktami
// i sprawdzamy, co trafia do HTML. Pilnujemy decyzji właściciela: zawsze promień, próbka i lata,
// poniżej progu cisza, i nigdy porównania z ceną oglądanej oferty ([[project-testy]]).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PointValuation } from '@/lib/seoHub';
import type { RcnOkolica } from '@/lib/rcnStats';
import { klasaZPrzeznaczen } from '@/lib/raportCena';
import { cenyOkolicy, CenyOkolicySekcja } from './CenyOkolicy';

const pusty = { pricePerM2: null, sampleCount: 0 };

function wycena(over: Partial<PointValuation> = {}): PointValuation {
  return {
    pricePerM2: { low: 60, median: 110, high: 170 },
    sampleCount: 14,
    budowlana: { pricePerM2: { low: 70, median: 120, high: 180 }, sampleCount: 12 },
    budowlanaUzbrojona: pusty,
    budowlanaNieuzbrojona: pusty,
    rolna: { pricePerM2: { low: 8, median: 14, high: 22 }, sampleCount: 5 },
    similarSize: pusty,
    similarSizeBand: null,
    offersNearby: 16,
    mediaShares: null,
    radiusKm: 6,
    ...over,
  };
}

const rcn: RcnOkolica = {
  klasa: 'budowlana',
  medianaZlM2: 95,
  low: 70,
  high: 130,
  liczba: 23,
  promienKm: 10,
  odRoku: 2022,
  doRoku: 2026,
};

function html(dane: NonNullable<ReturnType<typeof cenyOkolicy>>) {
  return renderToStaticMarkup(createElement(CenyOkolicySekcja, { dane, miejsce: 'Kleszczów', przyblizona: true }));
}

describe('klasaZPrzeznaczen', () => {
  it('rolna tylko bez zabudowy w przeznaczeniu', () => {
    expect(klasaZPrzeznaczen(['ROLNA'])).toBe('rolna');
    expect(klasaZPrzeznaczen(['LESNA'])).toBe('rolna');
    expect(klasaZPrzeznaczen(['ROLNA', 'BUDOWLANA'])).toBe('budowlana');
    expect(klasaZPrzeznaczen(['SIEDLISKOWA'])).toBe('budowlana');
    expect(klasaZPrzeznaczen([])).toBe('budowlana');
    expect(klasaZPrzeznaczen(null)).toBe('budowlana');
  });
});

describe('cenyOkolicy', () => {
  it('milczy, gdy ani ogłoszenia, ani akty nie dobijają progu', () => {
    const cienka = wycena({ pricePerM2: null, budowlana: pusty, rolna: pusty });
    expect(cenyOkolicy(cienka, null, null, false)).toBeNull();
    expect(cenyOkolicy(null, null, null, false)).toBeNull();
  });

  it('akty z największego koła (35 km) nie idą pod ofertę', () => {
    expect(cenyOkolicy(null, { ...rcn, promienKm: 35 }, null, false)).toBeNull();
  });

  it('pula rolna prowadzi rolnymi', () => {
    const dane = cenyOkolicy(wycena(), null, null, true)!;
    expect(dane.cena?.lead?.label).toBe('działki rolne');
  });

  it('HTML podaje promień, próbkę i lata, bez porównania z ceną oferty', () => {
    const out = html(cenyOkolicy(wycena(), rcn, null, false)!);
    expect(out).toContain('Ile kosztują działki w okolicy');
    expect(out).toContain('Kleszczów i okolice');
    expect(out).toContain('promieniu 6 km');
    expect(out).toContain('Liczone z 12 ofert');
    expect(out).toContain('Mediana z 23 transakcji');
    expect(out).toContain('promieniu 10 km');
    expect(out).toContain('lata 2022-2026');
    expect(out).toContain('liczymy od jej środka');
    expect(out).not.toMatch(/drożej|taniej|drożs|tańsz|zawyż/i);
  });
});
