// Ceny TRANSAKCYJNE w okolicy punktu — odczyt zebranych danych z Rejestru Cen Nieruchomości
// (GUGiK), czyli kwot z aktów notarialnych. Zbieranie: `scripts/rcn-backfill.ts` + `lib/rcn.ts`.
//
// Po co osobny moduł: cała reszta serwisu liczy ceny OFERTOWE (życzenia sprzedających). Dopiero
// zestawienie „chcą X, płacono Y" jest czymś, czego nie ma ani portal ogłoszeniowy (ma same
// oferty), ani serwis z danymi (ma same transakcje). To jest różnicownik, więc musi być uczciwy.
//
// Trzy zasady, które trzymają tę uczciwość:
//  1. Nie mieszamy rynków. Grunt rolny szedł w rejestrze po ~7 zł/m², działka pod dom po ~100
//     zł/m². Mediana z obu naraz nie opisuje żadnej z nich, więc pulę dobieramy do sprawdzanej
//     działki i mówimy wprost, czego dotyczy.
//  2. Poniżej progu próbki nie pokazujemy nic. Lepiej brak sekcji niż „mediana z dwóch aktów".
//  3. Promień rozszerzamy drabinką, ale zawsze raportujemy, z jakiego koła i z jakiego okresu
//     liczba pochodzi — czytelnik ma wiedzieć, jak blisko jego działki to się działo.

import { prisma } from '@/lib/prisma';
import { haversineKm } from '@/lib/dzialkiSearch';

const KM_PER_DEG_LAT = 111.32;

// Próg i okno dobrane pomiarem na naszych danych (2026-09-02, próbka 100 ofert), a nie na oko.
// Okno 5 lat zamiast 2 przy progu 10 zamiast 5 daje TAKIE SAMO pokrycie (51% wobec 49%
// sprawdzanych działek), ale typowa próbka rośnie z 7 do 17 aktów. Przy siedmiu mediana bywa
// loterią (odnotowany przypadek: 570 zł/m² na wsi), a tej liczby nie wolno pokazywać obok ceny
// ofertowej jako faktu. Ceny gruntów ruszają się wolniej niż mieszkań, więc starsze akty wciąż
// coś mówią — raport i tak podaje, z jakich lat pochodzą ([[project_rcn_ceny_transakcyjne]]).
/** Minimalna liczba aktów, przy której w ogóle podajemy medianę. */
export const RCN_MIN_PROBKA = 10;

/** Ile miesięcy wstecz uznajemy za „dzisiejszy rynek". */
export const RCN_MIESIECY = 60;

/** Drabinka promieni (km): bierzemy pierwszy, który daje próbkę. */
export const RCN_PROMIENIE = [10, 20, 35] as const;

export type RcnKlasa = 'budowlana' | 'rolna';

export type RcnOkolica = {
  klasa: RcnKlasa;
  medianaZlM2: number;
  /** Widełki p25..p75: przy małej próbce uczciwiej pokazać rozrzut niż jedną liczbę. */
  low: number;
  high: number;
  liczba: number;
  promienKm: number;
  odRoku: number;
  doRoku: number;
};

/**
 * Do której puli należy transakcja. Rejestr opisuje grunt dwoma polami i żadne nie jest pewne:
 * `przeznaczenieMpzp` bywa puste, `sposobUzytkowania` jest ogólniejszy. Bierzemy więc oba,
 * a czego nie umiemy zaklasyfikować, tego nie liczymy (zamiast wrzucać do „budowlanych").
 */
export function klasaTransakcji(t: {
  przeznaczenieMpzp: string | null;
  sposobUzytkowania: string | null;
}): RcnKlasa | null {
  const prz = (t.przeznaczenieMpzp ?? '').toLowerCase();
  const spo = (t.sposobUzytkowania ?? '').toLowerCase();

  // Rolne rozstrzygamy PIERWSZE i tylko wtedy, gdy nic nie wskazuje na zabudowę mieszkaniową.
  // Wpisy łączone („budownictwoMieszkanioweJednorodzinne;terenRolniczy") to działki pod dom
  // z rolnym kawałkiem, a nie pole uprawne, więc idą do budowlanych.
  const mieszkaniowe =
    prz.includes('budownictwomieszkaniowe') || prz.includes('decyzjawarunkizabudowy');
  if (mieszkaniowe) return 'budowlana';

  if (prz.includes('terenrolniczy') || prz.includes('zabudowyzagrodowej')) return 'rolna';
  if (spo.includes('gruntyrolne') || spo.includes('gruntylesne')) return 'rolna';

  if (spo.includes('gruntyzabudowaneizurbanizowane')) return 'budowlana';

  // „brakMPZPLubWZ", „innyNiewymieniony", puste — nie wiemy, czego dotyczyła transakcja.
  return null;
}

function percentyl(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return Math.round(sorted[i]);
}

/**
 * Mediana i widełki zł/m² z aktów notarialnych wokół punktu, dla wskazanej puli.
 * Zwraca `null`, gdy nawet na największym promieniu nie ma wiarygodnej próbki.
 */
export async function getRcnOkolica(
  lat: number,
  lng: number,
  klasa: RcnKlasa,
  teraz: Date = new Date()
): Promise<RcnOkolica | null> {
  const od = new Date(teraz);
  od.setMonth(od.getMonth() - RCN_MIESIECY);

  const maxKm = RCN_PROMIENIE[RCN_PROMIENIE.length - 1];
  const dLat = maxKm / KM_PER_DEG_LAT;
  const dLng = maxKm / (KM_PER_DEG_LAT * Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 0.01));

  // Jedno zapytanie na największe koło, zawężanie liczymy w pamięci — tak samo jak wycena
  // z ofert. Filtry rejestrowe (wolny rynek, cały udział, grunt niezabudowany) są tu, bo bez
  // nich zł/m² nie znaczy nic: ułamkowy udział i sprzedaż z bonifikatą to inne kwoty.
  const rows = await prisma.rcnTransakcja.findMany({
    where: {
      rodzajTransakcji: 'wolnyRynek',
      udzial: '1/1',
      rodzajNieruchomosci: 'nieruchomoscGruntowaNiezabudowana',
      dataTransakcji: { gte: od },
      lat: { gte: lat - dLat, lte: lat + dLat },
      lng: { gte: lng - dLng, lte: lng + dLng },
    },
    select: {
      lat: true,
      lng: true,
      cenaZaM2: true,
      dataTransakcji: true,
      przeznaczenieMpzp: true,
      sposobUzytkowania: true,
    },
  });

  const pasujace = rows
    .filter((r) => klasaTransakcji(r) === klasa)
    .map((r) => ({ ...r, dist: haversineKm(lat, lng, r.lat, r.lng) }));

  for (const promienKm of RCN_PROMIENIE) {
    const wKole = pasujace.filter((r) => r.dist <= promienKm);
    if (wKole.length < RCN_MIN_PROBKA) continue;

    const ceny = wKole.map((r) => r.cenaZaM2).sort((a, b) => a - b);
    const lata = wKole.map((r) => r.dataTransakcji.getFullYear());

    return {
      klasa,
      medianaZlM2: percentyl(ceny, 0.5),
      low: percentyl(ceny, 0.25),
      high: percentyl(ceny, 0.75),
      liczba: wKole.length,
      promienKm,
      odRoku: Math.min(...lata),
      doRoku: Math.max(...lata),
    };
  }

  return null;
}
