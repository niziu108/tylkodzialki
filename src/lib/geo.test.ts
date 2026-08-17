import { describe, it, expect } from 'vitest';
import { isInPoland, coordsMatchLocationText, sanitizePlCoords } from './geo';

describe('isInPoland', () => {
  it('przepuszcza punkty w kraju, łącznie z krańcami', () => {
    const punkty: Array<[string, number, number]> = [
      ['Warszawa', 52.2297, 21.0122],
      ['Hel (najdalej na północ przy morzu)', 54.6081, 18.8009],
      ['Świnoujście (zachód)', 53.9099, 14.2475],
      ['Bieszczady (południowy wschód)', 49.0864, 22.6800],
      ['Hrubieszów (wschód)', 50.8049, 23.8917],
      ['Bełchatów', 51.3688, 19.3564],
    ];
    for (const [nazwa, lat, lng] of punkty) {
      expect(isInPoland(lat, lng), nazwa).toBe(true);
    }
  });

  // Sedno poprawki: pojedynczy prostokąt Polski obejmował te punkty, przez co
  // błędny wynik geokodera lądował na mapie jako pin poza granicami kraju.
  it('odrzuca zagranicę mieszczącą się w zgrubnym prostokącie kraju', () => {
    const punkty: Array<[string, number, number]> = [
      ['Królewiec / Kaliningrad', 54.7104, 20.4522],
      ['Brzeźno pod Królewcem (realny błędny pin)', 54.9792, 20.5042],
      ['Berlin', 52.5200, 13.4050],
      ['Lwów', 49.8397, 24.0297],
      ['Praga', 50.0755, 14.4378],
      ['Wilno', 54.6872, 25.2797],
    ];
    for (const [nazwa, lat, lng] of punkty) {
      expect(isInPoland(lat, lng), nazwa).toBe(false);
    }
  });

  /* ZNANE OGRANICZENIA, świadomie zostawione. Bramka to suma prostokątów, nie prawdziwy
   * obrys granicy, więc przygraniczne miasta sąsiadów wciąż przechodzą:
   *  • Grodno — prostokąt podlaskiego musi sięgać 23,95, żeby zmieścić okolice Białowieży;
   *  • Ostrawa — leży w czeskim wcięciu NA PÓŁNOC od Cieszyna, więc żaden prostokąt
   *    śląskiego jej nie ominie bez odcięcia Raciborza i Jastrzębia.
   * Zawężanie kosztowałoby realne polskie oferty, a zysk byłby żaden: geokoder dostaje
   * adres z dopiskiem „Polska" i region=pl, a feedy biur nie podają lokalizacji zza
   * granicy. Ten test istnieje po to, żeby nikt nie „naprawił" tego przypadkiem kosztem
   * Podlasia i Śląska — jeśli kiedyś ma być dokładniej, trzeba wziąć prawdziwy poligon
   * granicy, a nie dokręcać prostokąty. */
  it('nie udaje, że prostokąty to prawdziwa granica', () => {
    expect(isInPoland(53.6884, 23.8258), 'Grodno wpada w prostokąt podlaskiego').toBe(true);
    expect(isInPoland(49.8209, 18.2625), 'Ostrawa wpada w prostokąt śląskiego').toBe(true);
    // Za to polskie miasta z tych samych okolic muszą przechodzić — to jest ta cena.
    expect(isInPoland(50.0915, 18.2192), 'Racibórz').toBe(true);
    expect(isInPoland(52.7000, 23.8500), 'Białowieża').toBe(true);
  });

  it('odrzuca śmieci w polu współrzędnych', () => {
    expect(isInPoland(0, 0)).toBe(false);
    expect(isInPoland(Number.NaN, 21)).toBe(false);
    // Wymiary działki wpisane jako geo (realny przypadek z feedu ASARI).
    expect(isInPoland(25, 60)).toBe(false);
  });
});

