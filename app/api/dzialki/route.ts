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
  TransakcjaTyp,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';
import { buildSearchContext, getSearchMatchInfo } from '@/lib/dzialkiSearch';
import { listDzialkiPaginated, PAGE_INCLUDE, type ListSort } from '@/lib/dzialkiQuery';
import { MAX_PHOTOS_PER_OFFER } from '@/lib/photoLimits';
import { MEDIA_AVAILABLE } from '@/lib/media';

const MAX_PHOTOS = MAX_PHOTOS_PER_OFFER;

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

  const mediaRaw = (url.searchParams.get('media') || '').trim();
  const media = mediaRaw
    ? mediaRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Typ oferty (sprzedaż / wynajem): filtr „miękki" jak media/przeznaczenie — nic nie zaznaczone
  // = pokazuj wszystko (i sprzedaż, i wynajem), zaznaczenie zawęża. Zaznaczenie obu = brak zawężenia.
  const transakcjaRaw = (url.searchParams.get('transakcja') || '').trim();
  const transakcja = transakcjaRaw
    ? transakcjaRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is TransakcjaTyp => s === 'SPRZEDAZ' || s === 'WYNAJEM')
    : [];

  // Tryb mapy (P11): lekki payload wszystkich pasujących pinów zamiast stronicowanej listy.
  const mapMode = url.searchParams.get('mode') === 'map';

  // BBox „szukaj w tym obszarze" (P11): prostokąt z widoku mapy. Filtr w bazie na indeksie
  // @@index([lat,lng]) — wspólny dla listy i mapy, więc wyniki się nie rozjeżdżają.
  const bboxN = Number(url.searchParams.get('n'));
  const bboxS = Number(url.searchParams.get('s'));
  const bboxE = Number(url.searchParams.get('e'));
  const bboxW = Number(url.searchParams.get('w'));
  const hasBBox =
    Number.isFinite(bboxN) &&
    Number.isFinite(bboxS) &&
    Number.isFinite(bboxE) &&
    Number.isFinite(bboxW) &&
    bboxN > bboxS &&
    bboxE > bboxW;

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

  // length 1 = zawęź do jednego typu; length 2 (oba) = brak zawężenia (= jak nic nie zaznaczone).
  if (transakcja.length === 1) {
    andFilters.push({ transakcja: transakcja[0] });
  }

  // Filtr mediów (P10): zaznaczone medium = działka faktycznie je MA, fizycznie NA DZIAŁCE.
  // Lista dozwolonych statusów (MEDIA_AVAILABLE) jest wspólna z chipem „media" na kartach
  // (src/lib/media.ts) — jedno źródło prawdy, filtr i etykieta nigdy się nie rozjadą.
  for (const key of media) {
    if (key === 'prad') andFilters.push({ prad: { in: [...MEDIA_AVAILABLE.prad] } });
    else if (key === 'woda') andFilters.push({ woda: { in: [...MEDIA_AVAILABLE.woda] } });
    else if (key === 'kanalizacja')
      andFilters.push({ kanalizacja: { in: [...MEDIA_AVAILABLE.kanalizacja] } });
    else if (key === 'gaz') andFilters.push({ gaz: { in: [...MEDIA_AVAILABLE.gaz] } });
  }

  if (hasBBox) {
    andFilters.push({
      lat: { gte: bboxS, lte: bboxN },
      lng: { gte: bboxW, lte: bboxE },
    });
  }

  const where: Prisma.DzialkaWhereInput = {
    AND: andFilters,
  };

  // Tryb mapy: osobne, odchudzone zapytanie (jedno zdjęcie, tylko pola pod pin i popup).
  // Ta sama logika filtrów (andFilters) + ten sam kontekst dopasowania geo/tekst co lista
  // → piny na mapie pokrywają się 1:1 z wynikami listy. Bez stronicowania (wszystkie piny).
  if (mapMode) {
    const ctx = buildSearchContext(searchText, latParam, lngParam, radiusParam, hasRadiusSearch);
    const needsInfo = hasRadiusSearch || Boolean(searchText);

    const rows = await prisma.dzialka.findMany({
      where: {
        AND: [...andFilters, { lat: { not: null } }, { lng: { not: null } }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lat: true,
        lng: true,
        cenaPln: true,
        powierzchniaM2: true,
        transakcja: true,
        tytul: true,
        przeznaczenia: true,
        prad: true,
        woda: true,
        kanalizacja: true,
        gaz: true,
        isFeatured: true,
        featuredUntil: true,
        createdAt: true,
        locationLabel: true,
        locationFull: true,
        parcelText: true,
        locationMode: true,
        zdjecia: {
          take: 1,
          orderBy: { kolejnosc: 'asc' },
          select: { url: true },
        },
      },
    });

    const matched = needsInfo
      ? rows.filter((r) => getSearchMatchInfo(r, ctx).anyMatch)
      : rows;

    // Wyróżnione piny pierwsze (renderują się na wierzchu), reszta od najnowszych.
    matched.sort((a, b) => {
      const af = isFeaturedActive(a);
      const bf = isFeaturedActive(b);
      if (af !== bf) return af ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const CAP = 4000;
    const points = matched.slice(0, CAP).map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      cena: r.cenaPln,
      area: r.powierzchniaM2,
      transakcja: r.transakcja,
      tytul: r.tytul,
      przezn: r.przeznaczenia,
      featured: isFeaturedActive(r),
      thumb: r.zdjecia[0]?.url ?? null,
      loc: r.locationLabel ?? null,
      approx: r.locationMode === LocationMode.APPROX,
      prad: r.prad,
      woda: r.woda,
      kanalizacja: r.kanalizacja,
      gaz: r.gaz,
    }));

    return NextResponse.json({
      ok: true,
      total: matched.length,
      capped: matched.length > CAP,
      points,
    });
  }

  const searchContext = buildSearchContext(searchText, latParam, lngParam, radiusParam, hasRadiusSearch);
  const needsMatchInfo = hasRadiusSearch || Boolean(searchText);

  const buildMeta = (total: number) => {
    const currentPage = Math.floor(skip / take) + 1;
    const totalPages = Math.max(1, Math.ceil(total / take));
    return { page: currentPage, skip, take, totalPages, hasPrev: skip > 0, hasNext: skip + take < total };
  };

  // ŚCIEŻKA BEZ WYSZUKIWANIA (przeglądanie /kup: same filtry + sort, też bbox „w tym obszarze").
  // Dominujący ruch. Całość w bazie — filtr + sort + paginacja + count (P12) — do Node ląduje
  // tylko jedna strona, niezależnie od liczby ofert. Kolejność 1:1 z dawnym sortem JS, patrz
  // src/lib/dzialkiQuery.ts (wyróżnione-aktywne pierwsze, dla „newest" ze zdjęciami przed bez).
  if (!needsMatchInfo) {
    const { items, total } = await listDzialkiPaginated({
      andFilters,
      sort: sort as ListSort,
      skip,
      take,
    });

    return NextResponse.json({ ok: true, total, count: total, items, meta: buildMeta(total) });
  }

  // ŚCIEŻKA Z WYSZUKIWANIEM (tekst/promień): dopasowanie geo/tekst jest w JS (wspólna logika
  // src/lib/dzialkiSearch.ts — jedno źródło prawdy z alertami), więc kandydatów trzeba przejrzeć
  // w Node. ALE pobieramy tylko LEKKIE pola (bez zdjęć), rankujemy, a pełne dane + zdjęcia
  // dociągamy WYŁĄCZNIE dla zwróconej strony (≤ take). Koniec pobierania wszystkich zdjęć na raz.
  const lightRows = await prisma.dzialka.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      lat: true,
      lng: true,
      locationLabel: true,
      locationFull: true,
      parcelText: true,
      createdAt: true,
      cenaPln: true,
      powierzchniaM2: true,
      isFeatured: true,
      featuredUntil: true,
      _count: { select: { zdjecia: true } },
    },
  });

  // P3: „match info" liczone RAZ na ofertę (jeden przebieg O(n)), wyróżnione/zdjęcia policzone tu raz.
  const withInfo = lightRows.map((item) => ({
    item,
    info: getSearchMatchInfo(item, searchContext),
    featured: isFeaturedActive(item),
    photos: item._count.zdjecia > 0,
  }));

  const ranked = withInfo.filter((x) => x.info.anyMatch);

  ranked.sort((a, b) => {
    const aInfo = a.info;
    const bInfo = b.info;

    if (aInfo.group !== bInfo.group) return aInfo.group - bInfo.group;

    if (a.featured !== b.featured) return a.featured ? -1 : 1;

    switch (sort) {
      case 'oldest':
        return new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
      case 'price_asc':
        return a.item.cenaPln - b.item.cenaPln;
      case 'price_desc':
        return b.item.cenaPln - a.item.cenaPln;
      case 'area_asc':
        return a.item.powierzchniaM2 - b.item.powierzchniaM2;
      case 'area_desc':
        return b.item.powierzchniaM2 - a.item.powierzchniaM2;
      default: {
        if (a.photos !== b.photos) return a.photos ? -1 : 1;
        if (
          hasRadiusSearch &&
          aInfo.radiusDistance !== null &&
          bInfo.radiusDistance !== null
        ) {
          return aInfo.radiusDistance - bInfo.radiusDistance;
        }
        return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
      }
    }
  });

  const total = ranked.length;
  const pageIds = ranked.slice(skip, skip + take).map((x) => x.item.id);

  // Dociągamy pełne rekordy + zdjęcia tylko dla ID z bieżącej strony, w ustalonej kolejności.
  const hydrated = pageIds.length
    ? await prisma.dzialka.findMany({ where: { id: { in: pageIds } }, include: PAGE_INCLUDE })
    : [];
  const byId = new Map(hydrated.map((d) => [d.id, d]));
  const items = pageIds.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({ ok: true, total, count: total, items, meta: buildMeta(total) });
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
    transakcja,
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

  const transakcjaParsed: TransakcjaTyp =
    transakcja === 'WYNAJEM' ? TransakcjaTyp.WYNAJEM : TransakcjaTyp.SPRZEDAZ;

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
          transakcja: transakcjaParsed,
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