import { Przeznaczenie } from '@prisma/client';

export type SeoCity = {
  slug: string;
  name: string;
  // Odmiana do naturalnej polszczyzny w generowanej treści SEO (P21):
  //   gen = dopełniacz (np. „w okolicy Wrocławia", „od Wrocławia")
  //   loc = miejscownik (np. „we Wrocławiu") — bez przyimka, ten dobiera wPrep()
  gen: string;
  loc: string;
  // Współrzędne miasta — statyczna konfiguracja (zero geokodowania w runtime, zero ruszania bazy).
  // Służą do liczenia ofert w promieniu (na @@index([lat,lng])) i do wycentrowania listy.
  // Wystarczy dokładność do kilku km, bo liczymy w promieniu ~40 km.
  lat: number;
  lng: number;
};

// Przyimek „w"/„we" przed miejscownikiem (eufonia: „we" przed W/F + spółgłoska,
// np. „we Wrocławiu", „we Włocławku"; w pozostałych „w Łodzi", „w Gdańsku").
export function wPrep(loc: string): 'w' | 'we' {
  return /^[wf][bcćdfghjklłmnńprsśtwzźż]/i.test(loc) ? 'we' : 'w';
}

// „we/w <miejscownik>" gotowe do wstawienia w zdanie.
export function inCity(city: SeoCity): string {
  return `${wPrep(city.loc)} ${city.loc}`;
}

export type SeoRegion = {
  // slug = klucz województwa w src/lib/dzialkiSearch.ts (ta sama definicja bboxa co wyszukiwarka).
  slug: string;
  name: string;
  cities: SeoCity[];
};

// Typy działek (przeznaczenie) jako warstwa SEO. Każdy typ to osobna fraza zakupowa.
export type SeoType = {
  slug: string;
  enum: Przeznaczenie;
  // przymiotnik w l. mn. do nagłówka „Działki <adj> <miasto>"
  adj: string;
  // krótki, konkretny opis typu (bez długich myślników — preferencja właściciela)
  desc: string;
};

export const SEO_TYPES: SeoType[] = [
  {
    slug: 'budowlane',
    enum: 'BUDOWLANA',
    adj: 'budowlane',
    desc: 'pod budowę domu, zwykle z dostępem do drogi i mediów.',
  },
  {
    slug: 'rolne',
    enum: 'ROLNA',
    adj: 'rolne',
    desc: 'grunty orne i łąki, pod uprawę lub jako lokata w ziemię.',
  },
  {
    slug: 'rekreacyjne',
    enum: 'REKREACYJNA',
    adj: 'rekreacyjne',
    desc: 'pod domek letniskowy i wypoczynek poza miastem.',
  },
  {
    slug: 'inwestycyjne',
    enum: 'INWESTYCYJNA',
    adj: 'inwestycyjne',
    desc: 'pod zabudowę i dłuższe ulokowanie kapitału.',
  },
  {
    slug: 'lesne',
    enum: 'LESNA',
    adj: 'leśne',
    desc: 'tereny zalesione, blisko natury, na wypoczynek.',
  },
  {
    slug: 'siedliskowe',
    enum: 'SIEDLISKOWA',
    adj: 'siedliskowe',
    desc: 'pod siedlisko i zabudowę zagrodową na terenach rolnych.',
  },
];

export const SEO_TYPE_SLUGS = SEO_TYPES.map((t) => t.slug);

export function getSeoType(slug: string) {
  return SEO_TYPES.find((t) => t.slug === slug);
}