describe('coordsMatchLocationText', () => {
  it('przepuszcza, gdy punkt zgadza się z województwem z opisu', () => {
    expect(coordsMatchLocationText(52.2297, 21.0122, 'Warszawa, MAZOWIECKIE')).toBe(true);
    expect(coordsMatchLocationText(51.3688, 19.3564, 'Bełchatów, bełchatowski, Łódzkie')).toBe(true);
    expect(coordsMatchLocationText(54.3520, 18.6466, 'Gdańsk, pomorskie')).toBe(true);
  });

  // Miejscowości-imienniczki: to realne rekordy wyłapane audytem na produkcji.
  it('odrzuca punkt z zupełnie innego województwa niż deklarowane', () => {
    expect(coordsMatchLocationText(52.3342, 15.3010, 'kielecki, Świętokrzyskie'), 'Łagów lubuski podpisany jako świętokrzyski').toBe(false);
    expect(coordsMatchLocationText(53.4081, 14.4740, 'Zelów, bełchatowski, Łódzkie'), 'Ostoja pod Szczecinem podpisana jako Zelów').toBe(false);
    expect(coordsMatchLocationText(50.3344, 19.5644, 'Głogów (gw), głogowski, Dolnośląskie'), 'Klucze podpisane jako Głogów').toBe(false);
  });

  /* Nazwy województw zawierają się w sobie. Gdyby dopasowanie szło po pierwszym
   * trafieniu zamiast po najdłuższym, oferta z Wielkopolski byłaby sprawdzana
   * prostokątem Opolszczyzny i wypadała jako błędna. */
  it('nie myli nazw zawierających się w sobie', () => {
    expect(coordsMatchLocationText(52.4064, 16.9252, 'Poznań, WIELKOPOLSKIE'), 'Poznań vs alias opolskiego').toBe(true);
    expect(coordsMatchLocationText(53.4285, 14.5528, 'Szczecin, ZACHODNIOPOMORSKIE'), 'Szczecin vs alias pomorskiego').toBe(true);
    expect(coordsMatchLocationText(53.0138, 18.5984, 'Toruń, KUJAWSKO-POMORSKIE'), 'Toruń vs alias pomorskiego').toBe(true);
    expect(coordsMatchLocationText(50.6751, 17.9213, 'Opole, OPOLSKIE')).toBe(true);
  });

  it('nie blokuje, gdy w opisie nie ma województwa', () => {
    expect(coordsMatchLocationText(52.2297, 21.0122, '97-400 Bełchatów')).toBe(true);
    expect(coordsMatchLocationText(52.2297, 21.0122, '')).toBe(true);
    expect(coordsMatchLocationText(52.2297, 21.0122, null)).toBe(true);
  });

  it('daje zapas przy granicy województwa (prostokąty są zgrubne)', () => {
    // Punkt tuż za krawędzią prostokąta mazowieckiego, wciąż opisany jako mazowieckie.
    expect(coordsMatchLocationText(53.60, 21.00, 'mazowieckie')).toBe(true);
    // Ale już nie 200 km dalej.
    expect(coordsMatchLocationText(54.50, 18.50, 'mazowieckie')).toBe(false);
  });
});

describe('sanitizePlCoords', () => {
  it('bez trzeciego argumentu sprawdza tylko granice kraju', () => {
    expect(sanitizePlCoords(52.2297, 21.0122)).toEqual({ lat: 52.2297, lng: 21.0122 });
    expect(sanitizePlCoords(54.7104, 20.4522)).toBeNull();
    expect(sanitizePlCoords(null, 21)).toBeNull();
  });

  it('z opisem lokalizacji włącza kontrolę krzyżową', () => {
    expect(sanitizePlCoords(52.3342, 15.3010, 'kielecki, Świętokrzyskie')).toBeNull();
    expect(sanitizePlCoords(52.3342, 15.3010, 'świebodziński, Lubuskie')).toEqual({
      lat: 52.3342,
      lng: 15.3010,
    });
  });
});
