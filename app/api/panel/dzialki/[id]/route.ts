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
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';
import { deleteFromR2 } from '@/lib/r2';

export const runtime = 'nodejs';

function badRequest(message: string, details?: any) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
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

function fallbackLocationLabel(lat: number, lng: number) {
  return `Punkt: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, { params }: Props) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase().trim();

  if (!sessionEmail) {
    return NextResponse.json({ ok: false, message: 'Brak autoryzacji.' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: sessionEmail },
    select: { id: true },
  });

  if (!dbUser?.id) {
    return NextResponse.json({ ok: false, message: 'Nie znaleziono użytkownika w bazie.' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.dzialka.findFirst({
    where: {
      id,
      ownerId: dbUser.id,
    },
    select: {
      id: true,
      zdjecia: {
        select: {
          id: true,
          publicId: true,
          url: true,
          kolejnosc: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, message: 'Nie znaleziono ogłoszenia.' }, { status: 404 });
  }

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

  const mode: LocationMode = locationMode === 'APPROX' ? LocationMode.APPROX : LocationMode.EXACT;

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

  const oldPhotoKeys = existing.zdjecia
    .map((z) => z.publicId)
    .filter((key): key is string => Boolean(key));

  const newPhotoKeys = zdjecia
    .map((z: any) => z?.publicId)
    .filter((key: unknown): key is string => typeof key === 'string' && key.length > 0);

  const keysToDelete = oldPhotoKeys.filter((key) => !newPhotoKeys.includes(key));

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.dzialka.update({
        where: { id },
        data: {
          tytul,
          powierzchniaM2,
          cenaPln,
          przeznaczenia: mappedPrzeznaczenia,
          telefon,
          email,

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

          zdjecia: {
            deleteMany: {},
            create: zdjecia.map((z: any, i: number) => ({
              url: z.url,
              publicId: z.publicId,
              kolejnosc: Number.isInteger(z.kolejnosc) ? z.kolejnosc : i,
            })),
          },
        },
        include: {
          zdjecia: {
            orderBy: { kolejnosc: 'asc' },
          },
        },
      });

      return item;
    });

    if (keysToDelete.length > 0) {
      await Promise.allSettled(keysToDelete.map((key) => deleteFromR2(key)));
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: 'Nie udało się zapisać zmian.', error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}