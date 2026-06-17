import { Przeznaczenie } from '@prisma/client';

export type SeoCity = {
  slug: string;
  name: string;
  // Współrzędne miasta — statyczna konfiguracja (zero geokodowania w runtime, zero ruszania bazy).
  // Służą do liczenia ofert w promieniu (na @@index([lat,lng])) i do wycentrowania listy.
  // Wystarczy dokładność do kilku km, bo liczymy w promieniu ~40 km.
  lat: number;
  lng: number;
};

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
      { slug: 'wroclaw', name: 'Wrocław', lat: 51.108, lng: 17.033 },
      { slug: 'walbrzych', name: 'Wałbrzych', lat: 50.771, lng: 16.285 },
      { slug: 'legnica', name: 'Legnica', lat: 51.207, lng: 16.155 },
      { slug: 'jelenia-gora', name: 'Jelenia Góra', lat: 50.903, lng: 15.734 },
      { slug: 'lubin', name: 'Lubin', lat: 51.401, lng: 16.201 },
      { slug: 'glogow', name: 'Głogów', lat: 51.664, lng: 16.084 },
    ],
  },
  {
    slug: 'kujawsko-pomorskie',
    name: 'Kujawsko-pomorskie',
    cities: [
      { slug: 'bydgoszcz', name: 'Bydgoszcz', lat: 53.123, lng: 18.008 },
      { slug: 'torun', name: 'Toruń', lat: 53.013, lng: 18.598 },
      { slug: 'wloclawek', name: 'Włocławek', lat: 52.648, lng: 19.068 },
      { slug: 'grudziadz', name: 'Grudziądz', lat: 53.484, lng: 18.754 },
      { slug: 'inowroclaw', name: 'Inowrocław', lat: 52.799, lng: 18.261 },
      { slug: 'brodnica', name: 'Brodnica', lat: 53.258, lng: 19.398 },
    ],
  },
  {
    slug: 'lubelskie',
    name: 'Lubelskie',
    cities: [
      { slug: 'lublin', name: 'Lublin', lat: 51.246, lng: 22.568 },
      { slug: 'chelm', name: 'Chełm', lat: 51.143, lng: 23.471 },
      { slug: 'zamosc', name: 'Zamość', lat: 50.717, lng: 23.252 },
      { slug: 'biala-podlaska', name: 'Biała Podlaska', lat: 52.033, lng: 23.117 },
      { slug: 'pulawy', name: 'Puławy', lat: 51.416, lng: 21.969 },
      { slug: 'swidnik', name: 'Świdnik', lat: 51.219, lng: 22.696 },
    ],
  },
  {
    slug: 'lubuskie',
    name: 'Lubuskie',
    cities: [
      { slug: 'zielona-gora', name: 'Zielona Góra', lat: 51.935, lng: 15.506 },
      { slug: 'gorzow-wielkopolski', name: 'Gorzów Wielkopolski', lat: 52.731, lng: 15.241 },
      { slug: 'nowa-sol', name: 'Nowa Sól', lat: 51.803, lng: 15.717 },
      { slug: 'zary', name: 'Żary', lat: 51.640, lng: 15.138 },
      { slug: 'zagan', name: 'Żagań', lat: 51.617, lng: 15.314 },
      { slug: 'swiebodzin', name: 'Świebodzin', lat: 52.247, lng: 15.534 },
    ],
  },
  {
    slug: 'lodzkie',
    name: 'Łódzkie',
    cities: [
      { slug: 'lodz', name: 'Łódź', lat: 51.759, lng: 19.456 },
      { slug: 'piotrkow-trybunalski', name: 'Piotrków Trybunalski', lat: 51.405, lng: 19.703 },
      { slug: 'pabianice', name: 'Pabianice', lat: 51.665, lng: 19.355 },
      { slug: 'tomaszow-mazowiecki', name: 'Tomaszów Mazowiecki', lat: 51.530, lng: 20.008 },
      { slug: 'belchatow', name: 'Bełchatów', lat: 51.368, lng: 19.357 },
      { slug: 'zgierz', name: 'Zgierz', lat: 51.855, lng: 19.404 },
    ],
  },
  {
    slug: 'malopolskie',
    name: 'Małopolskie',
    cities: [
      { slug: 'krakow', name: 'Kraków', lat: 50.064, lng: 19.945 },
      { slug: 'tarnow', name: 'Tarnów', lat: 50.013, lng: 20.986 },
      { slug: 'nowy-sacz', name: 'Nowy Sącz', lat: 49.621, lng: 20.697 },
      { slug: 'oswiecim', name: 'Oświęcim', lat: 50.038, lng: 19.221 },
      { slug: 'chrzanow', name: 'Chrzanów', lat: 50.135, lng: 19.401 },
      { slug: 'olkusz', name: 'Olkusz', lat: 50.282, lng: 19.565 },
    ],
  },
  {
    slug: 'mazowieckie',
    name: 'Mazowieckie',
    cities: [
      { slug: 'warszawa', name: 'Warszawa', lat: 52.231, lng: 21.006 },
      { slug: 'radom', name: 'Radom', lat: 51.402, lng: 21.147 },
      { slug: 'plock', name: 'Płock', lat: 52.546, lng: 19.706 },
      { slug: 'siedlce', name: 'Siedlce', lat: 52.168, lng: 22.290 },
      { slug: 'pruszkow', name: 'Pruszków', lat: 52.171, lng: 20.812 },
      { slug: 'ostroleka', name: 'Ostrołęka', lat: 53.086, lng: 21.578 },
    ],
  },
  {
    slug: 'opolskie',
    name: 'Opolskie',
    cities: [
      { slug: 'opole', name: 'Opole', lat: 50.675, lng: 17.921 },
      { slug: 'kedzierzyn-kozle', name: 'Kędzierzyn-Koźle', lat: 50.349, lng: 18.226 },
      { slug: 'nysa', name: 'Nysa', lat: 50.474, lng: 17.333 },
      { slug: 'brzeg', name: 'Brzeg', lat: 50.860, lng: 17.467 },
      { slug: 'kluczbork', name: 'Kluczbork', lat: 50.973, lng: 18.218 },
      { slug: 'prudnik', name: 'Prudnik', lat: 50.321, lng: 17.580 },
    ],
  },
  {
    slug: 'podkarpackie',
    name: 'Podkarpackie',
    cities: [
      { slug: 'rzeszow', name: 'Rzeszów', lat: 50.041, lng: 21.999 },
      { slug: 'przemysl', name: 'Przemyśl', lat: 49.785, lng: 22.768 },
      { slug: 'stalowa-wola', name: 'Stalowa Wola', lat: 50.583, lng: 22.053 },
      { slug: 'mielec', name: 'Mielec', lat: 50.287, lng: 21.424 },
      { slug: 'tarnobrzeg', name: 'Tarnobrzeg', lat: 50.573, lng: 21.679 },
      { slug: 'debica', name: 'Dębica', lat: 50.051, lng: 21.411 },
    ],
  },
  {
    slug: 'podlaskie',
    name: 'Podlaskie',
    cities: [
      { slug: 'bialystok', name: 'Białystok', lat: 53.132, lng: 23.169 },
      { slug: 'suwalki', name: 'Suwałki', lat: 54.111, lng: 22.931 },
      { slug: 'lomza', name: 'Łomża', lat: 53.179, lng: 22.059 },
      { slug: 'augustow', name: 'Augustów', lat: 53.844, lng: 22.980 },
      { slug: 'bielsk-podlaski', name: 'Bielsk Podlaski', lat: 52.768, lng: 23.187 },
      { slug: 'hajnowka', name: 'Hajnówka', lat: 52.741, lng: 23.581 },
    ],
  },
  {
    slug: 'pomorskie',
    name: 'Pomorskie',
    cities: [
      { slug: 'gdansk', name: 'Gdańsk', lat: 54.352, lng: 18.646 },
      { slug: 'gdynia', name: 'Gdynia', lat: 54.519, lng: 18.530 },
      { slug: 'slupsk', name: 'Słupsk', lat: 54.464, lng: 17.029 },
      { slug: 'tczew', name: 'Tczew', lat: 54.092, lng: 18.778 },
      { slug: 'starogard-gdanski', name: 'Starogard Gdański', lat: 53.962, lng: 18.529 },
      { slug: 'wejherowo', name: 'Wejherowo', lat: 54.605, lng: 18.236 },
    ],
  },
  {
    slug: 'slaskie',
    name: 'Śląskie',
    cities: [
      { slug: 'katowice', name: 'Katowice', lat: 50.259, lng: 19.020 },
      { slug: 'czestochowa', name: 'Częstochowa', lat: 50.811, lng: 19.121 },
      { slug: 'sosnowiec', name: 'Sosnowiec', lat: 50.286, lng: 19.104 },
      { slug: 'gliwice', name: 'Gliwice', lat: 50.297, lng: 18.677 },
      { slug: 'zabrze', name: 'Zabrze', lat: 50.325, lng: 18.785 },
      { slug: 'tychy', name: 'Tychy', lat: 50.124, lng: 18.988 },
    ],
  },
  {
    slug: 'swietokrzyskie',
    name: 'Świętokrzyskie',
    cities: [
      { slug: 'kielce', name: 'Kielce', lat: 50.866, lng: 20.629 },
      { slug: 'ostrowiec-swietokrzyski', name: 'Ostrowiec Świętokrzyski', lat: 50.929, lng: 21.385 },
      { slug: 'starachowice', name: 'Starachowice', lat: 51.038, lng: 21.073 },
      { slug: 'skarzysko-kamienna', name: 'Skarżysko-Kamienna', lat: 51.115, lng: 20.881 },
      { slug: 'sandomierz', name: 'Sandomierz', lat: 50.682, lng: 21.749 },
      { slug: 'konskie', name: 'Końskie', lat: 51.193, lng: 20.408 },
    ],
  },
  {
    slug: 'warminsko-mazurskie',
    name: 'Warmińsko-mazurskie',
    cities: [
      { slug: 'olsztyn', name: 'Olsztyn', lat: 53.778, lng: 20.480 },
      { slug: 'elblag', name: 'Elbląg', lat: 54.156, lng: 19.404 },
      { slug: 'elk', name: 'Ełk', lat: 53.828, lng: 22.364 },
      { slug: 'ostroda', name: 'Ostróda', lat: 53.696, lng: 19.965 },
      { slug: 'ilawa', name: 'Iława', lat: 53.596, lng: 19.566 },
      { slug: 'gizycko', name: 'Giżycko', lat: 54.038, lng: 21.767 },
    ],
  },
  {
    slug: 'wielkopolskie',
    name: 'Wielkopolskie',
    cities: [
      { slug: 'poznan', name: 'Poznań', lat: 52.406, lng: 16.925 },
      { slug: 'kalisz', name: 'Kalisz', lat: 51.757, lng: 18.090 },
      { slug: 'konin', name: 'Konin', lat: 52.223, lng: 18.251 },
      { slug: 'pila', name: 'Piła', lat: 53.151, lng: 16.738 },
      { slug: 'ostrow-wielkopolski', name: 'Ostrów Wielkopolski', lat: 51.655, lng: 17.806 },
      { slug: 'gniezno', name: 'Gniezno', lat: 52.535, lng: 17.582 },
    ],
  },
  {
    slug: 'zachodniopomorskie',
    name: 'Zachodniopomorskie',
    cities: [
      { slug: 'szczecin', name: 'Szczecin', lat: 53.428, lng: 14.553 },
      { slug: 'koszalin', name: 'Koszalin', lat: 54.194, lng: 16.172 },
      { slug: 'stargard', name: 'Stargard', lat: 53.336, lng: 15.050 },
      { slug: 'kolobrzeg', name: 'Kołobrzeg', lat: 54.176, lng: 15.576 },
      { slug: 'swinoujscie', name: 'Świnoujście', lat: 53.910, lng: 14.247 },
      { slug: 'walcz', name: 'Wałcz', lat: 53.272, lng: 16.471 },
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
