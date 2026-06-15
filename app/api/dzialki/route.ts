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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSearchQuery(value: string) {
  const ignored = new Set([
    'polska',
    'poland',
    'wojewodztwo',
    'województwo',
    'woj',
    'powiat',
    'gmina',
    'miasto',
    'okolice',
    'okolicy',
    'dzialki',
    'dzialka',
  ]);

  return normalizeText(value.replace(/\b\d{2}-\d{3}\b/g, ' ').replace(/\b\d{5}\b/g, ' '))
    .split(/[\s-]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .filter((x) => !ignored.has(x))
    .filter((x) => !/^\d+$/.test(x));
}

type BBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

type SearchArea = {
  type: 'city' | 'voivodeship';
  key: string;
  label: string;
  aliases: string[];
  bbox: BBox;
};

const VOIVODESHIPS: SearchArea[] = [
  { type: 'voivodeship', key: 'dolnoslaskie', label: 'dolnośląskie', aliases: ['dolnoslask', 'dolnoslaskie'], bbox: { minLat: 50.05, maxLat: 51.85, minLng: 14.75, maxLng: 17.85 } },
  { type: 'voivodeship', key: 'kujawsko-pomorskie', label: 'kujawsko-pomorskie', aliases: ['kujawsko', 'kujawsko pomorsk', 'kujawsko-pomorsk', 'pomorskie kujaw'], bbox: { minLat: 52.25, maxLat: 53.85, minLng: 17.20, maxLng: 19.75 } },
  { type: 'voivodeship', key: 'lubelskie', label: 'lubelskie', aliases: ['lubelsk', 'lubelskie'], bbox: { minLat: 50.15, maxLat: 52.35, minLng: 21.60, maxLng: 24.20 } },
  { type: 'voivodeship', key: 'lubuskie', label: 'lubuskie', aliases: ['lubusk', 'lubuskie'], bbox: { minLat: 51.35, maxLat: 53.15, minLng: 14.50, maxLng: 16.45 } },
  { type: 'voivodeship', key: 'lodzkie', label: 'łódzkie', aliases: ['lodzk', 'lodzkie'], bbox: { minLat: 50.80, maxLat: 52.40, minLng: 18.05, maxLng: 20.75 } },
  { type: 'voivodeship', key: 'malopolskie', label: 'małopolskie', aliases: ['malopolsk', 'malopolskie'], bbox: { minLat: 49.15, maxLat: 50.55, minLng: 19.05, maxLng: 21.45 } },
  { type: 'voivodeship', key: 'mazowieckie', label: 'mazowieckie', aliases: ['mazowieck', 'mazowieckie'], bbox: { minLat: 51.00, maxLat: 53.50, minLng: 19.25, maxLng: 23.15 } },
  { type: 'voivodeship', key: 'opolskie', label: 'opolskie', aliases: ['opolsk', 'opolskie'], bbox: { minLat: 49.95, maxLat: 51.25, minLng: 16.85, maxLng: 18.70 } },
  { type: 'voivodeship', key: 'podkarpackie', label: 'podkarpackie', aliases: ['podkarpack', 'podkarpackie'], bbox: { minLat: 49.00, maxLat: 50.85, minLng: 21.15, maxLng: 23.65 } },
  { type: 'voivodeship', key: 'podlaskie', label: 'podlaskie', aliases: ['podlask', 'podlaskie'], bbox: { minLat: 52.25, maxLat: 54.45, minLng: 21.55, maxLng: 23.95 } },
  { type: 'voivodeship', key: 'pomorskie', label: 'pomorskie', aliases: ['pomorsk', 'pomorskie'], bbox: { minLat: 53.45, maxLat: 54.85, minLng: 16.70, maxLng: 19.85 } },
  { type: 'voivodeship', key: 'slaskie', label: 'śląskie', aliases: ['slask', 'slaskie'], bbox: { minLat: 49.35, maxLat: 51.25, minLng: 18.00, maxLng: 19.95 } },
  { type: 'voivodeship', key: 'swietokrzyskie', label: 'świętokrzyskie', aliases: ['swietokrzysk', 'swietokrzyskie'], bbox: { minLat: 50.15, maxLat: 51.35, minLng: 19.70, maxLng: 21.75 } },
  { type: 'voivodeship', key: 'warminsko-mazurskie', label: 'warmińsko-mazurskie', aliases: ['warminsko', 'mazursk', 'warminsko mazursk', 'warminsko-mazursk'], bbox: { minLat: 53.15, maxLat: 54.55, minLng: 19.10, maxLng: 22.80 } },
  { type: 'voivodeship', key: 'wielkopolskie', label: 'wielkopolskie', aliases: ['wielkopolsk', 'wielkopolskie'], bbox: { minLat: 51.05, maxLat: 53.65, minLng: 15.75, maxLng: 18.75 } },
  { type: 'voivodeship', key: 'zachodniopomorskie', label: 'zachodniopomorskie', aliases: ['zachodniopomorsk', 'zachodnio pomorsk', 'zachodnio-pomorsk'], bbox: { minLat: 52.55, maxLat: 54.85, minLng: 14.10, maxLng: 16.95 } },
];

const CITY_AREAS: SearchArea[] = [
  { type: 'city', key: 'wroclaw', label: 'Wrocław', aliases: ['wroclaw', 'wrocław'], bbox: { minLat: 51.015, maxLat: 51.215, minLng: 16.780, maxLng: 17.205 } },
  { type: 'city', key: 'warszawa', label: 'Warszawa', aliases: ['warszawa', 'warsaw'], bbox: { minLat: 52.095, maxLat: 52.370, minLng: 20.780, maxLng: 21.270 } },
  { type: 'city', key: 'krakow', label: 'Kraków', aliases: ['krakow', 'kraków'], bbox: { minLat: 49.965, maxLat: 50.130, minLng: 19.790, maxLng: 20.220 } },
  { type: 'city', key: 'lodz', label: 'Łódź', aliases: ['lodz', 'łódź'], bbox: { minLat: 51.685, maxLat: 51.855, minLng: 19.320, maxLng: 19.640 } },
  { type: 'city', key: 'poznan', label: 'Poznań', aliases: ['poznan', 'poznań'], bbox: { minLat: 52.300, maxLat: 52.510, minLng: 16.735, maxLng: 17.070 } },
  { type: 'city', key: 'gdansk', label: 'Gdańsk', aliases: ['gdansk', 'gdańsk'], bbox: { minLat: 54.250, maxLat: 54.465, minLng: 18.450, maxLng: 18.950 } },
  { type: 'city', key: 'szczecin', label: 'Szczecin', aliases: ['szczecin'], bbox: { minLat: 53.300, maxLat: 53.560, minLng: 14.380, maxLng: 14.820 } },
  { type: 'city', key: 'bydgoszcz', label: 'Bydgoszcz', aliases: ['bydgoszcz'], bbox: { minLat: 53.040, maxLat: 53.220, minLng: 17.850, maxLng: 18.210 } },
  { type: 'city', key: 'lublin', label: 'Lublin', aliases: ['lublin'], bbox: { minLat: 51.145, maxLat: 51.340, minLng: 22.430, maxLng: 22.700 } },
  { type: 'city', key: 'bialystok', label: 'Białystok', aliases: ['bialystok', 'białystok'], bbox: { minLat: 53.060, maxLat: 53.210, minLng: 23.040, maxLng: 23.300 } },
  { type: 'city', key: 'katowice', label: 'Katowice', aliases: ['katowice'], bbox: { minLat: 50.150, maxLat: 50.335, minLng: 18.850, maxLng: 19.150 } },
  { type: 'city', key: 'rzeszow', label: 'Rzeszów', aliases: ['rzeszow', 'rzeszów'], bbox: { minLat: 49.940, maxLat: 50.115, minLng: 21.890, maxLng: 22.120 } },
  { type: 'city', key: 'torun', label: 'Toruń', aliases: ['torun', 'toruń'], bbox: { minLat: 52.950, maxLat: 53.080, minLng: 18.460, maxLng: 18.750 } },
  { type: 'city', key: 'olsztyn', label: 'Olsztyn', aliases: ['olsztyn'], bbox: { minLat: 53.700, maxLat: 53.850, minLng: 20.330, maxLng: 20.620 } },
  { type: 'city', key: 'kielce', label: 'Kielce', aliases: ['kielce'], bbox: { minLat: 50.790, maxLat: 50.950, minLng: 20.500, maxLng: 20.780 } },
  { type: 'city', key: 'opole', label: 'Opole', aliases: ['opole'], bbox: { minLat: 50.600, maxLat: 50.760, minLng: 17.790, maxLng: 18.060 } },
  { type: 'city', key: 'zielona-gora', label: 'Zielona Góra', aliases: ['zielona gora', 'zielona-gora', 'zielona góra'], bbox: { minLat: 51.840, maxLat: 52.020, minLng: 15.350, maxLng: 15.700 } },
  { type: 'city', key: 'gorzow-wielkopolski', label: 'Gorzów Wielkopolski', aliases: ['gorzow', 'gorzow wielkopolski', 'gorzów', 'gorzów wielkopolski'], bbox: { minLat: 52.650, maxLat: 52.820, minLng: 15.100, maxLng: 15.360 } },
];

function getLocationHaystack(d: any) {
  return normalizeText([d.locationLabel, d.locationFull, d.parcelText].filter(Boolean).join(' '));
}

function detectVoivodeship(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  return VOIVODESHIPS.find((area) =>
    area.aliases.some((alias) => normalized.includes(normalizeText(alias)))
  ) ?? null;
}

function detectCity(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  return CITY_AREAS.find((area) =>
    area.aliases.some((alias) => normalized.includes(normalizeText(alias)))
  ) ?? null;
}

function kmToLatDegrees(km: number) {
  return km / 111.32;
}

function kmToLngDegrees(km: number, atLat: number) {
  const cos = Math.cos((atLat * Math.PI) / 180);
  if (Math.abs(cos) < 0.01) return km / 111.32;
  return km / (111.32 * cos);
}

function expandBBoxByKm(bbox: BBox, km: number): BBox {
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const latPad = kmToLatDegrees(km);
  const lngPad = kmToLngDegrees(km, midLat);

  return {
    minLat: bbox.minLat - latPad,
    maxLat: bbox.maxLat + latPad,
    minLng: bbox.minLng - lngPad,
    maxLng: bbox.maxLng + lngPad,
  };
}

function coordsInBBox(d: any, bbox: BBox) {
  return hasCoords(d) && d.lat! >= bbox.minLat && d.lat! <= bbox.maxLat && d.lng! >= bbox.minLng && d.lng! <= bbox.maxLng;
}

function matchesLocationText(d: any, query: string) {
  const terms = cleanSearchQuery(query);
  if (!terms.length) return false;

  const haystack = getLocationHaystack(d);
  if (!haystack) return false;

  const tokens = haystack
    .split(/[\s-]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (!tokens.length) return false;

  return terms.every((term) => {
    if (tokens.includes(term)) return true;
    if (haystack.includes(term)) return true;

    if (term.length >= 5) {
      return tokens.some((token) => token.startsWith(term) || term.startsWith(token));
    }

    return false;
  });
}

function getSearchMatchInfo(
  d: any,
  query: string,
  latParam: number,
  lngParam: number,
  radiusParam: number,
  hasRadiusSearch: boolean
) {
  const city = query ? detectCity(query) : null;
  const voivodeship = query ? detectVoivodeship(query) : null;

  const radiusDistance = hasRadiusSearch && hasCoords(d)
    ? haversineKm(latParam, lngParam, d.lat!, d.lng!)
    : null;

  const pointRadiusMatch = radiusDistance !== null && radiusDistance <= radiusParam;

  const cityBBox =
    city && hasRadiusSearch
      ? expandBBoxByKm(city.bbox, radiusParam)
      : city
        ? city.bbox
        : null;

  const cityAreaMatch = cityBBox ? coordsInBBox(d, cityBBox) : false;
  const voivodeshipAreaMatch = voivodeship ? coordsInBBox(d, voivodeship.bbox) : false;

  const textMatch = query ? matchesLocationText(d, query) : false;
  const textFallbackMatch = query && (!hasRadiusSearch || !hasCoords(d)) ? textMatch : false;

  const anyMatch =
    voivodeshipAreaMatch ||
    cityAreaMatch ||
    pointRadiusMatch ||
    textFallbackMatch;

  let group = 99;

  if (voivodeshipAreaMatch) group = 1;
  else if (cityAreaMatch) group = 1;
  else if (pointRadiusMatch) group = 2;
  else if (textFallbackMatch) group = 3;

  return {
    city,
    voivodeship,
    radiusDistance,
    pointRadiusMatch,
    cityAreaMatch,
    voivodeshipAreaMatch,
    textMatch,
    textFallbackMatch,
    anyMatch,
    group,
  };
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 =
    Math.cos((aLat * Math.PI) / 180) *
    Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

function hasCoords(d: any) {
  return typeof d.lat === 'number' && typeof d.lng === 'number';
}

function hasPhotos(d: any) {
  return Array.isArray(d.zdjecia) && d.zdjecia.length > 0;
}

function isFeaturedActive(d: any) {
  return !!d.isFeatured && !!d.featuredUntil && new Date(d.featuredUntil).getTime() > Date.now();
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const q = (url.searchParams.get('q') || '').trim();
  const qRaw = (url.searchParams.get('qRaw') || '').trim();
  const searchText = qRaw || q;

  const priceMin = url.searchParams.get('priceMin');
  const priceMax = url.searchParams.get('priceMax');
  const areaMin = url.searchParams.get('areaMin');
  const areaMax = url.searchParams.get('areaMax');

  const latParam = Number(url.searchParams.get('lat'));
  const lngParam = Number(url.searchParams.get('lng'));
  const radiusParam = Number(url.searchParams.get('radius') || '0');

  const hasRadiusSearch =
    Number.isFinite(latParam) &&
    Number.isFinite(lngParam) &&
    Number.isFinite(radiusParam) &&
    radiusParam > 0;

  const przeznRaw = (url.searchParams.get('przeznaczenia') || '').trim();
  const przeznaczenia = przeznRaw
    ? przeznRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const takeReq = Number(url.searchParams.get('take') || '20');
  const take = Math.min(Math.max(Number.isFinite(takeReq) ? Math.floor(takeReq) : 20, 1), 100);

  const pageReq = Number(url.searchParams.get('page') || '1');
  const page = Math.max(Number.isFinite(pageReq) ? Math.floor(pageReq) : 1, 1);

  const skipParam = url.searchParams.get('skip');
  const skip = skipParam != null ? Math.max(Number(skipParam) || 0, 0) : (page - 1) * take;

  const sortParam = url.searchParams.get('sort') ?? 'newest';
  const sort = ['newest', 'oldest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'].includes(sortParam)
    ? sortParam
    : 'newest';

  const andFilters: Prisma.DzialkaWhereInput[] = [
    { ownerId: { not: null } },
    { status: DzialkaStatus.AKTYWNE },
    {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  ];

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

  const allMatching = await prisma.dzialka.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      zdjecia: {
        orderBy: { kolejnosc: 'asc' },
      },
    },
  });

  let filtered = allMatching;

  if (hasRadiusSearch || searchText) {
    filtered = allMatching.filter((d) =>
      getSearchMatchInfo(
        d,
        searchText,
        latParam,
        lngParam,
        radiusParam,
        hasRadiusSearch
      ).anyMatch
    );
  }

  filtered.sort((a, b) => {
    const aInfo = getSearchMatchInfo(a, searchText, latParam, lngParam, radiusParam, hasRadiusSearch);
    const bInfo = getSearchMatchInfo(b, searchText, latParam, lngParam, radiusParam, hasRadiusSearch);

    if (aInfo.group !== bInfo.group) return aInfo.group - bInfo.group;

    const aFeatured = isFeaturedActive(a);
    const bFeatured = isFeaturedActive(b);
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

    switch (sort) {
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'price_asc':
        return a.cenaPln - b.cenaPln;
      case 'price_desc':
        return b.cenaPln - a.cenaPln;
      case 'area_asc':
        return a.powierzchniaM2 - b.powierzchniaM2;
      case 'area_desc':
        return b.powierzchniaM2 - a.powierzchniaM2;
      default: {
        const aPhotos = hasPhotos(a);
        const bPhotos = hasPhotos(b);
        if (aPhotos !== bPhotos) return aPhotos ? -1 : 1;
        if (hasRadiusSearch && aInfo.radiusDistance !== null && bInfo.radiusDistance !== null) {
          return aInfo.radiusDistance - bInfo.radiusDistance;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    }
  });

  const total = filtered.length;
  const items = filtered.slice(skip, skip + take);

  const currentPage = Math.floor(skip / take) + 1;
  const totalPages = Math.max(1, Math.ceil(total / take));

  return NextResponse.json({
    ok: true,
    total,
    count: total,
    items,
    meta: {
      page: currentPage,
      skip,
      take,
      totalPages,
      hasPrev: skip > 0,
      hasNext: skip + take < total,
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
    sprzedajacyImie,
    biuroNazwa,
    biuroOpiekun,
    biuroLogoUrl,
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

  const telefonClean = telefon.trim();
  const nr = cleanOptionalString(numerOferty);
  const sprzedajacyImieClean = cleanOptionalString(sprzedajacyImie);
  const biuroNazwaClean = cleanOptionalString(biuroNazwa);
  const biuroOpiekunClean = cleanOptionalString(biuroOpiekun);
  const biuroLogoUrlClean = cleanOptionalString(biuroLogoUrl);

  if (seller === SprzedajacyTyp.PRYWATNIE && !sprzedajacyImieClean) {
    return badRequest('Dla ogłoszenia prywatnego podaj imię.');
  }

  if (seller === SprzedajacyTyp.BIURO) {
    if (!biuroNazwaClean) return badRequest('Dla BIURA podaj nazwę biura.');
    if (!biuroOpiekunClean) return badRequest('Dla BIURA podaj imię opiekuna.');
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
          where: { id: ownerId, listingCredits: { gt: 0 } },
          data: { listingCredits: { decrement: 1 } },
        });

        if (updated.count === 0) throw new Error('NO_LISTING_CREDITS');
      }

      const item = await tx.dzialka.create({
        data: {
          ownerId,
          tytul: tytul.trim(),
          powierzchniaM2,
          cenaPln,
          przeznaczenia: mappedPrzeznaczenia,
          telefon: telefonClean,
          email: dbUser.email ?? null,
          status: DzialkaStatus.AKTYWNE,
          publishedAt: now,
          expiresAt,
          endedAt: null,
          opis: opisClean,
          sprzedajacyTyp: seller,
          sprzedajacyImie: seller === SprzedajacyTyp.PRYWATNIE ? sprzedajacyImieClean : null,
          biuroNazwa: seller === SprzedajacyTyp.BIURO ? biuroNazwaClean : null,
          biuroOpiekun: seller === SprzedajacyTyp.BIURO ? biuroOpiekunClean : null,
          biuroLogoUrl: seller === SprzedajacyTyp.BIURO ? biuroLogoUrlClean : null,
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

      await tx.user.update({
        where: { id: ownerId },
        data: {
          defaultTelefon: telefonClean,
          defaultSprzedajacyTyp: seller,
          defaultSprzedajacyImie:
            seller === SprzedajacyTyp.PRYWATNIE ? sprzedajacyImieClean : null,
          defaultBiuroNazwa: seller === SprzedajacyTyp.BIURO ? biuroNazwaClean : null,
          defaultBiuroOpiekun: seller === SprzedajacyTyp.BIURO ? biuroOpiekunClean : null,
          defaultBiuroLogoUrl: seller === SprzedajacyTyp.BIURO ? biuroLogoUrlClean : null,
        },
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