import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { LocationMode } from '@prisma/client';

function getGoogleKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

function buildQuery(d: any) {
  const parts = [d.locationFull, d.locationLabel].filter(Boolean);
  if (!parts.length) return null;
  return `${[...new Set(parts)].join(', ')}, Polska`;
}

async function geocode(query: string) {
  const key = getGoogleKey();
  if (!key) throw new Error('Brak GOOGLE_MAPS_API_KEY w .env.local');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('region', 'pl');
  url.searchParams.set('language', 'pl');
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== 'OK') {
    console.log('[SKIP]', data.status, query);
    return null;
  }

  const result = data.results?.[0];
  const loc = result?.geometry?.location;

  if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null;

  const isPoland = result.address_components?.some((c: any) => {
    return c.types?.includes('country') && c.short_name === 'PL';
  });

  if (!isPoland) return null;

  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: result.formatted_address ?? null,
  };
}

async function main() {
  const offers = await prisma.dzialka.findMany({
    where: {
      sourceType: 'CRM',
      OR: [{ lat: null }, { lng: null }],
      status: 'AKTYWNE',
    },
    select: {
      id: true,
      numerOferty: true,
      tytul: true,
      locationLabel: true,
      locationFull: true,
      lat: true,
      lng: true,
    },
    take: 5000,
  });

  console.log(`Do uzupełnienia: ${offers.length}`);

  let ok = 0;
  let skip = 0;

  for (const d of offers) {
    const query = buildQuery(d);

    if (!query) {
      skip++;
      console.log('[SKIP] brak lokalizacji', d.numerOferty, d.tytul);
      continue;
    }

    const geo = await geocode(query);

    if (!geo) {
      skip++;
      continue;
    }

    await prisma.dzialka.update({
      where: { id: d.id },
      data: {
        lat: geo.lat,
        lng: geo.lng,
        mapsUrl: `https://maps.google.com/?q=${geo.lat},${geo.lng}`,
        locationFull: d.locationFull || geo.formattedAddress,
        locationMode: LocationMode.APPROX,
      },
    });

    ok++;
    console.log('[OK]', d.numerOferty, query, '=>', geo.lat, geo.lng);

    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`Gotowe. OK: ${ok}, pominięte: ${skip}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });