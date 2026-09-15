// Raport działki pod ofertą. To samo, co generuje „Sprawdź działkę" (ewidencja z ULDK, plan
// miejscowy, plan ogólny gminy), tylko policzone raz i zapisane w `DzialkaRaport`. Kupujący ma
// raport od razu pod ogłoszeniem, bez przechodzenia do narzędzia, a Google dostaje go w HTML oferty.
//
// Raport powstaje TYLKO, gdy wiemy, która to działka ([[feedback-filtry-twarde]]):
//  - PINEZKA: ogłoszeniodawca postawił dokładną pinezkę (locationMode EXACT),
//  - OPIS: biuro wpisało numer działki w opis (lib/dzialkaZOpisu.ts), a ULDK potwierdza go
//    w gminie oferty, blisko jej pinezki i z powierzchnią zgodną z ogłoszeniem.
// Z samej przybliżonej pinezki działki nie wyprowadzamy nigdy.
//
// Ceny transakcyjne (RCN) nie są tu zapisywane: strona liczy je przy renderze z tabeli
// RcnTransakcja, bo skan rejestru wciąż rośnie i zapisana liczba szybko by się zestarzała.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { findParcels, getAdminByXY, getParcelById, getParcelByXY, type ParcelReport } from '@/lib/uldk';
import { getMpzpAtPoint, MPZP_WERSJA, ponowOdczytMpzp, type MpzpInfo } from '@/lib/mpzp';
import { getPogAtPoint, type PogInfo } from '@/lib/pog';
import { haversineKm } from '@/lib/dzialkiSearch';
import {
  kluczZOpisu,
  miejscowoscZEtykiety,
  numeryZOpisu,
  pasujeDoOferty,
  regionyDoSzukania,
} from '@/lib/dzialkaZOpisu';

export type ZrodloDzialki = 'PINEZKA' | 'OPIS';

export type RaportOfertyDane = {
  wersja: 1;
  parcel: ParcelReport;
  mpzp: MpzpInfo | null;
  pog: PogInfo | null;
  // Plany, których serwer nie odpowiedział przy sprawdzaniu (część gminnych serwerów MPZP wisi) albo
  // odpowiedział nieczytelnie (wyjątek serwera gminy, sam rysunek planu). Raport i tak zapisujemy,
  // bo ewidencja jest pewna, a brakujący plan dociągamy później.
  niedostepne?: ('mpzp' | 'pog')[];
  // Wersja odczytu planu miejscowego (MPZP_WERSJA w lib/mpzp.ts). Brak = raport sprzed 2026-09-15,
  // którego „brak planu" mógł być fałszywy (gminy GISON, format Krakowa, awarie serwerów gmin).
  wersjaMpzp?: number;
};

export type RaportOferty = {
  zrodlo: ZrodloDzialki;
  dane: RaportOfertyDane;
  sprawdzonoAt: Date;
};

/** Pola oferty potrzebne do ustalenia działki. */
export const OFERTA_DO_RAPORTU_SELECT = {
  id: true,
  opis: true,
  locationMode: true,
  lat: true,
  lng: true,
  locationLabel: true,
  adminTeryt: true,
  powierzchniaM2: true,
} satisfies Prisma.DzialkaSelect;

export type OfertaDoRaportu = {
  id: string;
  opis: string | null;
  locationMode: string;
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
  adminTeryt: string | null;
  powierzchniaM2: number;
};

// Po takim czasie ponawiamy próbę, która padła na awarii usługi GUGiK.
const PONOW_BLAD_PO_MS = 24 * 60 * 60 * 1000;
// Raport bez planu, którego serwer nie odpowiedział, ponawiamy po tygodniu.
const PONOW_NIEPELNY_PO_MS = 7 * 24 * 60 * 60 * 1000;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Skąd możemy znać działkę tej oferty. Tanie, bez sieci: wołane przy każdym renderze oferty. */
export function wejscieRaportu(o: OfertaDoRaportu): { zrodlo: ZrodloDzialki; klucz: string } | null {
  if (o.locationMode === 'EXACT' && isNum(o.lat) && isNum(o.lng)) {
    return { zrodlo: 'PINEZKA', klucz: `xy:${o.lat.toFixed(5)},${o.lng.toFixed(5)}` };
  }
  const z = numeryZOpisu(o.opis);
  const klucz = kluczZOpisu(z);
  // Sam numer bez gminy oferty nie wskaże działki: „Dąbrowa 12" to kilkadziesiąt działek w Polsce.
  // Gminę bierzemy z `adminTeryt`, a gdy świeża oferta jeszcze jej nie ma, ustalimy ją z pinezki.
  const znamyGmine = !!o.adminTeryt || (isNum(o.lat) && isNum(o.lng));
  if (!klucz || (z.identyfikatory.length === 0 && !znamyGmine)) return null;
  return { zrodlo: 'OPIS', klucz: `opis:${o.adminTeryt ?? ''}|${klucz}` };
}

