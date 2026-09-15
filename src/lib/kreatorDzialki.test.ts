import { describe, expect, it } from 'vitest';
import type { CenaDecision } from './raportCena';
import type { RcnOkolica } from './rcnStats';
import {
  kwotaOrientacyjna,
  ladnaNazwa,
  lokalizacjaPelna,
  nazwaMiejscowosci,
  opisDzialkiEwidencyjnej,
  podpowiedzCeny,
  porownanieCeny,
  przeznaczeniaZPlanu,
  punktWDzialce,
  punktWewnatrzDzialki,
  tytulAutomatyczny,
  zapisanaDzialka,
  type DaneDzialki,
  type PodpowiedzCeny,
} from './kreatorDzialki';

const plan = (functionSymbol: string | null, functionName: string | null = null) => ({
  functionSymbol,
  functionName,
});

// Działka w kształcie litery L: ramię pionowe lng 0..1, ramię poziome lat 0..1.
const litL = [
  [
    { lat: 0, lng: 0 },
    { lat: 10, lng: 0 },
    { lat: 10, lng: 1 },
    { lat: 1, lng: 1 },
    { lat: 1, lng: 10 },
    { lat: 0, lng: 10 },
    { lat: 0, lng: 0 },
  ],
];

describe('przeznaczeniaZPlanu', () => {
  it('czyta symbol terenu z numerem i prefiksem obszaru', () => {
    expect(przeznaczeniaZPlanu(plan('4MN'))).toEqual(['BUDOWLANA']);
    expect(przeznaczeniaZPlanu(plan('A.1.MN'))).toEqual(['BUDOWLANA']);
    expect(przeznaczeniaZPlanu(plan('12RM'))).toEqual(['SIEDLISKOWA']);
    expect(przeznaczeniaZPlanu(plan('R'))).toEqual(['ROLNA']);
    expect(przeznaczeniaZPlanu(plan('3ZL'))).toEqual(['LESNA']);
  });

  it('teren o dwóch funkcjach daje dwie kategorie', () => {
    expect(przeznaczeniaZPlanu(plan('MN/U'))).toEqual(['BUDOWLANA', 'INWESTYCYJNA']);
    expect(przeznaczeniaZPlanu(plan('1MN-U'))).toEqual(['BUDOWLANA', 'INWESTYCYJNA']);
  });

  it('bez symbolu czyta opis terenu', () => {
    expect(
      przeznaczeniaZPlanu(plan(null, 'Tereny zabudowy mieszkaniowej jednorodzinnej'))
    ).toEqual(['BUDOWLANA']);
  });

  it('drogi, zieleń i usługi publiczne nie mają kategorii ogłoszenia', () => {
    expect(przeznaczeniaZPlanu(plan('KDD', 'tereny dróg publicznych'))).toEqual([]);
    expect(przeznaczeniaZPlanu(plan('ZP', 'tereny zieleni urządzonej'))).toEqual([]);
    expect(przeznaczeniaZPlanu(plan('UO', 'tereny usług oświaty'))).toEqual([]);
    expect(przeznaczeniaZPlanu(null)).toEqual([]);
  });
});

