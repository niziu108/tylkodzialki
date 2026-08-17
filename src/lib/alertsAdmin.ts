// Raport alertów (OfferAlert) na potrzeby panelu admina — /admin/powiadomienia.
//
// Po co: alert = kupujący, który sam powiedział „szukam działki TU i TAKIEJ". To najtwardszy
// sygnał popytu, jaki mamy, i zarazem argument do rozmowy z biurem („mam X osób czekających
// na działki w Twoim powiecie"). Dlatego oprócz listy liczymy rozkład po miastach.
//
// Oś miast: NAJBLIŻSZE miasto SEO wg współrzędnych alertu (ta sama oś co reszta portalu),
// a nie surowy tekst wpisany w wyszukiwarkę — inaczej jedna wieś = osobny wiersz i rozkład
// rozsypuje się na pył. Tekst użytkownika i tak pokazujemy w wierszu alertu.

import type { Przeznaczenie, TransakcjaTyp } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { haversineKm } from '@/lib/dzialkiSearch';
import { SEO_CITIES } from '@/lib/seo-locations';

// Dalej niż tyle od miasta SEO = nie przypisujemy na siłę (mamy 40 km promienia w wyszukiwarce).
const CITY_MAX_KM = 60;

export const NO_CITY_KEY = 'brak-lokalizacji';

export type AlertStatus = 'aktywny' | 'oczekuje' | 'wstrzymany';

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  aktywny: 'Aktywny',
  oczekuje: 'Czeka na potwierdzenie',
  wstrzymany: 'Wstrzymany',
};

const PRZEZN_LABEL: Record<Przeznaczenie, string> = {
  INWESTYCYJNA: 'inwestycyjna',
  BUDOWLANA: 'budowlana',
  ROLNA: 'rolna',
  LESNA: 'leśna',
  REKREACYJNA: 'rekreacyjna',
  SIEDLISKOWA: 'siedliskowa',
};

const TRANSAKCJA_LABEL: Record<TransakcjaTyp, string> = {
  SPRZEDAZ: 'sprzedaż',
  WYNAJEM: 'wynajem',
};

const intPL = new Intl.NumberFormat('pl-PL');

function fmtPln(v: number): string {
  return `${intPL.format(v)} zł`;
}

function fmtM2(v: number): string {
  return `${intPL.format(v)} m²`;
}

export type AdminAlertRow = {
  id: string;
  email: string;
  /** Skąd wziął się adres: konto w serwisie czy sama subskrypcja mailowa (P26). */
  source: 'konto' | 'e-mail';
  status: AlertStatus;
  cityKey: string;
  cityLabel: string;
  /** Ile km od środka miasta SEO leży punkt alertu (null, gdy alert bez współrzędnych). */
  cityDistanceKm: number | null;
  label: string;
  /** Tekst, który użytkownik wpisał w wyszukiwarkę (bywa wsią albo dzielnicą). */
  queryText: string | null;
  /** Rozpisane wytyczne: cena, powierzchnia, przeznaczenie, promień, typ transakcji. */
  criteriaLines: string[];
  createdAt: Date;
  lastNotifiedAt: Date | null;
};

export type AlertCityRow = {
  key: string;
  label: string;
  total: number;
  aktywne: number;
  /** Unikalne adresy e-mail — czyli realna liczba osób, nie liczba alertów. */
  osoby: number;
};

export type AlertsAdminReport = {
  rows: AdminAlertRow[];
  cities: AlertCityRow[];
  summary: {
    total: number;
    aktywne: number;
    oczekujace: number;
    wstrzymane: number;
    osoby: number;
    nowe30d: number;
  };
};

export type AlertsAdminFilters = {
  status?: AlertStatus | null;
  cityKey?: string | null;
  /** Szukanie po adresie e-mail lub po etykiecie alertu. */
  q?: string | null;
};

function statusOf(a: {
  isActive: boolean;
  userId: string | null;
  confirmedAt: Date | null;
}): AlertStatus {
  if (!a.isActive) return 'wstrzymany';
  // Anonimowy alert bez potwierdzenia (double opt-in) jeszcze nie wysyła maili.
  if (!a.userId && !a.confirmedAt) return 'oczekuje';
  return 'aktywny';
}

function cityOf(lat: number | null, lng: number | null): {
  key: string;
  label: string;
  distanceKm: number | null;
} {
  if (lat === null || lng === null) {
    return { key: NO_CITY_KEY, label: 'Bez lokalizacji', distanceKm: null };
  }

  let best: { slug: string; name: string; dist: number } | null = null;
  for (const c of SEO_CITIES) {
    const dist = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || dist < best.dist) best = { slug: c.slug, name: c.name, dist };
  }

  if (!best || best.dist > CITY_MAX_KM) {
    return { key: NO_CITY_KEY, label: 'Bez lokalizacji', distanceKm: null };
  }

  return { key: best.slug, label: best.name, distanceKm: Math.round(best.dist) };
}