type WierszRaportu = { klucz: string; status: string; sprawdzonoAt: Date; dane: Prisma.JsonValue };

/** Czy raport trzeba (prze)liczyć. Wspólna reguła strony oferty i `npm run raporty:backfill`. */
export function wymagaOdswiezenia(row: WierszRaportu, klucz: string): boolean {
  if (row.klucz !== klucz) return true;
  const wiek = Date.now() - row.sprawdzonoAt.getTime();
  if (row.status === 'BLAD') return wiek > PONOW_BLAD_PO_MS;
  const dane = row.status === 'GOTOWY' ? daneZBazy(row.dane) : null;
  if (!dane) return false;
  const niedostepne = dane.niedostepne ?? [];
  // „Brak planu" ze starszego odczytu MPZP mógł być fałszywy (gminy GISON, Kraków): liczymy od razu.
  // Plan bez szczegółów ponawiamy jak plan, którego serwer nie odpowiedział, czyli po tygodniu.
  const mpzp = niedostepne.includes('mpzp') ? null : ponowOdczytMpzp(dane.mpzp, dane.wersjaMpzp);
  if (mpzp === 'teraz') return true;
  return (niedostepne.length > 0 || mpzp === 'pozniej') && wiek > PONOW_NIEPELNY_PO_MS;
}

/** Działka sprawdzona w ULDK, do diagnostyki skryptu: dlaczego przyjęta albo odrzucona. */
export type SprawdzonaDzialka = { id: string; km: number | null; stosunek: number | null; pasuje: boolean };

export type UstalonaDzialka = { status: 'GOTOWY'; parcel: ParcelReport } | { status: 'BRAK'; powod: string };

function pasuje(parcel: ParcelReport, o: OfertaDoRaportu, sprawdzone?: SprawdzonaDzialka[]): boolean {
  const km = isNum(o.lat) && isNum(o.lng) ? haversineKm(o.lat, o.lng, parcel.center.lat, parcel.center.lng) : null;
  const ok = pasujeDoOferty({ areaM2: parcel.areaM2, km }, o.powierzchniaM2);
  sprawdzone?.push({
    id: parcel.id,
    km,
    stosunek: o.powierzchniaM2 > 0 ? parcel.areaM2 / o.powierzchniaM2 : null,
    pasuje: ok,
  });
  return ok;
}

/**
 * Ustala działkę ewidencyjną oferty. Rzuca przy awarii ULDK (wołający zapisze BLAD i ponowi);
 * `BRAK` zwraca, gdy dane nie wskazują jednej działki, która pasuje do ogłoszenia.
 */