export const SEO_REGIONS: SeoRegion[] = [
  {
    slug: 'dolnoslaskie',
    name: 'Dolnośląskie',
    cities: [
      { slug: 'wroclaw', name: 'Wrocław', gen: 'Wrocławia', loc: 'Wrocławiu', lat: 51.108, lng: 17.033 },
      { slug: 'walbrzych', name: 'Wałbrzych', gen: 'Wałbrzycha', loc: 'Wałbrzychu', lat: 50.771, lng: 16.285 },
      { slug: 'legnica', name: 'Legnica', gen: 'Legnicy', loc: 'Legnicy', lat: 51.207, lng: 16.155 },
      { slug: 'jelenia-gora', name: 'Jelenia Góra', gen: 'Jeleniej Góry', loc: 'Jeleniej Górze', lat: 50.903, lng: 15.734 },
      { slug: 'lubin', name: 'Lubin', gen: 'Lubina', loc: 'Lubinie', lat: 51.401, lng: 16.201 },
      { slug: 'glogow', name: 'Głogów', gen: 'Głogowa', loc: 'Głogowie', lat: 51.664, lng: 16.084 },
    ],
  },
  {
    slug: 'kujawsko-pomorskie',
    name: 'Kujawsko-pomorskie',
    cities: [
      { slug: 'bydgoszcz', name: 'Bydgoszcz', gen: 'Bydgoszczy', loc: 'Bydgoszczy', lat: 53.123, lng: 18.008 },
      { slug: 'torun', name: 'Toruń', gen: 'Torunia', loc: 'Toruniu', lat: 53.013, lng: 18.598 },
      { slug: 'wloclawek', name: 'Włocławek', gen: 'Włocławka', loc: 'Włocławku', lat: 52.648, lng: 19.068 },
      { slug: 'grudziadz', name: 'Grudziądz', gen: 'Grudziądza', loc: 'Grudziądzu', lat: 53.484, lng: 18.754 },
      { slug: 'inowroclaw', name: 'Inowrocław', gen: 'Inowrocławia', loc: 'Inowrocławiu', lat: 52.799, lng: 18.261 },
      { slug: 'brodnica', name: 'Brodnica', gen: 'Brodnicy', loc: 'Brodnicy', lat: 53.258, lng: 19.398 },
    ],
  },
  {
    slug: 'lubelskie',
    name: 'Lubelskie',
    cities: [
      { slug: 'lublin', name: 'Lublin', gen: 'Lublina', loc: 'Lublinie', lat: 51.246, lng: 22.568 },
      { slug: 'chelm', name: 'Chełm', gen: 'Chełma', loc: 'Chełmie', lat: 51.143, lng: 23.471 },
      { slug: 'zamosc', name: 'Zamość', gen: 'Zamościa', loc: 'Zamościu', lat: 50.717, lng: 23.252 },
      { slug: 'biala-podlaska', name: 'Biała Podlaska', gen: 'Białej Podlaskiej', loc: 'Białej Podlaskiej', lat: 52.033, lng: 23.117 },
      { slug: 'pulawy', name: 'Puławy', gen: 'Puław', loc: 'Puławach', lat: 51.416, lng: 21.969 },
      { slug: 'swidnik', name: 'Świdnik', gen: 'Świdnika', loc: 'Świdniku', lat: 51.219, lng: 22.696 },
    ],
  },
  {
    slug: 'lubuskie',
    name: 'Lubuskie',
    cities: [
      { slug: 'zielona-gora', name: 'Zielona Góra', gen: 'Zielonej Góry', loc: 'Zielonej Górze', lat: 51.935, lng: 15.506 },
      { slug: 'gorzow-wielkopolski', name: 'Gorzów Wielkopolski', gen: 'Gorzowa Wielkopolskiego', loc: 'Gorzowie Wielkopolskim', lat: 52.731, lng: 15.241 },
      { slug: 'nowa-sol', name: 'Nowa Sól', gen: 'Nowej Soli', loc: 'Nowej Soli', lat: 51.803, lng: 15.717 },
      { slug: 'zary', name: 'Żary', gen: 'Żar', loc: 'Żarach', lat: 51.640, lng: 15.138 },
      { slug: 'zagan', name: 'Żagań', gen: 'Żagania', loc: 'Żaganiu', lat: 51.617, lng: 15.314 },
      { slug: 'swiebodzin', name: 'Świebodzin', gen: 'Świebodzina', loc: 'Świebodzinie', lat: 52.247, lng: 15.534 },
    ],
  },
  {
    slug: 'lodzkie',
    name: 'Łódzkie',
    cities: [
      { slug: 'lodz', name: 'Łódź', gen: 'Łodzi', loc: 'Łodzi', lat: 51.759, lng: 19.456 },
      { slug: 'piotrkow-trybunalski', name: 'Piotrków Trybunalski', gen: 'Piotrkowa Trybunalskiego', loc: 'Piotrkowie Trybunalskim', lat: 51.405, lng: 19.703 },
      { slug: 'pabianice', name: 'Pabianice', gen: 'Pabianic', loc: 'Pabianicach', lat: 51.665, lng: 19.355 },
      { slug: 'tomaszow-mazowiecki', name: 'Tomaszów Mazowiecki', gen: 'Tomaszowa Mazowieckiego', loc: 'Tomaszowie Mazowieckim', lat: 51.530, lng: 20.008 },
      { slug: 'belchatow', name: 'Bełchatów', gen: 'Bełchatowa', loc: 'Bełchatowie', lat: 51.368, lng: 19.357 },
      { slug: 'zgierz', name: 'Zgierz', gen: 'Zgierza', loc: 'Zgierzu', lat: 51.855, lng: 19.404 },
    ],
  },
  {
    slug: 'malopolskie',
    name: 'Małopolskie',
    cities: [
      { slug: 'krakow', name: 'Kraków', gen: 'Krakowa', loc: 'Krakowie', lat: 50.064, lng: 19.945 },
      { slug: 'tarnow', name: 'Tarnów', gen: 'Tarnowa', loc: 'Tarnowie', lat: 50.013, lng: 20.986 },
      { slug: 'nowy-sacz', name: 'Nowy Sącz', gen: 'Nowego Sącza', loc: 'Nowym Sączu', lat: 49.621, lng: 20.697 },
      { slug: 'oswiecim', name: 'Oświęcim', gen: 'Oświęcimia', loc: 'Oświęcimiu', lat: 50.038, lng: 19.221 },
      { slug: 'chrzanow', name: 'Chrzanów', gen: 'Chrzanowa', loc: 'Chrzanowie', lat: 50.135, lng: 19.401 },
      { slug: 'olkusz', name: 'Olkusz', gen: 'Olkusza', loc: 'Olkuszu', lat: 50.282, lng: 19.565 },
    ],
  },
  {
    slug: 'mazowieckie',
    name: 'Mazowieckie',
    cities: [
      { slug: 'warszawa', name: 'Warszawa', gen: 'Warszawy', loc: 'Warszawie', lat: 52.231, lng: 21.006 },
      { slug: 'radom', name: 'Radom', gen: 'Radomia', loc: 'Radomiu', lat: 51.402, lng: 21.147 },
      { slug: 'plock', name: 'Płock', gen: 'Płocka', loc: 'Płocku', lat: 52.546, lng: 19.706 },
      { slug: 'siedlce', name: 'Siedlce', gen: 'Siedlec', loc: 'Siedlcach', lat: 52.168, lng: 22.290 },
      { slug: 'pruszkow', name: 'Pruszków', gen: 'Pruszkowa', loc: 'Pruszkowie', lat: 52.171, lng: 20.812 },
      { slug: 'ostroleka', name: 'Ostrołęka', gen: 'Ostrołęki', loc: 'Ostrołęce', lat: 53.086, lng: 21.578 },
    ],
  },
  {
    slug: 'opolskie',
    name: 'Opolskie',
    cities: [
      { slug: 'opole', name: 'Opole', gen: 'Opola', loc: 'Opolu', lat: 50.675, lng: 17.921 },
      { slug: 'kedzierzyn-kozle', name: 'Kędzierzyn-Koźle', gen: 'Kędzierzyna-Koźla', loc: 'Kędzierzynie-Koźlu', lat: 50.349, lng: 18.226 },
      { slug: 'nysa', name: 'Nysa', gen: 'Nysy', loc: 'Nysie', lat: 50.474, lng: 17.333 },
      { slug: 'brzeg', name: 'Brzeg', gen: 'Brzegu', loc: 'Brzegu', lat: 50.860, lng: 17.467 },
      { slug: 'kluczbork', name: 'Kluczbork', gen: 'Kluczborka', loc: 'Kluczborku', lat: 50.973, lng: 18.218 },
      { slug: 'prudnik', name: 'Prudnik', gen: 'Prudnika', loc: 'Prudniku', lat: 50.321, lng: 17.580 },
    ],
  },
  {
    slug: 'podkarpackie',
    name: 'Podkarpackie',
    cities: [
      { slug: 'rzeszow', name: 'Rzeszów', gen: 'Rzeszowa', loc: 'Rzeszowie', lat: 50.041, lng: 21.999 },
      { slug: 'przemysl', name: 'Przemyśl', gen: 'Przemyśla', loc: 'Przemyślu', lat: 49.785, lng: 22.768 },
      { slug: 'stalowa-wola', name: 'Stalowa Wola', gen: 'Stalowej Woli', loc: 'Stalowej Woli', lat: 50.583, lng: 22.053 },
      { slug: 'mielec', name: 'Mielec', gen: 'Mielca', loc: 'Mielcu', lat: 50.287, lng: 21.424 },
      { slug: 'tarnobrzeg', name: 'Tarnobrzeg', gen: 'Tarnobrzega', loc: 'Tarnobrzegu', lat: 50.573, lng: 21.679 },
      { slug: 'debica', name: 'Dębica', gen: 'Dębicy', loc: 'Dębicy', lat: 50.051, lng: 21.411 },
    ],
  },
  {
    slug: 'podlaskie',
    name: 'Podlaskie',
    cities: [
      { slug: 'bialystok', name: 'Białystok', gen: 'Białegostoku', loc: 'Białymstoku', lat: 53.132, lng: 23.169 },
      { slug: 'suwalki', name: 'Suwałki', gen: 'Suwałk', loc: 'Suwałkach', lat: 54.111, lng: 22.931 },
      { slug: 'lomza', name: 'Łomża', gen: 'Łomży', loc: 'Łomży', lat: 53.179, lng: 22.059 },
      { slug: 'augustow', name: 'Augustów', gen: 'Augustowa', loc: 'Augustowie', lat: 53.844, lng: 22.980 },
      { slug: 'bielsk-podlaski', name: 'Bielsk Podlaski', gen: 'Bielska Podlaskiego', loc: 'Bielsku Podlaskim', lat: 52.768, lng: 23.187 },
      { slug: 'hajnowka', name: 'Hajnówka', gen: 'Hajnówki', loc: 'Hajnówce', lat: 52.741, lng: 23.581 },
    ],
  },
  {
    slug: 'pomorskie',
    name: 'Pomorskie',
    cities: [
      { slug: 'gdansk', name: 'Gdańsk', gen: 'Gdańska', loc: 'Gdańsku', lat: 54.352, lng: 18.646 },
      { slug: 'gdynia', name: 'Gdynia', gen: 'Gdyni', loc: 'Gdyni', lat: 54.519, lng: 18.530 },
      { slug: 'slupsk', name: 'Słupsk', gen: 'Słupska', loc: 'Słupsku', lat: 54.464, lng: 17.029 },
      { slug: 'tczew', name: 'Tczew', gen: 'Tczewa', loc: 'Tczewie', lat: 54.092, lng: 18.778 },
      { slug: 'starogard-gdanski', name: 'Starogard Gdański', gen: 'Starogardu Gdańskiego', loc: 'Starogardzie Gdańskim', lat: 53.962, lng: 18.529 },
      { slug: 'wejherowo', name: 'Wejherowo', gen: 'Wejherowa', loc: 'Wejherowie', lat: 54.605, lng: 18.236 },
    ],
  },
  {
    slug: 'slaskie',
    name: 'Śląskie',
    cities: [
      { slug: 'katowice', name: 'Katowice', gen: 'Katowic', loc: 'Katowicach', lat: 50.259, lng: 19.020 },
      { slug: 'czestochowa', name: 'Częstochowa', gen: 'Częstochowy', loc: 'Częstochowie', lat: 50.811, lng: 19.121 },
      { slug: 'sosnowiec', name: 'Sosnowiec', gen: 'Sosnowca', loc: 'Sosnowcu', lat: 50.286, lng: 19.104 },
      { slug: 'gliwice', name: 'Gliwice', gen: 'Gliwic', loc: 'Gliwicach', lat: 50.297, lng: 18.677 },
      { slug: 'zabrze', name: 'Zabrze', gen: 'Zabrza', loc: 'Zabrzu', lat: 50.325, lng: 18.785 },
      { slug: 'tychy', name: 'Tychy', gen: 'Tychów', loc: 'Tychach', lat: 50.124, lng: 18.988 },
    ],
  },
  {
    slug: 'swietokrzyskie',
    name: 'Świętokrzyskie',
    cities: [
      { slug: 'kielce', name: 'Kielce', gen: 'Kielc', loc: 'Kielcach', lat: 50.866, lng: 20.629 },
      { slug: 'ostrowiec-swietokrzyski', name: 'Ostrowiec Świętokrzyski', gen: 'Ostrowca Świętokrzyskiego', loc: 'Ostrowcu Świętokrzyskim', lat: 50.929, lng: 21.385 },
      { slug: 'starachowice', name: 'Starachowice', gen: 'Starachowic', loc: 'Starachowicach', lat: 51.038, lng: 21.073 },
      { slug: 'skarzysko-kamienna', name: 'Skarżysko-Kamienna', gen: 'Skarżyska-Kamiennej', loc: 'Skarżysku-Kamiennej', lat: 51.115, lng: 20.881 },
      { slug: 'sandomierz', name: 'Sandomierz', gen: 'Sandomierza', loc: 'Sandomierzu', lat: 50.682, lng: 21.749 },
      { slug: 'konskie', name: 'Końskie', gen: 'Końskich', loc: 'Końskich', lat: 51.193, lng: 20.408 },
    ],
  },
  {
    slug: 'warminsko-mazurskie',
    name: 'Warmińsko-mazurskie',
    cities: [
      { slug: 'olsztyn', name: 'Olsztyn', gen: 'Olsztyna', loc: 'Olsztynie', lat: 53.778, lng: 20.480 },
      { slug: 'elblag', name: 'Elbląg', gen: 'Elbląga', loc: 'Elblągu', lat: 54.156, lng: 19.404 },
      { slug: 'elk', name: 'Ełk', gen: 'Ełku', loc: 'Ełku', lat: 53.828, lng: 22.364 },
      { slug: 'ostroda', name: 'Ostróda', gen: 'Ostródy', loc: 'Ostródzie', lat: 53.696, lng: 19.965 },
      { slug: 'ilawa', name: 'Iława', gen: 'Iławy', loc: 'Iławie', lat: 53.596, lng: 19.566 },
      { slug: 'gizycko', name: 'Giżycko', gen: 'Giżycka', loc: 'Giżycku', lat: 54.038, lng: 21.767 },
    ],
  },
  {
    slug: 'wielkopolskie',
    name: 'Wielkopolskie',
    cities: [
      { slug: 'poznan', name: 'Poznań', gen: 'Poznania', loc: 'Poznaniu', lat: 52.406, lng: 16.925 },
      { slug: 'kalisz', name: 'Kalisz', gen: 'Kalisza', loc: 'Kaliszu', lat: 51.757, lng: 18.090 },
      { slug: 'konin', name: 'Konin', gen: 'Konina', loc: 'Koninie', lat: 52.223, lng: 18.251 },
      { slug: 'pila', name: 'Piła', gen: 'Piły', loc: 'Pile', lat: 53.151, lng: 16.738 },
      { slug: 'ostrow-wielkopolski', name: 'Ostrów Wielkopolski', gen: 'Ostrowa Wielkopolskiego', loc: 'Ostrowie Wielkopolskim', lat: 51.655, lng: 17.806 },
      { slug: 'gniezno', name: 'Gniezno', gen: 'Gniezna', loc: 'Gnieźnie', lat: 52.535, lng: 17.582 },
    ],
  },
  {
    slug: 'zachodniopomorskie',
    name: 'Zachodniopomorskie',
    cities: [
      { slug: 'szczecin', name: 'Szczecin', gen: 'Szczecina', loc: 'Szczecinie', lat: 53.428, lng: 14.553 },
      { slug: 'koszalin', name: 'Koszalin', gen: 'Koszalina', loc: 'Koszalinie', lat: 54.194, lng: 16.172 },
      { slug: 'stargard', name: 'Stargard', gen: 'Stargardu', loc: 'Stargardzie', lat: 53.336, lng: 15.050 },
      { slug: 'kolobrzeg', name: 'Kołobrzeg', gen: 'Kołobrzegu', loc: 'Kołobrzegu', lat: 54.176, lng: 15.576 },
      { slug: 'swinoujscie', name: 'Świnoujście', gen: 'Świnoujścia', loc: 'Świnoujściu', lat: 53.910, lng: 14.247 },
      { slug: 'walcz', name: 'Wałcz', gen: 'Wałcza', loc: 'Wałczu', lat: 53.272, lng: 16.471 },
    ],
  },
];

export const SEO_CITIES: SeoCity[] = SEO_REGIONS.flatMap((region) => region.cities);

export function getSeoCity(slug: string) {
  return SEO_CITIES.find((city) => city.slug === slug);
}

export function getSeoRegion(slug: string) {
  return SEO_REGIONS.find((region) => region.slug === slug);
}

// Województwo, do którego należy miasto (do breadcrumbów i linkowania w górę huba).
export function getRegionForCity(citySlug: string) {
  return SEO_REGIONS.find((region) => region.cities.some((c) => c.slug === citySlug));
}
