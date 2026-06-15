import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });

  const address = /polska|poland/i.test(q) ? q : `${q}, Polska`;

  const geoUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  geoUrl.searchParams.set('address', address);
  geoUrl.searchParams.set('language', 'pl');
  geoUrl.searchParams.set('region', 'pl');
  geoUrl.searchParams.set('key', apiKey);

  try {
    const res = await fetch(geoUrl.toString(), {
      next: { revalidate: 86400 },
    });

    const data = (await res.json()) as {
      status: string;
      results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };

    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({ error: 'not found', geoStatus: data.status }, { status: 404 });
    }

    const { lat, lng } = data.results[0].geometry.location;
    return NextResponse.json({ lat, lng });
  } catch {
    return NextResponse.json({ error: 'geocode failed' }, { status: 500 });
  }
}
