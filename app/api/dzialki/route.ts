import { NextResponse } from 'next/server';
import {
  LocationMode,
  Przeznaczenie,
  SprzedajacyTyp,
  PradStatus,
  WodaStatus,
  KanalizacjaStatus,
  GazStatus,
  SwiatlowodStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

function badRequest(message: string, details?: any) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function genEditToken() {
  return crypto.randomUUID();
}

function fallbackLocationLabel(lat: number, lng: number) {
  return `Punkt: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function cleanOptionalString(v: any): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function parseEnum<T extends Record<string, string>>(enm: T, v: any): T[keyof T] | null {
  if (v == null) return null;
  if (!Object.values(enm).includes(v)) return null;
  return v as T[keyof T];
}

function normalizeKw(v: any): string | null {
  const kw = cleanOptionalString(v);
  if (!kw) return null;
  if (!/^[A-Z0-9]{4}\/\d{8}\/\d$/.test(kw)) {
    throw new Error('Nieprawidłowy format księgi wieczystej (np. AB1C/00012345/6).');
  }
  return kw;
}

// ✅ GET z filtrami + PAGINACJA: { ok, count, items, meta }
export async function GET(req: Request) {
  const url = new URL(req.url);

  const q = (url.searchParams.get('q') || '').trim();
  const priceMin = url.searchParams.get('priceMin');
  const priceMax = url.searchParams.get('priceMax');
  const areaMin = url.searchParams.get('areaMin');
  const areaMax = url.searchParams.get('areaMax');

  const przeznRaw = (url.searchParams.get('przeznaczenia') || '').trim();
  const przeznaczenia = przeznRaw ? przeznRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  // ✅ page / take
  const takeReq = Number(url.searchParams.get('take') || '20');
  const take = Math.min(Math.max(Number.isFinite(takeReq) ? takeReq : 20, 1), 100);

  const pageReq = Number(url.searchParams.get('page') || '1');
  const page = Math.max(Number.isFinite(pageReq) ? Math.floor(pageReq) : 1, 1);

  // kompatybilność wstecz jeśli ktoś jeszcze wysyła skip
  const skipParam = url.searchParams.get('skip');
  const skip = skipParam != null ? Math.max(Number(skipParam) || 0, 0) : (page - 1) * take;

  const sort = (url.searchParams.get('sort') || 'newest').toLowerCase();

  const where: Prisma.DzialkaWhereInput = {};

  if (q) {
    where.OR = [
      { tytul: { contains: q, mode: 'insensitive' } },
      { locationLabel: { contains: q, mode: 'insensitive' } },
      { locationFull: { contains: q, mode: 'insensitive' } },
      { parcelText: { contains: q, mode: 'insensitive' } },
      { opis: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (priceMin || priceMax) {
    where.cenaPln = {};
    if (priceMin) where.cenaPln.gte = Number(priceMin);
    if (priceMax) where.cenaPln.lte = Number(priceMax);
  }

  if (areaMin || areaMax) {
    where.powierzchniaM2 = {};
    if (areaMin) where.powierzchniaM2.gte = Number(areaMin);
    if (areaMax) where.powierzchniaM2.lte = Number(areaMax);
  }

  if (przeznaczenia.length) {
    // `hasSome` działa na polu listy enumów w Prisma
    where.przeznaczenia = { hasSome: przeznaczenia as any };
  }

  // ✅ KLUCZ: orderBy musi być SortOrder (asc/desc), nie dowolny string
  const orderBy: Prisma.DzialkaOrderByWithRelationInput =
    sort === 'price_asc'
      ? { cenaPln: 'asc' }
      : sort === 'price_desc'
      ? { cenaPln: 'desc' }
      : sort === 'area_asc'
      ? { powierzchniaM2: 'asc' }
      : sort === 'area_desc'
      ? { powierzchniaM2: 'desc' }
      : { createdAt: 'desc' };

  const [count, items] = await Promise.all([
    prisma.dzialka.count({ where }),
    prisma.dzialka.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { zdjecia: { orderBy: { kolejnosc: 'asc' } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(count / take));
  const safePage = Math.min(page, totalPages);

  return NextResponse.json({
    ok: true,
    count,
    items,
    meta: {
      page: safePage,
      take,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    },
  });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest('Nieprawidłowy JSON body.');
  }

  const {
    tytul,
    powierzchniaM2,
    cenaPln,
    przeznaczenia,
    telefon,
    email,

    // ✅ NOWE
    opis,

    sprzedajacyTyp,
    numerOferty,

    placeId,
    locationFull,
    locationLabel,
    lat,
    lng,
    mapsUrl,
    locationMode,
    parcelText,

    prad,
    woda,
    kanalizacja,
    gaz,
    swiatlowod,

    wzWydane,
    mpzp,
    projektDomu,

    klasaZiemi,
    wymiary,
    ksiegaWieczysta,

    zdjecia,
  } = body ?? {};

  // required
  if (!tytul || typeof tytul !== 'string') return badRequest('Brak tytułu.');
  if (!Number.isInteger(powierzchniaM2) || powierzchniaM2 <= 0) return badRequest('Podaj poprawną powierzchnię.');
  if (!Number.isInteger(cenaPln) || cenaPln <= 0) return badRequest('Podaj poprawną cenę.');
  if (!telefon || typeof telefon !== 'string') return badRequest('Brak telefonu.');
  if (!email || typeof email !== 'string') return badRequest('Brak email.');

  if (!Array.isArray(przeznaczenia) || przeznaczenia.length < 1) {
    return badRequest('Wybierz co najmniej 1 przeznaczenie.');
  }

  if (!Array.isArray(zdjecia) || zdjecia.length < 1) {
    return badRequest('Wymagane jest minimum 1 zdjęcie.');
  }
  for (const z of zdjecia) {
    if (!z?.url || !z?.publicId) return badRequest('Każde zdjęcie musi mieć url i publicId.');
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') return badRequest('Wybierz lokalizację.');

  // ✅ opis
  const opisClean = cleanOptionalString(opis);
  if (opisClean && opisClean.length > 8000) {
    return badRequest('Opis jest za długi (max 8000 znaków).');
  }

  const safeLocationLabel =
    typeof locationLabel === 'string' && locationLabel.trim().length > 0
      ? locationLabel.trim()
      : fallbackLocationLabel(lat, lng);

  const mode: LocationMode = locationMode === 'APPROX' ? LocationMode.APPROX : LocationMode.EXACT;

  // przeznaczenia -> enum validation
  let mappedPrzeznaczenia: Przeznaczenie[];
  try {
    mappedPrzeznaczenia = przeznaczenia.map((p: any) => {
      if (!Object.values(Przeznaczenie).includes(p)) throw new Error(`Nieprawidłowe przeznaczenie: ${p}`);
      return p as Przeznaczenie;
    });
  } catch (e: any) {
    return badRequest(e?.message ?? 'Nieprawidłowe przeznaczenia.');
  }

  // seller
  const seller: SprzedajacyTyp = sprzedajacyTyp === 'BIURO' ? SprzedajacyTyp.BIURO : SprzedajacyTyp.PRYWATNIE;
  const nr = cleanOptionalString(numerOferty);
  if (seller === SprzedajacyTyp.BIURO && !nr) return badRequest('Dla BIURA podaj numer oferty.');

  // uzbrojenie (enumy)
  const pradParsed = parseEnum(PradStatus, prad) ?? PradStatus.BRAK_PRZYLACZA;
  const wodaParsed = parseEnum(WodaStatus, woda) ?? WodaStatus.BRAK_PRZYLACZA;
  const kanalParsed = parseEnum(KanalizacjaStatus, kanalizacja) ?? KanalizacjaStatus.BRAK;
  const gazParsed = parseEnum(GazStatus, gaz) ?? GazStatus.BRAK;
  const swiatParsed = parseEnum(SwiatlowodStatus, swiatlowod) ?? SwiatlowodStatus.BRAK;

  // opcjonalne
  const klasa = cleanOptionalString(klasaZiemi);
  const wym = cleanOptionalString(wymiary);

  let kw: string | null = null;
  try {
    kw = normalizeKw(ksiegaWieczysta);
  } catch (e: any) {
    return badRequest(e?.message ?? 'Nieprawidłowa księga wieczysta.');
  }

  const editToken = genEditToken();

  try {
    const created = await prisma.dzialka.create({
      data: {
        tytul,
        powierzchniaM2,
        cenaPln,
        przeznaczenia: mappedPrzeznaczenia,
        telefon,
        email,

        // ✅ zapis opisu
        opis: opisClean,

        sprzedajacyTyp: seller,
        numerOferty: seller === SprzedajacyTyp.BIURO ? nr : null,

        placeId: typeof placeId === 'string' ? placeId : null,
        locationFull: typeof locationFull === 'string' ? locationFull : null,
        locationLabel: safeLocationLabel,
        lat,
        lng,
        mapsUrl: typeof mapsUrl === 'string' ? mapsUrl : null,
        locationMode: mode,
        parcelText: typeof parcelText === 'string' ? parcelText : null,

        prad: pradParsed,
        woda: wodaParsed,
        kanalizacja: kanalParsed,
        gaz: gazParsed,
        swiatlowod: swiatParsed,

        wzWydane: !!wzWydane,
        mpzp: !!mpzp,
        projektDomu: !!projektDomu,

        klasaZiemi: klasa,
        wymiary: wym,
        ksiegaWieczysta: kw,

        editToken,
        expiresAt: null,

        zdjecia: {
          create: zdjecia.map((z: any, i: number) => ({
            url: z.url,
            publicId: z.publicId,
            kolejnosc: Number.isInteger(z.kolejnosc) ? z.kolejnosc : i,
          })),
        },
      },
      include: { zdjecia: { orderBy: { kolejnosc: 'asc' } } },
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: 'Nie udało się dodać działki.', error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}