// P24: wysokość n.p.m. z Google Elevation API. Opcjonalna — gdy klucz nie ma tej usługi albo błąd,
// zwracamy null i raport po prostu tej pozycji nie pokazuje (nie zgadujemy, [[feedback-filtry-twarde]]).

export async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/elevation/json');
    url.searchParams.set('locations', `${lat},${lng}`);
    url.searchParams.set('key', key);
    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results?: Array<{ elevation: number }>;
    };
    if (data.status !== 'OK' || !data.results?.length) return null;
    return Math.round(data.results[0].elevation);
  } catch {
    return null;
  }
}
