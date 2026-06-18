// Wspólny kształt kryteriów alertu + budowanie etykiety i adresu /kup.
// Używane po stronie klienta (AlertBar) i serwera (API, silnik, mail),
// dlatego: tylko `import type` z @prisma/client (zero runtime Prisma w bundlu klienta).

import type { Przeznaczenie, TransakcjaTyp } from '@prisma/client';

export type AlertCriteria = {
  query: string | null;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  przeznaczenia: Przeznaczenie[];
  transakcja: TransakcjaTyp[];
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
};

export const PRZEZNACZENIE_KEYS: Przeznaczenie[] = [
  'INWESTYCYJNA',
  'BUDOWLANA',
  'ROLNA',
  'LESNA',
  'REKREACYJNA',
  'SIEDLISKOWA',
];

export const TRANSAKCJA_KEYS: TransakcjaTyp[] = ['SPRZEDAZ', 'WYNAJEM'];

const RADIUS_OPTIONS = [5, 10, 20, 40];

const PRZEZN_ADJ: Record<string, string> = {
  INWESTYCYJNA: 'inwestycyjne',
  BUDOWLANA: 'budowlane',
  ROLNA: 'rolne',
  LESNA: 'leśne',
  REKREACYJNA: 'rekreacyjne',
  SIEDLISKOWA: 'siedliskowe',
};

function toPosInt(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(/\s/g, '')) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 ? i : null;
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// Walidacja/parsowanie kryteriów z dowolnego body żądania.
export function normalizeCriteria(raw: Record<string, unknown> | null | undefined): AlertCriteria {
  const queryRaw = typeof raw?.query === 'string' ? raw.query.trim() : '';
  const query = queryRaw.length ? queryRaw.slice(0, 120) : null;

  const przeznIn: unknown = raw?.przeznaczenia;
  const przeznaczenia = Array.isArray(przeznIn)
    ? (przeznIn.filter(
        (p): p is Przeznaczenie => typeof p === 'string' && (PRZEZNACZENIE_KEYS as string[]).includes(p)
      ) as Przeznaczenie[])
    : [];

  const txnIn: unknown = raw?.transakcja;
  const transakcja = Array.isArray(txnIn)
    ? (txnIn.filter(
        (t): t is TransakcjaTyp => typeof t === 'string' && (TRANSAKCJA_KEYS as string[]).includes(t)
      ) as TransakcjaTyp[])
    : [];

  const lat = toFiniteNumber(raw?.lat);
  const lng = toFiniteNumber(raw?.lng);
  const hasCenter = lat !== null && lng !== null && !(lat === 0 && lng === 0);

  const radiusRaw = toPosInt(raw?.radiusKm);
  const radiusKm = hasCenter ? (radiusRaw && RADIUS_OPTIONS.includes(radiusRaw) ? radiusRaw : 5) : null;

  return {
    query,
    priceMin: toPosInt(raw?.priceMin),
    priceMax: toPosInt(raw?.priceMax),
    areaMin: toPosInt(raw?.areaMin),
    areaMax: toPosInt(raw?.areaMax),
    przeznaczenia: Array.from(new Set(przeznaczenia)),
    transakcja: Array.from(new Set(transakcja)),
    lat: hasCenter ? lat : null,
    lng: hasCenter ? lng : null,
    radiusKm,
  };
}

// Alert bez żadnego sensownego kryterium = pasowałby do każdej nowej oferty. Blokujemy.
export function criteriaIsEmpty(c: AlertCriteria): boolean {
  const hasGeo = c.lat !== null && c.lng !== null && c.radiusKm !== null;
  return (
    !c.query &&
    !hasGeo &&
    c.priceMin === null &&
    c.priceMax === null &&
    c.areaMin === null &&
    c.areaMax === null &&
    c.przeznaczenia.length === 0
  );
}

// Stabilny odcisk kryteriów — do deduplikacji (jeden użytkownik = jeden taki sam alert).
export function criteriaFingerprint(c: AlertCriteria): string {
  return JSON.stringify({
    q: c.query?.toLowerCase() ?? null,
    pmin: c.priceMin,
    pmax: c.priceMax,
    amin: c.areaMin,
    amax: c.areaMax,
    pr: [...c.przeznaczenia].sort(),
    tr: [...c.transakcja].sort(),
    lat: c.lat !== null ? Number(c.lat.toFixed(4)) : null,
    lng: c.lng !== null ? Number(c.lng.toFixed(4)) : null,
    r: c.radiusKm,
  });
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) {
    const mln = v / 1_000_000;
    return `${mln.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mln`;
  }
  if (v >= 1000) {
    return `${Math.round(v / 1000).toLocaleString('pl-PL')} tys.`;
  }
  return `${v} zł`;
}

function fmtArea(v: number): string {
  return `${v.toLocaleString('pl-PL')} m²`;
}

// Czytelna etykieta, np. „Działki budowlane Bełchatów do 200 tys.".
export function buildAlertLabel(c: AlertCriteria): string {
  let head = 'Działki';
  if (c.przeznaczenia.length === 1) {
    const adj = PRZEZN_ADJ[c.przeznaczenia[0]];
    if (adj) head = `Działki ${adj}`;
  }
  if (c.transakcja.length === 1) {
    head += c.transakcja[0] === 'WYNAJEM' ? ' na wynajem' : ' na sprzedaż';
  }

  const parts: string[] = [head];

  if (c.query) {
    parts.push(c.query);
  } else if (c.lat !== null && c.lng !== null && c.radiusKm !== null) {
    parts.push('w wybranej okolicy');
  }

  if (c.priceMin !== null && c.priceMax !== null) {
    parts.push(`${fmtMoney(c.priceMin)} do ${fmtMoney(c.priceMax)}`);
  } else if (c.priceMax !== null) {
    parts.push(`do ${fmtMoney(c.priceMax)}`);
  } else if (c.priceMin !== null) {
    parts.push(`od ${fmtMoney(c.priceMin)}`);
  }

  if (c.areaMin !== null && c.areaMax !== null) {
    parts.push(`${fmtArea(c.areaMin)} do ${fmtArea(c.areaMax)}`);
  } else if (c.areaMax !== null) {
    parts.push(`do ${fmtArea(c.areaMax)}`);
  } else if (c.areaMin !== null) {
    parts.push(`od ${fmtArea(c.areaMin)}`);
  }

  return parts.join(' ').slice(0, 160);
}

// Adres wyszukiwarki odtwarzający kryteria (parametry jak w KupSearch.buildUrlFromState).
export function buildKupPathFromCriteria(c: AlertCriteria): string {
  const sp = new URLSearchParams();

  if (c.query) sp.set('loc', c.query);
  if (c.lat !== null && c.lng !== null) {
    sp.set('lat', String(c.lat));
    sp.set('lng', String(c.lng));
    if (c.radiusKm && c.radiusKm !== 5) sp.set('radius', String(c.radiusKm));
  }
  if (c.priceMin !== null) sp.set('priceMin', String(c.priceMin));
  if (c.priceMax !== null) sp.set('priceMax', String(c.priceMax));
  if (c.areaMin !== null) sp.set('areaMin', String(c.areaMin));
  if (c.areaMax !== null) sp.set('areaMax', String(c.areaMax));
  if (c.przeznaczenia.length) sp.set('przezn', c.przeznaczenia.join(','));
  if (c.transakcja.length) sp.set('transakcja', c.transakcja.join(','));

  const qs = sp.toString();
  return qs ? `/kup?${qs}` : '/kup';
}
