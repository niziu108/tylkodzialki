// „Perełki" — kandydaci na post na FB/Insta: oferty wyraźnie tańsze od lokalnego rynku.
//
// ZAŁOŻENIE, które trzeba rozumieć przed czytaniem kodu: to NIE jest detektor okazji.
// To generator kandydatów do ręcznego przejrzenia. Największe odchylenia w bazie to
// zwykle śmieci (rolna wpisana jako budowlana, powierzchnia z palcem obok, udział
// w działce, cena wywoławcza), a nie okazje. Dlatego nic się stąd nie publikuje
// automatycznie — to lista „popatrz na to najpierw", a decyzję podejmuje człowiek.
//
// OŚ PORÓWNANIA: promień 10 km wokół oferty, nie powiat.
// Pierwsza wersja liczyła medianę per powiat (oś P22 z seoPowiaty) i to nie działało.
// Powiat miesza różne rynki: powiat lubelski miał 318 ofert i medianę 153 zł/m², a w środku
// i podmiejskie działki po 400, i wsie po 50. „30% poniżej mediany powiatu" znaczyło wtedy
// „leżysz w tańszej części powiatu", nie „to jest okazja" — i dawało 421 kandydatów, czyli
// szum. Sąsiedztwo 10 km to ten sam rynek, więc odchylenie zaczyna coś znaczyć.
// To ta sama logika co `getPointValuation` w seoHub ([[project-sprawdz-dzialke]]), tylko
// liczona wsadowo w pamięci dla całej puli naraz, a nie zapytaniem na ofertę.
//
// Powiat i województwo zostają, ale wyłącznie jako etykieta: po województwie wybierasz
// grupę na FB.
//
// Trzy filtry puli NIE są kosmetyką — bez nich lista to śmieci. Każdy wyszedł
// z uruchomienia tego kodu na żywej bazie:
//
//   * Wynajem. „Plac do wynajęcia, 2000 zł/mies." ma w bazie cenaPln=2000 i wychodził
//     na działkę 99% poniżej mediany. Cała sekcja „podejrzane" to był wynajem.
//     => tylko TransakcjaTyp.SPRZEDAZ.
//
//   * Rolne z dopiskiem „budowlana". `przeznaczenia` to tablica, więc „Działki rolne
//     na sprzedaż" z BUDOWLANA+ROLNA łapały się do puli i zajmowały cały top — bo cenę
//     robi im część rolna. => kandydat i próbka muszą być CZYSTO budowlane.
//
//   * Efekt skali. Duża działka ma z natury niższe zł/m², więc bez limitu powierzchni
//     ranking „okazji" był rankingiem hektarów (top: 5000–9700 m²). => jeden zakres
//     „działka pod dom" i dla kandydatów, i dla próbki, żeby porównywać porównywalne.
//
// Uczciwość jak w [[feedback-filtry-twarde]]: przy cienkiej próbce nie liczymy mediany
// i oferta po prostu nie zostaje kandydatem. Lepiej brak perełki niż perełka policzona
// wobec kilku przypadkowych sąsiadów.

import { DzialkaStatus, Przeznaczenie, TransakcjaTyp } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseAdmin, powiatNom } from '@/lib/seoPowiaty';
import { haversineKm } from '@/lib/dzialkiSearch';
import { getParcelMedia, type MediaFlags } from '@/lib/media';

// Promień lokalnego rynku. Stały 10 km (a nie drabinka jak w `getPointValuation`): tu liczy się
// porównywalność ofert MIĘDZY sobą przy jednym progu, a próbka i tak musi dobić PERELKA_MIN_SAMPLE.
export const PERELKA_RADIUS_KM = 10;

// Ilu porównywalnych sąsiadów musi mieć oferta, żeby jej mediana coś znaczyła.
// Wyżej niż MIN_SAMPLE=4 z seoHub: na tej podstawie idzie post publiczny, a odchylenie
// liczone wobec czterech ofert skacze po jednym ogłoszeniu.
export const PERELKA_MIN_SAMPLE = 10;

// Próg „to jest tanio": max 70% mediany sąsiedztwa (czyli 30% i więcej poniżej).
export const PERELKA_MAX_RATIO = 0.7;

// Podłoga wiarygodności: poniżej 20% mediany to prawie na pewno błąd danych (cena wywoławcza,
// udział, literówka), nie okazja. Odpada po cichu — na liście ma stać dziesięć sztuk gotowych
// do wrzucenia, a nie materiał do śledztwa.
export const PERELKA_MIN_RATIO = 0.2;

