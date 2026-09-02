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

function dane(v: PointValuation, extra: Partial<RaportData> = {}): RaportData {
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
    ...extra,
  };
}

const render = (v: PointValuation, extra: Partial<RaportData> = {}) =>
  renderToStaticMarkup(createElement(Raport, { data: dane(v, extra) }));

const wycenaZeSrednia = () =>
  wycena({
    similarSize: { pricePerM2: { low: 91, median: 107, high: 123 }, sampleCount: 7 },
    similarSizeBand: { minM2: 587, maxM2: 1664 },
  });

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

  it('pokazuje trend cen, gdy historia jest wystarczająco długa', () => {
    const html = render(wycenaZeSrednia(), {
      trend: {
        changePct: 0.032,
        fromDate: '2026-03-01',
        days: 180,
        sampleCount: 24,
        medianThen: 100,
        medianNow: 103,
      },
    });
    expect(html).toContain('wzrosły o 3,2%');
    expect(html).toContain('01.03.2026');
    expect(html).toContain('24');
  });

  it('zmiana ponizej pol procenta to „stoja w miejscu”, nie falszywa precyzja', () => {
    const html = render(wycenaZeSrednia(), {
      trend: { changePct: 0.001, fromDate: '2026-03-01', days: 180, sampleCount: 12, medianThen: 100, medianNow: 100 },
    });
    expect(html).toContain('stoją w miejscu');
  });

  it('ceny transakcyjne z RCN pokazuje jako kwoty zaplacone i zestawia z ogloszeniami', () => {
    const html = render(wycenaZeSrednia(), {
      rcn: {
        klasa: 'budowlana',
        medianaZlM2: 80,
        low: 62,
        high: 110,
        liczba: 13,
        promienKm: 10,
        odRoku: 2024,
        doRoku: 2026,
      },
    });
    expect(html).toContain('Ile realnie płacono w okolicy');
    expect(html).toContain('80');
    expect(html).toContain('13');
    expect(html).toContain('u notariusza');
    // Oferty 107 zł/m² kontra 80 zł/m² zapłacone = 34% w górę; to jest sedno sekcji.
    expect(html).toContain('34%');
    expect(html).toContain('więcej');
  });

  it('gdy oferty trzymaja sie kwot z aktow, nie sugeruje negocjacji', () => {
    const html = render(wycenaZeSrednia(), {
      rcn: {
        klasa: 'budowlana',
        medianaZlM2: 105,
        low: 90,
        high: 120,
        liczba: 8,
        promienKm: 20,
        odRoku: 2025,
        doRoku: 2026,
      },
    });
    expect(html).toContain('trzymają się cen z aktów notarialnych');
    expect(html).not.toContain('mediana zapłaconych kwot');
  });

  it('bez wiarygodnej probki aktow raport w ogole nie wspomina o cenach transakcyjnych', () => {
    const html = render(wycenaZeSrednia());
    expect(html).not.toContain('Ile realnie płacono');
    expect(html).not.toContain('notariusza');
  });

  it('bez historii cen raport nie wspomina o trendzie', () => {
    const html = render(wycenaZeSrednia());
    expect(html).not.toContain('w tej okolicy wzrosły');
    expect(html).not.toContain('stoją w miejscu');
  });
});