export async function ustalDzialke(
  o: OfertaDoRaportu,
  zrodlo: ZrodloDzialki,
  sprawdzone?: SprawdzonaDzialka[]
): Promise<UstalonaDzialka> {
  if (zrodlo === 'PINEZKA') {
    if (!isNum(o.lat) || !isNum(o.lng)) return { status: 'BRAK', powod: 'oferta nie ma pinezki' };
    const parcel = await getParcelByXY(o.lat, o.lng);
    if (!parcel) return { status: 'BRAK', powod: 'pod pinezką nie ma działki' };
    // Pinezka postawiona na drodze albo u sąsiada też trafia w „jakąś" działkę; powierzchnia to wyłapie.
    return pasuje(parcel, o, sprawdzone)
      ? { status: 'GOTOWY', parcel }
      : { status: 'BRAK', powod: 'działka pod pinezką nie zgadza się z ogłoszeniem' };
  }

  const z = numeryZOpisu(o.opis);
  const ids = new Set<string>(z.identyfikatory);
  // Gmina oferty: z bazy, a gdy jej brak (świeża oferta przed backfillem osi administracyjnej),
  // z przybliżonej pinezki. Kilkaset metrów niedokładności nie zmienia gminy.
  const teryt =
    o.adminTeryt ?? (isNum(o.lat) && isNum(o.lng) ? ((await getAdminByXY(o.lat, o.lng))?.teryt ?? null) : null);

  if (ids.size === 0 && teryt) {
    const regiony = regionyDoSzukania(z, miejscowoscZEtykiety(o.locationLabel));
    for (const numer of z.numery) {
      for (const region of regiony) {
        const wGminie = (await findParcels(region, numer)).filter((k) => k.id.startsWith(teryt));
        if (wGminie.length === 1) {
          ids.add(wGminie[0].id);
          break;
        }
        // Ten sam numer w kilku obrębach gminy: nie zgadujemy, który.
        if (wGminie.length > 1) break;
      }
    }
  }
  if (ids.size === 0) return { status: 'BRAK', powod: 'numer z opisu nie wskazuje jednej działki w gminie' };

  const pasujace = new Map<string, ParcelReport>();
  for (const id of ids) {
    const parcel = await getParcelById(id);
    if (!parcel) continue;
    if (teryt && !parcel.id.startsWith(teryt)) continue;
    if (pasuje(parcel, o, sprawdzone)) pasujace.set(parcel.id, parcel);
  }
  if (pasujace.size === 1) return { status: 'GOTOWY', parcel: [...pasujace.values()][0] };
  if (pasujace.size > 1) return { status: 'BRAK', powod: 'opis wskazuje kilka pasujących działek' };
  return { status: 'BRAK', powod: 'działka z opisu nie zgadza się z ofertą (miejsce albo powierzchnia)' };
}

/**
 * Dane raportu dla ustalonej działki. Plany dociągamy osobno: gdy serwer nie odpowie, zaznaczamy
 * to w `niedostepne` zamiast zapisywać awarię jako „brak planu" albo gubić cały raport.
 */
export async function zbudujDane(parcel: ParcelReport): Promise<RaportOfertyDane> {
  const { lat, lng } = parcel.center;
  const [mpzp, pog] = await Promise.allSettled([
    getMpzpAtPoint(lat, lng, { rzucajBledy: true }),
    getPogAtPoint(lat, lng, { rzucajBledy: true }),
  ]);
  const niedostepne: ('mpzp' | 'pog')[] = [];
  if (mpzp.status === 'rejected') niedostepne.push('mpzp');
  if (pog.status === 'rejected') niedostepne.push('pog');
  return {
    wersja: 1,
    parcel,
    mpzp: mpzp.status === 'fulfilled' ? mpzp.value : null,
    pog: pog.status === 'fulfilled' ? pog.value : null,
    ...(niedostepne.length > 0 ? { niedostepne } : {}),
    wersjaMpzp: MPZP_WERSJA,
  };
}

function daneZBazy(dane: Prisma.JsonValue | null): RaportOfertyDane | null {
  const d = dane as Partial<RaportOfertyDane> | null;
  return d && d.wersja === 1 && d.parcel ? (d as RaportOfertyDane) : null;
}

/**
 * Raport do pokazania pod ofertą i informacja, czy trzeba go (prze)liczyć. Odporny na brak tabeli:
 * kod może wejść na produkcję przed migracją i wtedy oferta wygląda jak dotąd.
 */
