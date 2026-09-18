// Render sekcji planu w raporcie działki pod ofertą. Bez bazy i sieci: karmimy komponent zapisanym
// raportem i sprawdzamy, CO mówi kupującemu. Raport wisi pod ogłoszeniem biura i trafia do Google,
// więc „brak planu" tam, gdzie plan jest, to błąd widoczny na tysiącach stron ([[project-testy]]).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MpzpInfo } from '@/lib/mpzp';
import type { PogInfo } from '@/lib/pog';
import type { RaportOfertyDane } from '@/lib/raportOferty';
import RaportOferty from './RaportOferty';

const parcel = {
  id: '121804_2.0005.1660',
  parcelNumber: '1660',
  region: 'Skawinki',
  commune: 'Lanckorona',
  county: 'powiat wadowicki',
  voivodeship: 'małopolskie',
  areaM2: 1200,
  center: { lat: 49.81686, lng: 19.71121 },
  rings: [],
} as unknown as RaportOfertyDane['parcel'];

const planGison: MpzpInfo = {
  planName: 'obrębu Skawinki na terenie gminy Lanckorona',
  functionName: null,
  functionSymbol: null,
  maxHeight: null,
  intensity: null,
  effectiveFrom: null,
  resolution: 'Nr XXXI/148/2026 z 25 marca 2026',
  status: null,
  resolutionUrl: 'https://rastry.gison.pl/mpzp-public/lanckorona/uchwaly/U_2026_148_XXXI.pdf',
};

const planOgolny: PogInfo = {
  strefa: {
    symbol: 'SJ',
    nazwa: 'strefa wielofunkcyjna z zabudową mieszkaniową jednorodzinną',
    oznaczenie: '3SJ',
    mieszkaniowa: true,
    obowiazujeOd: '2026-01-01',
    maksWysokoscZabudowy: null,
    maksUdzialPowierzchniZabudowy: null,
    minUdzialPowierzchniBiologicznieCzynnej: null,
    maksNadziemnaIntensywnoscZabudowy: null,
  },
  ouz: false,
  srodmiejska: false,
};

const render = (dane: Partial<RaportOfertyDane>) =>
  renderToStaticMarkup(
    createElement(RaportOferty, {
      dane: { wersja: 1, parcel, mpzp: null, pog: null, ...dane },
      zrodlo: 'PINEZKA',
      sprawdzono: '2026-09-15T12:00:00.000Z',
      rcn: null,
      wycena: null,
      trend: null,
    })
  );

describe('raport pod ofertą: plan miejscowy', () => {
  it('plan bez szczegółów to plan, a nie „brak planu" ani pusta tabelka', () => {
    const html = render({
      mpzp: { ...planGison, planName: null, resolution: null, resolutionUrl: null, detailsUnavailable: true },
      pog: planOgolny,
    });
    expect(html).toContain('Działkę obejmuje plan miejscowy, ale serwer planów gminy nie podał jego szczegółów.');
    expect(html).toContain('Sprawdzimy ponownie');
    expect(html).not.toContain('nie ma planu miejscowego dla tej działki');
    expect(html).toContain('O zabudowie rozstrzyga jednak plan miejscowy.');
  });

  it('gdy gmina szczegółów w ogóle nie wystawia, nie obiecuje ponownego sprawdzenia', () => {
    const html = render({ mpzp: { ...planGison, planName: null, resolution: null, resolutionUrl: null } });
    expect(html).toContain('nie podał jego szczegółów');
    expect(html).not.toContain('Sprawdzimy ponownie');
  });

  it('plan GISON: nazwa, uchwała, link do PDF i uczciwa uwaga o braku przeznaczenia', () => {
    const html = render({ mpzp: planGison });
    expect(html).toContain('obrębu Skawinki na terenie gminy Lanckorona');
    expect(html).toContain('Nr XXXI/148/2026 z 25 marca 2026');
    expect(html).toContain('href="https://rastry.gison.pl/mpzp-public/lanckorona/uchwaly/U_2026_148_XXXI.pdf"');
    expect(html).toContain('Przeznaczenia terenu gmina nie przesyła');
  });

  it('plan z przeznaczeniem nie dokleja uwagi o jego braku ani linku bez adresu', () => {
    const html = render({
      mpzp: { ...planGison, functionName: 'Tereny lasów', functionSymbol: 'ZL15', resolutionUrl: null },
    });
    expect(html).toContain('Tereny lasów (ZL15)');
    expect(html).not.toContain('Przeznaczenia terenu gmina nie przesyła');
    expect(html).not.toContain('Tekst uchwały (PDF)');
  });

  it('serwer gminy nieczytelny: „nie wiemy", a nie brak planu', () => {
    const html = render({ niedostepne: ['mpzp'] });
    expect(html).toContain('nie odpowiedział albo nie podał czytelnych danych');
    expect(html).not.toContain('nie ma planu miejscowego dla tej działki');
  });

  it('prawdziwy brak planu nadal prowadzi do warunków zabudowy', () => {
    const html = render({});
    expect(html).toContain('Krajowa integracja planów nie ma planu miejscowego dla tej działki.');
  });
});
