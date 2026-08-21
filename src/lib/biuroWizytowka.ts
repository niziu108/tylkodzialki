import { cache } from 'react';
import type {
  Przeznaczenie,
  PradStatus,
  WodaStatus,
  KanalizacjaStatus,
  GazStatus,
  TransakcjaTyp,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseAdmin, powiatNom } from '@/lib/seoPowiaty';
import { getSeoRegion } from '@/lib/seo-locations';
import { normalizeText } from '@/lib/dzialkiSearch';
import { stripPowiatPrefix, powiatKey } from '@/lib/powiatLabel';

/* ────────────────────────────────────────────────────────────────────────────
 *  Wizytówka biura — karta partnerska, nie katalog.
 *
 *  Świadomie NIE budujemy listy `/biura` ani wpisu w nawigacji: strona istnieje
 *  po to, żeby dać partnerowi z realną liczbą ofert jedno miejsce, do którego
 *  prowadzi logo przy jego ogłoszeniu. Wejście tylko z oferty, `noindex`.
 *
 *  Od biura zbieramy cztery rzeczy (logo, opis, kontakt, metryka firmy) i tylko my
 *  je edytujemy — biuro nie dostaje panelu, pisze do nas maila. Resztę, czyli liczbę
 *  działek i zasięg, liczymy z ich własnego eksportu: wizytówka aktualizuje się sama.
 *
 *  Czego tu celowo NIE ma: mediany zł/m² ofert biura. Dane są, ale jeśli wyjdzie,
 *  że partner jest droższy od rynku, wizytówka staje się dowodem przeciwko niemu.
 * ──────────────────────────────────────────────────────────────────────────── */

export type WizytowkaOferta = {
  id: string;
  tytul: string;
  cenaPln: number;
  powierzchniaM2: number;
  locationLabel: string | null;
  transakcja: TransakcjaTyp;
  przeznaczenia: Przeznaczenie[];
  prad: PradStatus;
  woda: WodaStatus;
  kanalizacja: KanalizacjaStatus;
  gaz: GazStatus;
  zdjecia: { url: string }[];
};

export type WizytowkaZasieg = {
  wojewodztwa: { slug: string; name: string; count: number }[];
  powiaty: { slug: string; label: string; count: number }[];
  /** Ile ofert dało się przypisać do powiatu (reszta ma zbyt ubogie `locationFull`). */
  przypisane: number;
};

export type Wizytowka = {
  slug: string;
  nazwa: string;
  logoUrl: string | null;
  logoBg: boolean;
  opis: string | null;
  telefon: string | null;
  email: string | null;
  www: string | null;
  rokZalozenia: number | null;
  liczbaOddzialow: number | null;
  liczbaOfert: number;
  zasieg: WizytowkaZasieg;
  oferty: WizytowkaOferta[];
  strona: number;
  stronLacznie: number;
};

/** Ofert na stronę. Wizytówka listuje CAŁY portfel partnera, stronicowany linkami. */
export const OFERTY_NA_STRONE = 24;

