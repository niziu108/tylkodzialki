import { NextResponse } from 'next/server';

// Auto-zdjęcie działki: ortofotomapa z geoportalu (GUGiK), pobierana po stronie serwera.
// Geoportal WYMAGA nagłówka User-Agent (bez niego zwraca 404) i nie ma CORS, dlatego
// robimy to serwerowo i oddajemy klientowi gotowy obraz do wgrania w pipeline zdjęć.
export const runtime = 'nodejs';
// Usługa składa kadr w kilka do kilkunastu sekund (pomiary 18.09 i 29.09.2026), więc funkcja potrzebuje zapasu.
export const maxDuration = 30;

// Stary adres `WMS/StandardResolution` od września 2026 zwraca 404 (sprawdzone 18.09). Ta sama
// warstwa `Raster` jest pod `StandardResolutionTime` i przyjmuje EPSG:3857, choć nie wymienia go w
// GetCapabilities. `HighResolution` odpada: na wsi oddaje pusty kadr (brak pokrycia).
const ORTHO_WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime';
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

  // Kadr 16:9: dopasowany do działki (bbox z klienta, EPSG:3857, proporcje 16:9) albo domyślny
  // ok. 530 x 300 m wokół punktu. Klient rysuje obrys w TYM SAMYM bboxie, więc muszą się zgadzać.
  const bboxParam = searchParams.get('bbox');
  let bbox: string;
  if (bboxParam && /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bboxParam)) {
    bbox = bboxParam;
  } else {
    const { x, y } = to3857(lat, lng);
    const dy = 150;
    const dx = (dy * 16) / 9;
    bbox = `${x - dx},${y - dy},${x + dx},${y + dy}`;
  }

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'Raster',
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: bbox,
    // 1600x900 = mniej pikseli niż dawny kwadrat 1280x1280, więc usługa składa kadr szybciej
    // (pomiar 29.09: ok. 4 s). Przy kadrze 300 m wysokości to ok. 0,33 m na piksel.
    WIDTH: '1600',
    HEIGHT: '900',
    FORMAT: 'image/jpeg',
  });

  try {
    const res = await fetch(`${ORTHO_WMS}?${params.toString()}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(20000),
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
