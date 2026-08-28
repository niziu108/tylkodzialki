// Render sekcji ceny w raporcie „Sprawdź działkę". Bez bazy i sieci: karmimy komponent gotową
// wyceną i sprawdzamy, CO mówi użytkownikowi. Powód: to jedyne miejsce, gdzie liczby zamieniają
// się w zdanie, a pomyłka tutaj (widełki zamiast mediany, „bez uzbrojenia" znaczące „nie wiemy")
// nie wywala buildu, tylko cicho kłamie w produkcie ([[project-testy]]).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PointValuation } from '@/lib/seoHub';
import Raport, { type RaportData } from './Raport';

const pusty = { pricePerM2: null, sampleCount: 0 };

function wycena(over: Partial<PointValuation> = {}): PointValuation {
  return {
    pricePerM2: { low: 40, median: 90, high: 260 },
    sampleCount: 20,
    budowlana: { pricePerM2: { low: 40, median: 90, high: 260 }, sampleCount: 20 },
    budowlanaUzbrojona: pusty,
    budowlanaNieuzbrojona: pusty,
    rolna: pusty,
    similarSize: pusty,
    similarSizeBand: null,
    offersNearby: 26,
    mediaShares: null,
    radiusKm: 6,
    ...over,
  };
}

function dane(v: PointValuation): RaportData {
  return {
    parcel: {
      id: '100102_2.0001.234/5',
      parcelNumber: '234/5',
      region: '0001',
      commune: 'Bełchatów',
      county: 'powiat bełchatowski',
      voivodeship: 'łódzkie',
      areaM2: 979,
      center: { lat: 51.3676, lng: 19.356 },
      rings: [],
    } as unknown as RaportData['parcel'],
    valuation: v,
    mpzp: null,
  };
}

const render = (v: PointValuation) => renderToStaticMarkup(createElement(Raport, { data: dane(v) }));

describe('sekcja ceny', () => {
  it('przy próbce zawężonej do podobnych działek prowadzi MEDIANĄ, nie widełkami', () => {
    const html = render(
      wycena({
        similarSize: { pricePerM2: { low: 794, median: 1144, high: 2617 }, sampleCount: 9 },
        similarSizeBand: { minM2: 540, maxM2: 1530 },
      })
    );
    expect(html).toContain('1144');
    expect(html).toContain('działki podobnej wielkości');
    // Widełki nadal podajemy, ale w zdaniu obok, nie jako nagłówek.
    expect(html).not.toContain('794–2617');
    expect(html).toContain('794');
  });

  it('bez podobnych działek zostaje dotychczasowe zachowanie z widełkami', () => {
    const html = render(wycena());
    expect(html).toContain('40–260');
    expect(html).toContain('rozjeżdżają się za mocno');
  });

  it('zamiast tabeli premii pokazuje zastrzeżenie o zmienności ceny', () => {
    const html = render(
      wycena({
        similarSize: { pricePerM2: { low: 91, median: 107, high: 123 }, sampleCount: 7 },
        similarSizeBand: { minM2: 587, maxM2: 1664 },
      })
    );
    expect(html).toContain('zupełnie inaczej');
    expect(html).not.toContain('Co podnosi cenę działki');
  });

  it('nie pokazuje rubryki „bez uzbrojenia" wziętej z ofert bez danych', () => {
    const html = render(wycena());
    expect(html).not.toContain('Budowlane bez uzbrojenia');
  });
});
