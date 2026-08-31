// „Czy chodziło o…" dla wyszukiwarki: podpowiedź nazwy miejscowości po literówce.
//
// Endpoint wołany TYLKO wtedy, gdy lista wyszła pusta — normalne przeglądanie nic za niego
// nie płaci. Słownik nazw budujemy z własnych ofert (patrz src/lib/dzialkiSuggest.ts) i
// trzymamy we wspólnym cache, żeby seria pustych zapytań nie oznaczała serii agregacji.

import { NextResponse } from 'next/server';
import { DzialkaStatus } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { suggestPlaces, type PlaceEntry } from '@/lib/dzialkiSuggest';
import { normalizeText } from '@/lib/dzialkiSearch';

export const dynamic = 'force-dynamic';

/* „RADOMSKO, PIASKI" i „Radomsko" to dla podpowiedzi to samo miejsce — bierzemy pierwszy człon
 * etykiety (miejscowość), resztę (przysiółek, dzielnica) pomijamy. */
function mainPlaceName(label: string): string {
  return label.split(',')[0]?.trim() ?? '';
}

/* Dane z CRM-ów przychodzą raz WIELKIMI, raz mieszanymi literami — w podpowiedzi ma być
 * „Radomsko", nie „RADOMSKO”. */
function prettyName(value: string): string {
  return value
    .toLocaleLowerCase('pl-PL')
    .split(/(\s|-)/)
    .map((part) => (/^[\s-]$/.test(part) || !part ? part : part[0].toLocaleUpperCase('pl-PL') + part.slice(1)))
    .join('');
}

const getPlaceDictionary = unstable_cache(
  async (): Promise<PlaceEntry[]> => {
    // Te same warunki „oferta żyje", co lista wyników — inaczej podpowiadalibyśmy miejsca,
    // w których po kliknięciu byłoby pusto.
    const rows = await prisma.dzialka.groupBy({
      by: ['locationLabel'],
      where: {
        ownerId: { not: null },
        status: DzialkaStatus.AKTYWNE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        locationLabel: { not: null },
        lat: { not: null },
        lng: { not: null },
      },
      _count: { _all: true },
      _avg: { lat: true, lng: true },
    });

    // Scalenie po nazwie miejscowości: średnia współrzędnych ważona liczbą ofert, żeby punkt
    // podpowiedzi siedział tam, gdzie realnie stoi podaż.
    const merged = new Map<string, { label: string; lat: number; lng: number; count: number }>();

    for (const row of rows) {
      const name = mainPlaceName(row.locationLabel ?? '');
      const key = normalizeText(name);
      const lat = row._avg.lat;
      const lng = row._avg.lng;
      const count = row._count._all;

      if (!key || lat == null || lng == null || !count) continue;

      const found = merged.get(key);
      if (found) {
        const total = found.count + count;
        found.lat = (found.lat * found.count + lat * count) / total;
        found.lng = (found.lng * found.count + lng * count) / total;
        found.count = total;
      } else {
        merged.set(key, { label: prettyName(name), lat, lng, count });
      }
    }

    return [...merged.values()];
  },
  ['dzialki-place-dictionary-v1'],
  { revalidate: 900 }
);

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ ok: true, items: [] });

  try {
    const dictionary = await getPlaceDictionary();
    const items = suggestPlaces(q, dictionary).map(({ label, lat, lng, count }) => ({
      label,
      lat,
      lng,
      count,
    }));

    return NextResponse.json({ ok: true, items });
  } catch {
    // Podpowiedź to dodatek — jej awaria nie ma wywalać pustego stanu listy.
    return NextResponse.json({ ok: true, items: [] });
  }
}