// Ile perełek pokazujemy. Lista to kolejka do postów, nie raport: dziesięć sztuk przegląda się
// w minutę, a każda oznaczona jako użyta wpuszcza na listę kolejną w kolejności odchylenia.
export const PERELKA_TOP_N = 10;

// Zakres „działka pod dom". Pełni dwie role naraz i obie są ważne:
//  - sanity (poniżej 300 m² to zwykle literówka, powyżej 3000 to grunt inwestycyjny),
//  - kontrola efektu skali: próbka z tego samego przedziału, w którym szukamy kandydatów,
//    więc 900 m² porównuje się do innych małych działek, a nie do hektarów.
export const PERELKA_AREA_MIN_M2 = 300;
export const PERELKA_AREA_MAX_M2 = 3_000;

// Przeznaczenia, które dyskwalifikują ofertę mimo dopisanej „budowlanej": cenę robi
// wtedy grunt rolny/leśny, nie działka pod dom.
const DISQUALIFYING = [Przeznaczenie.ROLNA, Przeznaczenie.LESNA];

// Tytuł zaprzeczający tagom. Feedy z CRM bywają otagowane samą BUDOWLANĄ, choć w tytule
// stoi „Działka rolna 1500 m2" albo „Działka leśna niedaleko zalewu" — i to tytuł ma rację,
// bo z niego wynika cena. Takie oferty przechodziły filtr przeznaczeń i lądowały w topie.
// Do tego udziały w działce i ROD-y: cena wygląda na okazję, bo to nie jest cała działka
// pod dom. Heurystyka jest świadomie nadgorliwa — kandydat odrzucony niesłusznie nic nie
// kosztuje, a post o „perełce", która okazuje się gruntem rolnym, kosztuje wiarygodność.
const TITLE_CONTRADICTS = /\brol(n[aeoy]|no)\b|\bleśn|\blesn|\bsiedlisk|\budzia[łl]\b|\brod\b/i;

export type PerelkaRow = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  pricePerM2: number;
  locationLabel: string | null;
  powiatLabel: string;
  wojSlug: string;
  // mediana zł/m² wśród porównywalnych ofert w promieniu PERELKA_RADIUS_KM
  localMedian: number;
  localSample: number;
  // 0..1 — ile procent mediany kosztuje metr tej działki (0.55 => 45% taniej)
  ratio: number;
  // ile procent poniżej mediany, zaokrąglone (45 => „45% taniej")
  discountPct: number;
  media: MediaFlags;
  uzbrojona: boolean;
  mpzp: boolean;
  wzWydane: boolean;
  photoCount: number;
  publishedAt: Date;
};

export type PerelkiReport = {
  // Kandydaci na post, od największego odchylenia, BEZ już użytych. Cała lista, nie tylko
  // dziesiątka: przycięcie do PERELKA_TOP_N robi widok, bo dopiero on wie, czy filtrujesz
  // po województwie (wtedy dziesiątka ma być z tego województwa, a nie z kraju).
  perelki: PerelkaRow[];
  // ile porównywalnych ofert w ogóle weszło do liczenia (kontekst dla liczb wyżej)
  scannedCount: number;
};

export type UzytaPerelka = {
  dzialkaId: string;
  tytul: string;
  locationLabel: string | null;
  usedAt: Date;
};

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Liczy kandydatów na perełki. Jeden odczyt + porównania w pamięci: pula „małych
 * budowlanych na sprzedaż" to ~2,4 tys. ofert, więc nawet naiwne O(n²) po sąsiadach to
 * kilka milionów operacji arytmetycznych, czyli grubo poniżej sekundy. Strona admina jest
 * odwiedzana ręcznie, więc nie ma po co budować pod to indeksu przestrzennego.
 */