describe('nazwy z ewidencji', () => {
  it('ewidencyjne wersaliki zamienia na zwykłą pisownię', () => {
    expect(ladnaNazwa('DĄBROWA DUŻA')).toBe('Dąbrowa Duża');
    expect(ladnaNazwa('BIELSKO-BIAŁA')).toBe('Bielsko-Biała');
    expect(ladnaNazwa('0008')).toBe('0008');
  });

  it('na wsi miejscowością jest obręb', () => {
    expect(
      nazwaMiejscowosci({ id: '100102_2.0006.100', region: 'DOMIECHOWICE', commune: 'Wielgomłyny' })
    ).toBe('Domiechowice');
  });

  it('w mieście i przy numerycznym obrębie miejscowością jest gmina', () => {
    expect(nazwaMiejscowosci({ id: '100401_1.0008.123', region: '0008', commune: 'Bełchatów' })).toBe(
      'Bełchatów'
    );
    // Obręb ma nazwę części miasta, ale kupujący szuka miasta.
    expect(
      nazwaMiejscowosci({ id: '100407_4.0001.55', region: 'Śródmieście', commune: 'Zelów (miasto)' })
    ).toBe('Zelów');
    expect(
      nazwaMiejscowosci({ id: '100410_2.0003.7', region: '0003', commune: 'Kleszczów (gmina wiejska)' })
    ).toBe('Kleszczów');
  });

  it('pełna lokalizacja kończy się samym województwem', () => {
    const pelna = lokalizacjaPelna({
      id: '100102_2.0006.100',
      region: 'DOMIECHOWICE',
      commune: 'Wielgomłyny',
      county: 'radomszczański',
      voivodeship: 'łódzkie',
    });
    expect(pelna).toBe('Domiechowice, gmina Wielgomłyny, powiat radomszczański, łódzkie');
    expect(pelna.split(',').pop()?.trim()).toBe('łódzkie');
  });

  it('opis działki do wyszukiwarki', () => {
    expect(opisDzialkiEwidencyjnej({ region: 'DOMIECHOWICE', parcelNumber: '100/2' })).toBe(
      'obręb Domiechowice, działka 100/2'
    );
    expect(opisDzialkiEwidencyjnej({ region: '0008', parcelNumber: '5' })).toBe('obręb 0008, działka 5');
    expect(opisDzialkiEwidencyjnej({ region: '', parcelNumber: '5' })).toBe('działka 5');
  });
});

describe('pinezka a działka', () => {
  it('rozpoznaje, czy punkt stoi w działce w kształcie litery L', () => {
    expect(punktWDzialce({ lat: 5, lng: 0.5 }, litL)).toBe(true);
    expect(punktWDzialce({ lat: 0.5, lng: 5 }, litL)).toBe(true);
    // Róg „wewnątrz" litery L to już sąsiad.
    expect(punktWDzialce({ lat: 5, lng: 5 }, litL)).toBe(false);
  });

  it('działka w kształcie litery L: punkt ląduje w działce, nie u sąsiada', () => {
    const p = punktWewnatrzDzialki(litL);
    expect(p).not.toBeNull();
    // Średnia wierzchołków (ok. 3,14; 3,14) leży poza L. Punkt ma być w pionowym ramieniu.
    expect(p!.lng).toBeCloseTo(0.5);
    expect(p!.lat).toBeGreaterThan(1);
    expect(punktWDzialce(p!, litL)).toBe(true);
  });

  it('prostokąt zostaje przy środku', () => {
    const p = punktWewnatrzDzialki([
      [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 2 },
        { lat: 2, lng: 2 },
        { lat: 2, lng: 0 },
        { lat: 0, lng: 0 },
      ],
    ]);
    expect(p!.lat).toBeGreaterThan(0);
    expect(p!.lat).toBeLessThan(2);
    expect(p!.lng).toBeGreaterThan(0);
    expect(p!.lng).toBeLessThan(2);
  });

  it('bez geometrii nie zgaduje', () => {
    expect(punktWewnatrzDzialki([])).toBeNull();
  });
});

describe('tytulAutomatyczny', () => {
  it('bierze najważniejszą kategorię, powierzchnię i miejscowość', () => {
    expect(
      tytulAutomatyczny({ przeznaczenia: ['ROLNA', 'BUDOWLANA'], powierzchniaM2: 1200, miejscowosc: 'Domiechowice' })
    ).toBe('Działka budowlana 1 200 m², Domiechowice');
  });

  it('duże działki w hektarach', () => {
    expect(tytulAutomatyczny({ przeznaczenia: ['ROLNA'], powierzchniaM2: 23500, miejscowosc: 'Kaszewice' })).toBe(
      'Działka rolna 2,35 ha, Kaszewice'
    );
    expect(tytulAutomatyczny({ przeznaczenia: ['LESNA'], powierzchniaM2: 20000, miejscowosc: '' })).toBe(
      'Działka leśna 2 ha'
    );
  });

  it('bez danych zostaje samo słowo i nie przekracza limitu', () => {
    expect(tytulAutomatyczny({ przeznaczenia: [], powierzchniaM2: 0, miejscowosc: '' })).toBe('Działka');
    const dlugi = tytulAutomatyczny({ przeznaczenia: ['BUDOWLANA'], powierzchniaM2: 900, miejscowosc: 'X'.repeat(200) });
    expect(dlugi.length).toBeLessThanOrEqual(90);
  });
});

