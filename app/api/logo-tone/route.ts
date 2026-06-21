// Wykrywanie tonu logo biura (jasne vs ciemne) po stronie serwera.
// Po co: część wgranych logotypów jest biała/pastelowa i ginie na jasnym tle
// strony. Zamiast ruszać oryginalny plik, liczymy średnią jasność pikseli
// (ważoną kanałem alfa) i zwracamy 'light' / 'dark'. UI stawia logo na kaflu
// w PRZECIWNYM kolorze, więc widać je niezależnie od motywu.
//
// Detekcja na serwerze (a nie w <canvas>) celowo: omija CORS dla logotypów z
// R2 i zewnętrznych adresów z CRM, ogarnia też SVG (sharp rasteryzuje).

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

type Tone = 'light' | 'dark';

// Logo na R2 ma stabilny, hashowany adres — ton liczymy raz na proces.
const toneCache = new Map<string, Tone>();

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=2592000, immutable',
};

// Prosta zapora SSRF: tylko http(s) i bez adresów wewnętrznych. Endpoint i tak
// zwraca jedynie etykietę jasne/ciemne, ale nie chcemy skanować sieci lokalnej.
function parseSafeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return url;
}

async function detectTone(url: URL): Promise<Tone> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return 'dark';

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 6 * 1024 * 1024) return 'dark';

    const { data, info } = await sharp(buf)
      .resize(32, 32, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels; // 4 po ensureAlpha
    let lumSum = 0;
    let alphaSum = 0;
    for (let i = 0; i < data.length; i += channels) {
      const a = (channels === 4 ? data[i + 3] : 255) / 255;
      // Luminancja sRGB (przybliżona), liczona tylko z widocznych pikseli.
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      lumSum += lum * a;
      alphaSum += a;
    }

    // Logo niemal całe przezroczyste -> traktuj jak ciemne (biały kafel).
    if (alphaSum < 1) return 'dark';

    const avg = lumSum / alphaSum;
    // Jasne (białe/pastelowe) logo niknie na jasnym tle -> ciemny kafel.
    return avg > 0.6 ? 'light' : 'dark';
  } catch {
    // Każdy błąd (timeout, nieobsługiwany format) -> bezpieczny biały kafel.
    return 'dark';
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('u');
  if (!raw) {
    return NextResponse.json({ tone: 'dark' as Tone }, { status: 400 });
  }

  const cached = toneCache.get(raw);
  if (cached) {
    return NextResponse.json({ tone: cached }, { headers: CACHE_HEADERS });
  }

  const url = parseSafeUrl(raw);
  if (!url) {
    return NextResponse.json({ tone: 'dark' as Tone }, { status: 400 });
  }

  const tone = await detectTone(url);
  toneCache.set(raw, tone);
  return NextResponse.json({ tone }, { headers: CACHE_HEADERS });
}