export async function getPerelkiReport(): Promise<PerelkiReport> {
  const now = new Date();

  // Użyte znikają z listy kandydatów, ale ZOSTAJĄ w puli porównawczej — to nadal realne
  // oferty na tym rynku. Wycięcie ich z mediany zniekształcałoby ceny sąsiadom.
  const usedIds = new Set(
    (await prisma.perelkaUzyta.findMany({ select: { dzialkaId: true } })).map((u) => u.dzialkaId),
  );

  const rows = await prisma.dzialka.findMany({
    where: {
      ownerId: { not: null },
      status: DzialkaStatus.AKTYWNE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      transakcja: TransakcjaTyp.SPRZEDAZ,
      przeznaczenia: { has: Przeznaczenie.BUDOWLANA },
      // Lista skalarna nie ma operatora „nie zawiera" — stąd NOT + hasSome.
      NOT: { przeznaczenia: { hasSome: DISQUALIFYING } },
      cenaPln: { gt: 0 },
      powierzchniaM2: { gte: PERELKA_AREA_MIN_M2, lte: PERELKA_AREA_MAX_M2 },
      lat: { not: null },
      lng: { not: null },
    },
    select: {
      id: true,
      tytul: true,
      cenaPln: true,
      powierzchniaM2: true,
      lat: true,
      lng: true,
      locationFull: true,
      locationLabel: true,
      prad: true,
      woda: true,
      kanalizacja: true,
      gaz: true,
      mpzp: true,
      wzWydane: true,
      publishedAt: true,
      _count: { select: { zdjecia: true } },
    },
  });

  // Pula porównawcza: każda oferta ma zł/m² i punkt na mapie. Wszystkie te oferty służą
  // i jako kandydaci, i jako próbka dla sąsiadów (usuwanie kandydatów z próbki zawyżałoby
  // medianę i produkowało perełki z niczego).
  // Odsiew tytułów zaprzeczających tagom robimy na całej puli, nie tylko na kandydatach:
  // gdyby taka oferta została jako sąsiad, zaniżałaby lokalną medianę i robiła perełki
  // z ofert w normalnej cenie.
  const pool = rows
    .filter((r) => !TITLE_CONTRADICTS.test(r.tytul))
    .map((r) => ({
      ...r,
      lat: r.lat as number,
      lng: r.lng as number,
      ppm2: Math.round(r.cenaPln / r.powierzchniaM2),
    }));

  const perelki: PerelkaRow[] = [];

  for (const s of pool) {
    if (usedIds.has(s.id)) continue; // poszła już na posta — liczy się jako sąsiad, nie jako kandydat

    // Mediana lokalna: wszystkie porównywalne oferty w promieniu, łącznie z tą ocenianą.
    const neighbours: number[] = [];
    for (const o of pool) {
      if (haversineKm(s.lat, s.lng, o.lat, o.lng) <= PERELKA_RADIUS_KM) neighbours.push(o.ppm2);
    }
    if (neighbours.length < PERELKA_MIN_SAMPLE) continue; // pustka wokół => nie ma do czego porównać

    neighbours.sort((a, b) => a - b);
    const localMedian = median(neighbours);
    if (localMedian <= 0) continue;

    const ratio = s.ppm2 / localMedian;
    if (ratio > PERELKA_MAX_RATIO) continue; // cena w normie => to żaden post

    // Powiat wyłącznie jako etykieta (i województwo do wyboru grupy na FB). Oferta bez
    // rozpoznanego powiatu nadal jest kandydatem — geo mamy z lat/lng, nie z tokenu.
    const admin = parseAdmin(s.locationFull);
    const media = getParcelMedia(s);

    const row: PerelkaRow = {
      id: s.id,
      tytul: s.tytul,
      cenaPln: s.cenaPln,
      powierzchniaM2: s.powierzchniaM2,
      pricePerM2: s.ppm2,
      locationLabel: s.locationLabel,
      powiatLabel: admin ? powiatNom(admin.powiatAdj) : '',
      wojSlug: admin?.wojSlug ?? '',
      localMedian,
      localSample: neighbours.length,
      ratio,
      discountPct: Math.round((1 - ratio) * 100),
      media,
      uzbrojona: media.prad && media.woda,
      mpzp: s.mpzp,
      wzWydane: s.wzWydane,
      photoCount: s._count.zdjecia,
      publishedAt: s.publishedAt,
    };

    if (ratio < PERELKA_MIN_RATIO) continue; // za tanio, żeby to była prawda => błąd w danych
    perelki.push(row);
  }

  perelki.sort((a, b) => a.ratio - b.ratio);

  return { perelki, scannedCount: pool.length };
}

/** Ostatnio użyte perełki — do cofnięcia pomyłkowego oznaczenia. */
export async function getUzytePerelki(limit = 20): Promise<UzytaPerelka[]> {
  const rows = await prisma.perelkaUzyta.findMany({
    orderBy: { usedAt: 'desc' },
    take: limit,
    select: {
      dzialkaId: true,
      usedAt: true,
      dzialka: { select: { tytul: true, locationLabel: true } },
    },
  });

  return rows.map((r) => ({
    dzialkaId: r.dzialkaId,
    tytul: r.dzialka.tytul,
    locationLabel: r.dzialka.locationLabel,
    usedAt: r.usedAt,
  }));
}
