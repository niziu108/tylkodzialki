export type SeoCity = {
  slug: string;
  name: string;
};

export type SeoRegion = {
  name: string;
  cities: SeoCity[];
};

export const SEO_REGIONS: SeoRegion[] = [
  {
    name: "Dolnośląskie",
    cities: [
      { slug: "wroclaw", name: "Wrocław" },
      { slug: "walbrzych", name: "Wałbrzych" },
      { slug: "legnica", name: "Legnica" },
      { slug: "jelenia-gora", name: "Jelenia Góra" },
      { slug: "lubin", name: "Lubin" },
      { slug: "glogow", name: "Głogów" },
    ],
  },
  {
    name: "Kujawsko-pomorskie",
    cities: [
      { slug: "bydgoszcz", name: "Bydgoszcz" },
      { slug: "torun", name: "Toruń" },
      { slug: "wloclawek", name: "Włocławek" },
      { slug: "grudziadz", name: "Grudziądz" },
      { slug: "inowroclaw", name: "Inowrocław" },
      { slug: "brodnica", name: "Brodnica" },
    ],
  },
  {
    name: "Lubelskie",
    cities: [
      { slug: "lublin", name: "Lublin" },
      { slug: "chelm", name: "Chełm" },
      { slug: "zamosc", name: "Zamość" },
      { slug: "biala-podlaska", name: "Biała Podlaska" },
      { slug: "pulawy", name: "Puławy" },
      { slug: "swidnik", name: "Świdnik" },
    ],
  },
  {
    name: "Lubuskie",
    cities: [
      { slug: "zielona-gora", name: "Zielona Góra" },
      { slug: "gorzow-wielkopolski", name: "Gorzów Wielkopolski" },
      { slug: "nowa-sol", name: "Nowa Sól" },
      { slug: "zary", name: "Żary" },
      { slug: "zagan", name: "Żagań" },
      { slug: "swiebodzin", name: "Świebodzin" },
    ],
  },
  {
    name: "Łódzkie",
    cities: [
      { slug: "lodz", name: "Łódź" },
      { slug: "piotrkow-trybunalski", name: "Piotrków Trybunalski" },
      { slug: "pabianice", name: "Pabianice" },
      { slug: "tomaszow-mazowiecki", name: "Tomaszów Mazowiecki" },
      { slug: "belchatow", name: "Bełchatów" },
      { slug: "zgierz", name: "Zgierz" },
    ],
  },
  {
    name: "Małopolskie",
    cities: [
      { slug: "krakow", name: "Kraków" },
      { slug: "tarnow", name: "Tarnów" },
      { slug: "nowy-sacz", name: "Nowy Sącz" },
      { slug: "oswiecim", name: "Oświęcim" },
      { slug: "chrzanow", name: "Chrzanów" },
      { slug: "olkusz", name: "Olkusz" },
    ],
  },
  {
    name: "Mazowieckie",
    cities: [
      { slug: "warszawa", name: "Warszawa" },
      { slug: "radom", name: "Radom" },
      { slug: "plock", name: "Płock" },
      { slug: "siedlce", name: "Siedlce" },
      { slug: "pruszkow", name: "Pruszków" },
      { slug: "ostroleka", name: "Ostrołęka" },
    ],
  },
  {
    name: "Opolskie",
    cities: [
      { slug: "opole", name: "Opole" },
      { slug: "kedzierzyn-kozle", name: "Kędzierzyn-Koźle" },
      { slug: "nysa", name: "Nysa" },
      { slug: "brzeg", name: "Brzeg" },
      { slug: "kluczbork", name: "Kluczbork" },
      { slug: "prudnik", name: "Prudnik" },
    ],
  },
  {
    name: "Podkarpackie",
    cities: [
      { slug: "rzeszow", name: "Rzeszów" },
      { slug: "przemysl", name: "Przemyśl" },
      { slug: "stalowa-wola", name: "Stalowa Wola" },
      { slug: "mielec", name: "Mielec" },
      { slug: "tarnobrzeg", name: "Tarnobrzeg" },
      { slug: "debica", name: "Dębica" },
    ],
  },
  {
    name: "Podlaskie",
    cities: [
      { slug: "bialystok", name: "Białystok" },
      { slug: "suwalki", name: "Suwałki" },
      { slug: "lomza", name: "Łomża" },
      { slug: "augustow", name: "Augustów" },
      { slug: "bielsk-podlaski", name: "Bielsk Podlaski" },
      { slug: "hajnowka", name: "Hajnówka" },
    ],
  },
  {
    name: "Pomorskie",
    cities: [
      { slug: "gdansk", name: "Gdańsk" },
      { slug: "gdynia", name: "Gdynia" },
      { slug: "slupsk", name: "Słupsk" },
      { slug: "tczew", name: "Tczew" },
      { slug: "starogard-gdanski", name: "Starogard Gdański" },
      { slug: "wejherowo", name: "Wejherowo" },
    ],
  },
  {
    name: "Śląskie",
    cities: [
      { slug: "katowice", name: "Katowice" },
      { slug: "czestochowa", name: "Częstochowa" },
      { slug: "sosnowiec", name: "Sosnowiec" },
      { slug: "gliwice", name: "Gliwice" },
      { slug: "zabrze", name: "Zabrze" },
      { slug: "tychy", name: "Tychy" },
    ],
  },
  {
    name: "Świętokrzyskie",
    cities: [
      { slug: "kielce", name: "Kielce" },
      { slug: "ostrowiec-swietokrzyski", name: "Ostrowiec Świętokrzyski" },
      { slug: "starachowice", name: "Starachowice" },
      { slug: "skarzysko-kamienna", name: "Skarżysko-Kamienna" },
      { slug: "sandomierz", name: "Sandomierz" },
      { slug: "konskie", name: "Końskie" },
    ],
  },
  {
    name: "Warmińsko-mazurskie",
    cities: [
      { slug: "olsztyn", name: "Olsztyn" },
      { slug: "elblag", name: "Elbląg" },
      { slug: "elk", name: "Ełk" },
      { slug: "ostroda", name: "Ostróda" },
      { slug: "ilawa", name: "Iława" },
      { slug: "gizycko", name: "Giżycko" },
    ],
  },
  {
    name: "Wielkopolskie",
    cities: [
      { slug: "poznan", name: "Poznań" },
      { slug: "kalisz", name: "Kalisz" },
      { slug: "konin", name: "Konin" },
      { slug: "pila", name: "Piła" },
      { slug: "ostrow-wielkopolski", name: "Ostrów Wielkopolski" },
      { slug: "gniezno", name: "Gniezno" },
    ],
  },
  {
    name: "Zachodniopomorskie",
    cities: [
      { slug: "szczecin", name: "Szczecin" },
      { slug: "koszalin", name: "Koszalin" },
      { slug: "stargard", name: "Stargard" },
      { slug: "kolobrzeg", name: "Kołobrzeg" },
      { slug: "swinoujscie", name: "Świnoujście" },
      { slug: "walcz", name: "Wałcz" },
    ],
  },
];

export const SEO_CITIES: SeoCity[] = SEO_REGIONS.flatMap((region) => region.cities);

export function getSeoCity(slug: string) {
  return SEO_CITIES.find((city) => city.slug === slug);
}