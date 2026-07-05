import { NextResponse } from 'next/server';

// Auto-zdjęcie działki: ortofotomapa z geoportalu (GUGiK), pobierana po stronie serwera.
// Geoportal WYMAGA nagłówka User-Agent (bez niego zwraca 404) i nie ma CORS, dlatego
// robimy to serwerowo i oddajemy klientowi gotowy obraz do wgrania w pipeline zdjęć.
export const runtime = 'nodejs';

const ORTHO_WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function to3857(lat: number, lng: number): { x: number; y: number } {
  const x = (lng * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return { x, y };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));

  // Prosta bramka granic Polski (jak w innych miejscach), żeby nie odpytywać poza zakresem.
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 49 ||
    lat > 55 ||
    lng < 14 ||
    lng > 24.2
  ) {
    return NextResponse.json({ ok: false, message: 'Punkt poza Polską.' }, { status: 400 });
  }

  // Kadr: dopasowany do działki (bbox z klienta, EPSG:3857, kwadrat) albo domyślny ~250 m.
  // Klient rysuje obrys w TYM SAMYM bboxie, więc muszą się zgadzać.
  const bboxParam = searchParams.get('bbox');
  let bbox: string;
  if (bboxParam && /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bboxParam)) {
    bbox = bboxParam;
  } else {
    const { x, y } = to3857(lat, lng);
    const d = 125;
    bbox = `${x - d},${y - d},${x + d},${y + d}`;
  }

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'Raster',
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: bbox,
    // Wyższa rozdzielczość = ostrzejsze auto-zdjęcie działki (kadr jest ciasny,
    // więc każdy dodatkowy piksel realnie poprawia jakość ortofoto).
    WIDTH: '1280',
    HEIGHT: '1280',
    FORMAT: 'image/jpeg',
  });

  try {
    const res = await fetch(`${ORTHO_WMS}?${params.toString()}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(12000),
    });

    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.startsWith('image/')) {
      return NextResponse.json({ ok: false, message: 'Brak ortofotomapy dla tego punktu.' }, { status: 502 });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1500) {
      return NextResponse.json({ ok: false, message: 'Pusty kadr ortofotomapy.' }, { status: 502 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Nie udało się pobrać ortofotomapy.' }, { status: 502 });
  }
}
