import { NextResponse } from 'next/server';
import crypto from 'crypto';
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
  DzialkaStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';

const MAX_PHOTOS = 7;

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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
      },
    });
  }

  return config;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const q = (url.searchParams.get('q') || '').trim();
  const priceMin = url.searchParams.get('priceMin');
  const priceMax = url.searchParams.get('priceMax');
  const areaMin = url.searchParams.get('areaMin');
  const areaMax = url.searchParams.get('areaMax');

  const przeznRaw = (url.searchParams.get('przeznaczenia') || '').trim();
  const przeznaczenia = przeznRaw
    ? przeznRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const takeReq = Number(url.searchParams.get('take') || '20');
  const take = Math.min(Math.max(Number.isFinite(takeReq) ? takeReq : 20, 1), 500);

  const pageReq = Number(url.searchParams.get('page') || '1');
  const page = Math.max(Number.isFinite(pageReq) ? Math.floor(pageReq) : 1, 1);

  const skipParam = url.searchParams.get('skip');
  const skip = skipParam != null ? Math.max(Number(skipParam) || 0, 0) : (page - 1) * take;

  const sort = (url.searchParams.get('sort') || 'newest').toLowerCase();

  const andFilters: Prisma.DzialkaWhereInput[] = [
    { ownerId: { not: null } },
    { status: DzialkaStatus.AKTYWNE },
    {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  ];

  if (q) {
    andFilters.push({
      OR: [
        { tytul: { contains: q, mode: 'insensitive' } },
        { locationLabel: { contains: q, mode: 'insensitive' } },
        { locationFull: { contains: q, mode: 'insensitive' } },
        { parcelText: { contains: q, mode: 'insensitive' } },
        { opis: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  if (priceMin || priceMax) {
    const cenaPln: Prisma.IntFilter = {};
    if (priceMin) cenaPln.gte = Number(priceMin);
    if (priceMax) cenaPln.lte = Number(priceMax);
    andFilters.push({ cenaPln });
  }

  if (areaMin || areaMax) {
    const powierzchniaM2: Prisma.IntFilter = {};
    if (areaMin) powierzchniaM2.gte = Number(areaMin);
    if (areaMax) powierzchniaM2.lte = Number(areaMax);
    andFilters.push({ powierzchniaM2 });
  }

  if (przeznaczenia.length) {
    andFilters.push({
      przeznaczenia: { hasSome: przeznaczenia as any },
    });
  }

  const where: Prisma.DzialkaWhereInput = {
    AND: andFilters,
  };

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
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase().trim();

  if (!sessionEmail) {
    return NextResponse.json({ ok: false, message: 'Brak autoryzacji.' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: sessionEmail },
    select: {
      id: true,
      email: true,
      listingCredits: true,
    },
  });

  if (!dbUser?.id) {
    return NextResponse.json(
      { ok: false, message: 'Nie znaleziono użytkownika w bazie.' },
      { status: 401 }
    );
  }

  const ownerId = dbUser.id;
  const appConfig = await getAppConfig();

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

  if (!tytul || typeof tytul !== 'string') return badRequest('Brak tytułu.');
  if (!Number.isInteger(powierzchniaM2) || powierzchniaM2 <= 0) {
    return badRequest('Podaj poprawną powierzchnię.');
  }
  if (!Number.isInteger(cenaPln) || cenaPln <= 0) return badRequest('Podaj poprawną cenę.');
  if (!telefon || typeof telefon !== 'string') return badRequest('Brak telefonu.');

  if (!Array.isArray(przeznaczenia) || przeznaczenia.length < 1) {
    return badRequest('Wybierz co najmniej 1 przeznaczenie.');
  }

  if (!Array.isArray(zdjecia) || zdjecia.length < 1) {
    return badRequest('Wymagane jest minimum 1 zdjęcie.');
  }

  if (zdjecia.length > MAX_PHOTOS) {
    return badRequest(`Maksymalnie ${MAX_PHOTOS} zdjęć.`);
  }

  for (const z of zdjecia) {
    if (!z?.url || !z?.publicId) {
      return badRequest('Każde zdjęcie musi mieć url i publicId.');
    }
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return badRequest('Wybierz lokalizację.');
  }

  const opisClean = cleanOptionalString(opis);
  if (opisClean && opisClean.length > 8000) {
    return badRequest('Opis jest za długi (max 8000 znaków).');
  }

  const safeLocationLabel =
    typeof locationLabel === 'string' && locationLabel.trim().length > 0
      ? locationLabel.trim()
      : fallbackLocationLabel(lat, lng);

  const mode: LocationMode =
    locationMode === 'APPROX' ? LocationMode.APPROX : LocationMode.EXACT;

  let mappedPrzeznaczenia: Przeznaczenie[];
  try {
    mappedPrzeznaczenia = przeznaczenia.map((p: any) => {
      if (!Object.values(Przeznaczenie).includes(p)) {
        throw new Error(`Nieprawidłowe przeznaczenie: ${p}`);
      }
      return p as Przeznaczenie;
    });
  } catch (e: any) {
    return badRequest(e?.message ?? 'Nieprawidłowe przeznaczenia.');
  }

  const seller: SprzedajacyTyp =
    sprzedajacyTyp === 'BIURO' ? SprzedajacyTyp.BIURO : SprzedajacyTyp.PRYWATNIE;

  const nr = cleanOptionalString(numerOferty);
  if (seller === SprzedajacyTyp.BIURO && !nr) {
    return badRequest('Dla BIURA podaj numer oferty.');
  }

  const pradParsed = parseEnum(PradStatus, prad) ?? PradStatus.BRAK_PRZYLACZA;
  const wodaParsed = parseEnum(WodaStatus, woda) ?? WodaStatus.BRAK_PRZYLACZA;
  const kanalParsed = parseEnum(KanalizacjaStatus, kanalizacja) ?? KanalizacjaStatus.BRAK;
  const gazParsed = parseEnum(GazStatus, gaz) ?? GazStatus.BRAK;
  const swiatParsed = parseEnum(SwiatlowodStatus, swiatlowod) ?? SwiatlowodStatus.BRAK;

  const klasa = cleanOptionalString(klasaZiemi);
  const wym = cleanOptionalString(wymiary);

  let kw: string | null = null;
  try {
    kw = normalizeKw(ksiegaWieczysta);
  } catch (e: any) {
    return badRequest(e?.message ?? 'Nieprawidłowa księga wieczysta.');
  }

  const editToken = genEditToken();

  const now = new Date();
  const expiresAt = appConfig.paymentsEnabled ? addDays(now, 30) : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (appConfig.paymentsEnabled) {
        const updated = await tx.user.updateMany({
          where: {
            id: ownerId,
            listingCredits: {
              gt: 0,
            },
          },
          data: {
            listingCredits: {
              decrement: 1,
            },
          },
        });

        if (updated.count === 0) {
          throw new Error('NO_LISTING_CREDITS');
        }
      }

      const item = await tx.dzialka.create({
        data: {
          ownerId,

          tytul,
          powierzchniaM2,
          cenaPln,
          przeznaczenia: mappedPrzeznaczenia,
          telefon,
          email: dbUser.email ?? null,

          status: DzialkaStatus.AKTYWNE,
          publishedAt: now,
          expiresAt,
          endedAt: null,

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

      return item;
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (e: any) {
    if (e?.message === 'NO_LISTING_CREDITS') {
      return NextResponse.json(
        {
          ok: false,
          error: 'NO_LISTING_CREDITS',
          message: 'Brak dostępnych publikacji. Wybierz pakiet, aby opublikować ogłoszenie.',
          redirectTo: '/panel/pakiety',
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { ok: false, message: 'Nie udało się dodać działki.', error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}