function criteriaLinesOf(a: {
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  przeznaczenia: Przeznaczenie[];
  transakcja: TransakcjaTyp[];
  radiusKm: number | null;
}): string[] {
  const lines: string[] = [];

  if (a.priceMin !== null && a.priceMax !== null) {
    lines.push(`Cena: ${fmtPln(a.priceMin)} do ${fmtPln(a.priceMax)}`);
  } else if (a.priceMax !== null) {
    lines.push(`Cena: do ${fmtPln(a.priceMax)}`);
  } else if (a.priceMin !== null) {
    lines.push(`Cena: od ${fmtPln(a.priceMin)}`);
  }

  if (a.areaMin !== null && a.areaMax !== null) {
    lines.push(`Powierzchnia: ${fmtM2(a.areaMin)} do ${fmtM2(a.areaMax)}`);
  } else if (a.areaMax !== null) {
    lines.push(`Powierzchnia: do ${fmtM2(a.areaMax)}`);
  } else if (a.areaMin !== null) {
    lines.push(`Powierzchnia: od ${fmtM2(a.areaMin)}`);
  }

  if (a.przeznaczenia.length) {
    lines.push(`Przeznaczenie: ${a.przeznaczenia.map((p) => PRZEZN_LABEL[p]).join(', ')}`);
  }

  if (a.transakcja.length) {
    lines.push(`Transakcja: ${a.transakcja.map((t) => TRANSAKCJA_LABEL[t]).join(', ')}`);
  }

  if (a.radiusKm !== null) {
    lines.push(`Promień: ${a.radiusKm} km`);
  }

  return lines;
}

export async function getAlertsAdminReport(
  filters: AlertsAdminFilters = {}
): Promise<AlertsAdminReport> {
  const alerts = await prisma.offerAlert.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      email: true,
      confirmedAt: true,
      isActive: true,
      label: true,
      query: true,
      priceMin: true,
      priceMax: true,
      areaMin: true,
      areaMax: true,
      przeznaczenia: true,
      transakcja: true,
      lat: true,
      lng: true,
      radiusKm: true,
      createdAt: true,
      lastNotifiedAt: true,
      user: { select: { email: true } },
    },
  });

  const all: AdminAlertRow[] = alerts.map((a) => {
    const city = cityOf(a.lat, a.lng);
    return {
      id: a.id,
      email: (a.email ?? a.user?.email ?? '').toLowerCase() || '(brak adresu)',
      source: a.userId ? 'konto' : 'e-mail',
      status: statusOf(a),
      cityKey: city.key,
      cityLabel: city.label,
      cityDistanceKm: city.distanceKm,
      label: a.label,
      queryText: a.query,
      criteriaLines: criteriaLinesOf(a),
      createdAt: a.createdAt,
      lastNotifiedAt: a.lastNotifiedAt,
    };
  });

  // Podsumowanie i rozkład po miastach liczymy z CAŁOŚCI, nie z przefiltrowanej listy —
  // filtry mają zawężać listę do roboty, a nie podmieniać obraz popytu.
  const cityMap = new Map<string, { label: string; total: number; aktywne: number; emails: Set<string> }>();
  for (const r of all) {
    let entry = cityMap.get(r.cityKey);
    if (!entry) {
      entry = { label: r.cityLabel, total: 0, aktywne: 0, emails: new Set<string>() };
      cityMap.set(r.cityKey, entry);
    }
    entry.total += 1;
    if (r.status === 'aktywny') entry.aktywne += 1;
    entry.emails.add(r.email);
  }

  const cities: AlertCityRow[] = [...cityMap.entries()]
    .map(([key, v]) => ({ key, label: v.label, total: v.total, aktywne: v.aktywne, osoby: v.emails.size }))
    .sort((a, b) => {
      // „Bez lokalizacji" zawsze na końcu — to worek, nie rynek.
      if (a.key === NO_CITY_KEY) return 1;
      if (b.key === NO_CITY_KEY) return -1;
      if (b.aktywne !== a.aktywne) return b.aktywne - a.aktywne;
      if (b.total !== a.total) return b.total - a.total;
      return a.label.localeCompare(b.label, 'pl');
    });

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const summary = {
    total: all.length,
    aktywne: all.filter((r) => r.status === 'aktywny').length,
    oczekujace: all.filter((r) => r.status === 'oczekuje').length,
    wstrzymane: all.filter((r) => r.status === 'wstrzymany').length,
    osoby: new Set(all.map((r) => r.email)).size,
    nowe30d: all.filter((r) => r.createdAt >= since30d).length,
  };

  const needle = filters.q?.trim().toLowerCase() ?? '';
  const rows = all.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.cityKey && r.cityKey !== filters.cityKey) return false;
    if (needle) {
      const haystack = `${r.email} ${r.label} ${r.queryText ?? ''} ${r.cityLabel}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return { rows, cities, summary };
}