export function slugifyBiuro(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function zbudujZasieg(rows: { locationFull: string | null }[]): WizytowkaZasieg {
  const woj = new Map<string, number>();
  const pow = new Map<string, { label: string; count: number }>();
  let przypisane = 0;

  for (const row of rows) {
    const admin = parseAdmin(row.locationFull);
    if (!admin) continue;
    przypisane += 1;

    woj.set(admin.wojSlug, (woj.get(admin.wojSlug) ?? 0) + 1);

    // Część feedów podaje „powiat sieradzki", część samo „sieradzki". Bez ścięcia prefiksu
    // ten sam powiat wpadałby dwa razy (i wychodziło „powiat powiat sieradzki").
    const adj = stripPowiatPrefix(admin.powiatAdj);
    const key = powiatKey(admin.powiatSlug);

    const prev = pow.get(key);
    pow.set(key, {
      label: powiatNom(adj),
      count: (prev?.count ?? 0) + 1,
    });
  }

  const wojewodztwa = [...woj.entries()]
    .map(([slug, count]) => ({ slug, name: getSeoRegion(slug)?.name ?? slug, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'));

  const powiaty = [...pow.entries()]
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pl'));

  return { wojewodztwa, powiaty, przypisane };
}

export const getWizytowkaBySlug = cache(async (slug: string, strona = 1): Promise<Wizytowka | null> => {
  if (!slug || typeof slug !== 'string') return null;
  const page = Number.isFinite(strona) && strona > 0 ? Math.floor(strona) : 1;

  const user = await prisma.user.findUnique({
    where: { biuroSlug: slug },
    select: {
      id: true,
      biuroWizytowkaOn: true,
      biuroSlug: true,
      biuroOpis: true,
      biuroTelefon: true,
      biuroEmail: true,
      biuroWww: true,
      biuroRokZalozenia: true,
      biuroLiczbaOddzialow: true,
      defaultBiuroNazwa: true,
      defaultBiuroLogoUrl: true,
      defaultBiuroLogoBg: true,
    },
  });

  // Wyłączona wizytówka zachowuje się jak nieistniejąca — partner traci stronę
  // w tej samej sekundzie, w której klikniemy przełącznik w adminie.
  if (!user || !user.biuroWizytowkaOn || !user.biuroSlug) return null;

  const aktywne = { ownerId: user.id, status: 'AKTYWNE' as const };

  const [liczbaOfert, adminRows, oferty] = await Promise.all([
    prisma.dzialka.count({ where: aktywne }),
    prisma.dzialka.findMany({ where: aktywne, select: { locationFull: true } }),
    prisma.dzialka.findMany({
      where: aktywne,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * OFERTY_NA_STRONE,
      take: OFERTY_NA_STRONE,
      select: {
        id: true,
        tytul: true,
        cenaPln: true,
        powierzchniaM2: true,
        locationLabel: true,
        transakcja: true,
        przeznaczenia: true,
        prad: true,
        woda: true,
        kanalizacja: true,
        gaz: true,
        zdjecia: { orderBy: { kolejnosc: 'asc' }, take: 1, select: { url: true } },
      },
    }),
  ]);

  return {
    slug: user.biuroSlug,
    nazwa: user.defaultBiuroNazwa?.trim() || user.biuroSlug,
    logoUrl: user.defaultBiuroLogoUrl,
    logoBg: user.defaultBiuroLogoBg,
    opis: user.biuroOpis,
    telefon: user.biuroTelefon,
    email: user.biuroEmail,
    www: user.biuroWww,
    rokZalozenia: user.biuroRokZalozenia,
    liczbaOddzialow: user.biuroLiczbaOddzialow,
    liczbaOfert,
    zasieg: zbudujZasieg(adminRows),
    oferty: oferty.map((o) => ({
      id: o.id,
      tytul: o.tytul,
      cenaPln: o.cenaPln,
      powierzchniaM2: o.powierzchniaM2,
      locationLabel: o.locationLabel,
      transakcja: o.transakcja,
      przeznaczenia: o.przeznaczenia,
      prad: o.prad,
      woda: o.woda,
      kanalizacja: o.kanalizacja,
      gaz: o.gaz,
      zdjecia: o.zdjecia,
    })),
    strona: page,
    stronLacznie: Math.max(1, Math.ceil(liczbaOfert / OFERTY_NA_STRONE)),
  };
});

/**
 * Slug wizytówki właściciela oferty — albo null, gdy partner jej nie ma włączonej.
 * Używane przy renderze oferty, żeby zdecydować, czy logo jest klikalne.
 */
export const getWizytowkaSlugForOwner = cache(
  async (ownerId: string | null | undefined): Promise<string | null> => {
    if (!ownerId) return null;
    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { biuroWizytowkaOn: true, biuroSlug: true },
    });
    return user?.biuroWizytowkaOn ? user.biuroSlug : null;
  }
);