export async function pobierzRaportOferty(
  o: OfertaDoRaportu
): Promise<{ raport: RaportOferty | null; doOdswiezenia: boolean }> {
  let row: (WierszRaportu & { zrodlo: string }) | null;
  try {
    row = await prisma.dzialkaRaport.findUnique({
      where: { dzialkaId: o.id },
      select: { zrodlo: true, klucz: true, status: true, dane: true, sprawdzonoAt: true },
    });
  } catch {
    return { raport: null, doOdswiezenia: false };
  }

  const wejscie = wejscieRaportu(o);
  // Numer zniknął z opisu albo pinezka przestała być dokładna: stary raport do sprzątnięcia.
  if (!wejscie) return { raport: null, doOdswiezenia: row !== null };
  if (!row) return { raport: null, doOdswiezenia: true };

  const dane = row.status === 'GOTOWY' && row.klucz === wejscie.klucz ? daneZBazy(row.dane) : null;
  return {
    raport: dane ? { zrodlo: row.zrodlo as ZrodloDzialki, dane, sprawdzonoAt: row.sprawdzonoAt } : null,
    doOdswiezenia: wymagaOdswiezenia(row, wejscie.klucz),
  };
}

export type WynikOdswiezenia = 'GOTOWY' | 'BRAK' | 'BLAD' | 'USUNIETY' | 'AKTUALNY';

/**
 * Ustala działkę i zapisuje raport. Wołane w tle po wejściu na ofertę (app/dzialka/[id]) i przez
 * `npm run raporty:backfill`. `wymus` liczy od nowa także raport z aktualnym kluczem.
 */
export async function odswiezRaportOferty(
  dzialkaId: string,
  opts: { wymus?: boolean } = {}
): Promise<WynikOdswiezenia> {
  const [o, row] = await Promise.all([
    prisma.dzialka.findUnique({ where: { id: dzialkaId }, select: OFERTA_DO_RAPORTU_SELECT }),
    prisma.dzialkaRaport.findUnique({
      where: { dzialkaId },
      select: { klucz: true, status: true, sprawdzonoAt: true, dane: true },
    }),
  ]);
  const wejscie = o ? wejscieRaportu(o) : null;

  if (!o || !wejscie) {
    if (!row) return 'AKTUALNY';
    await prisma.dzialkaRaport.deleteMany({ where: { dzialkaId } });
    return 'USUNIETY';
  }
  if (row && !opts.wymus && !wymagaOdswiezenia(row, wejscie.klucz)) return 'AKTUALNY';

  const zapisz = (wynik: { status: 'GOTOWY' | 'BRAK' | 'BLAD'; parcelId?: string; dane?: RaportOfertyDane }) => {
    const pola = {
      zrodlo: wejscie.zrodlo,
      klucz: wejscie.klucz,
      status: wynik.status,
      parcelId: wynik.parcelId ?? null,
      dane: wynik.dane ? (wynik.dane as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      sprawdzonoAt: new Date(),
    };
    return prisma.dzialkaRaport.upsert({
      where: { dzialkaId },
      create: { dzialkaId, ...pola },
      update: pola,
    });
  };

  // Ta sama działka, a do doczytania są tylko plany (serwer nie odpowiedział, plan bez szczegółów,
  // „brak planu" ze starszego odczytu MPZP): bierzemy zapisaną działkę zamiast ustalać ją w ULDK od
  // nowa. Awarie planów lądują w `niedostepne`, więc zapis się udaje i strona oferty nie ponawia tego
  // przy każdym wejściu, nawet gdy ULDK leży. Pełne przeliczenie zostaje dla `wymus`.
  const zapisane =
    !opts.wymus && row?.status === 'GOTOWY' && row.klucz === wejscie.klucz ? daneZBazy(row.dane) : null;
  if (zapisane) {
    try {
      await zapisz({ status: 'GOTOWY', parcelId: zapisane.parcel.id, dane: await zbudujDane(zapisane.parcel) });
      return 'GOTOWY';
    } catch {
      return 'BLAD';
    }
  }

  try {
    const wynik = await ustalDzialke(o, wejscie.zrodlo);
    if (wynik.status === 'BRAK') {
      await zapisz({ status: 'BRAK' });
      return 'BRAK';
    }
    const dane = await zbudujDane(wynik.parcel);
    await zapisz({ status: 'GOTOWY', parcelId: wynik.parcel.id, dane });
    return 'GOTOWY';
  } catch {
    // Awaria GUGiK nie może skasować dobrego raportu dla tego samego wejścia (np. przy --odswiez).
    if (row?.status === 'GOTOWY' && row.klucz === wejscie.klucz) return 'BLAD';
    await zapisz({ status: 'BLAD' });
    return 'BLAD';
  }
}