describe('podpowiedź ceny', () => {
  const decyzja: CenaDecision = {
    lead: {
      label: 'działki podobnej wielkości',
      stat: { pricePerM2: { low: 100, median: 150, high: 220 }, sampleCount: 9 },
      kind: 'similar',
    },
    value: { low: 100, median: 150, high: 220 },
    mixed: false,
  };
  const rcn: RcnOkolica = {
    klasa: 'budowlana',
    medianaZlM2: 130,
    low: 110,
    high: 160,
    liczba: 12,
    promienKm: 5,
    odRoku: 2024,
    doRoku: 2026,
  };

  it('łączy ogłoszenia i akty notarialne', () => {
    const p = podpowiedzCeny(decyzja, 3, rcn);
    expect(p?.ogloszenia).toMatchObject({
      mediana: 150,
      liczba: 9,
      promienKm: 3,
      widelki: false,
      podobnaWielkosc: true,
    });
    expect(p?.transakcje).toMatchObject({ mediana: 130, liczba: 12, rolne: false });
  });

  it('akty z innych miejscowości pomija', () => {
    expect(podpowiedzCeny(decyzja, 3, { ...rcn, promienKm: 40 })?.transakcje).toBeNull();
  });

  it('bez danych milczy', () => {
    expect(podpowiedzCeny({ lead: null, value: null, mixed: false }, 10, null)).toBeNull();
  });

  it('porównuje cenę sprzedającego z medianą działek podobnej wielkości', () => {
    const p = podpowiedzCeny(decyzja, 3, rcn) as PodpowiedzCeny;
    expect(porownanieCeny(153, p)).toEqual({ procent: 2 });
    expect(porownanieCeny(195, p)).toEqual({ procent: 30 });
    expect(porownanieCeny(120, p)).toEqual({ procent: -20 });
    expect(porownanieCeny(0, p)).toBeNull();
  });

  it('bez działek podobnej wielkości albo przy samych widełkach nie porównuje', () => {
    // Realny przypadek: hektar w Domiechowicach, w okolicy tylko działki budowlane różnej wielkości.
    // Mediana tej puli razy powierzchnia hektara dałaby kwotę do obalenia.
    const rozneWielkosci: CenaDecision = { ...decyzja, lead: { ...decyzja.lead!, kind: 'type' } };
    const p = podpowiedzCeny(rozneWielkosci, 6, rcn) as PodpowiedzCeny;
    expect(p.ogloszenia?.podobnaWielkosc).toBe(false);
    expect(porownanieCeny(107, p)).toBeNull();
    const widelki = podpowiedzCeny({ ...decyzja, mixed: true }, 3, rcn) as PodpowiedzCeny;
    expect(porownanieCeny(143, widelki)).toBeNull();
  });

  it('kwota za całą działkę zaokrąglona po ludzku', () => {
    expect(kwotaOrientacyjna(150, 1234)).toBe(185000);
    expect(kwotaOrientacyjna(30, 500)).toBe(15000);
    expect(kwotaOrientacyjna(33.33, 1000)).toBe(33300);
  });
});

describe('zapisanaDzialka', () => {
  it('składa działkę z ewidencji, planu i podpowiedzi ceny', () => {
    const dane: DaneDzialki = {
      parcel: {
        id: '100102_2.0006.100',
        parcelNumber: '100',
        voivodeship: 'łódzkie',
        county: 'bełchatowski',
        commune: 'Bełchatów',
        region: 'Domiechowice',
        areaM2: 10122,
        dims: null,
        rings: litL,
        center: { lat: 3, lng: 3 },
      },
      valuation: { radiusKm: 6 } as unknown as DaneDzialki['valuation'],
      mpzp: {
        planName: null,
        functionName: 'tereny lasów',
        functionSymbol: 'ZL',
        maxHeight: null,
        intensity: null,
        effectiveFrom: null,
        resolution: null,
        status: null,
      },
      rcn: null,
    };
    const z = zapisanaDzialka(dane, { lead: null, value: null, mixed: false });
    expect(z).toMatchObject({
      id: '100102_2.0006.100',
      areaM2: 10122,
      plan: { symbol: 'ZL', nazwa: 'tereny lasów' },
      przeznaczeniaZPlanu: ['LESNA'],
      podpowiedz: null,
    });
  });
});
