import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCrmRequest } from "@/lib/crm/authenticateCrmRequest";

type CrmPushPhoto = {
  url: string;
  publicId?: string;
  kolejnosc?: number;
};

type CrmPushBody = {
  externalId: string;
  tytul: string;
  opis?: string | null;
  cenaPln: number;
  powierzchniaM2: number;
  telefon: string;
  email?: string | null;

  sprzedajacyTyp?: "PRYWATNIE" | "BIURO";
  sprzedajacyImie?: string | null;
  biuroNazwa?: string | null;
  biuroOpiekun?: string | null;
  biuroLogoUrl?: string | null;

  locationLabel?: string | null;
  locationFull?: string | null;
  locationMode?: "EXACT" | "APPROX";
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  parcelText?: string | null;
  placeId?: string | null;

  przeznaczenia?: (
    | "INWESTYCYJNA"
    | "BUDOWLANA"
    | "ROLNA"
    | "LESNA"
    | "REKREACYJNA"
    | "SIEDLISKOWA"
  )[];

  prad?:
    | "BRAK_PRZYLACZA"
    | "PRZYLACZE_NA_DZIALCE"
    | "PRZYLACZE_W_DRODZE"
    | "WARUNKI_PRZYLACZENIA_WYDANE"
    | "MOZLIWOSC_PRZYLACZENIA";
  woda?:
    | "BRAK_PRZYLACZA"
    | "WODOCIAG_NA_DZIALCE"
    | "WODOCIAG_W_DRODZE"
    | "STUDNIA_GLEBINOWA"
    | "MOZLIWOSC_PODLACZENIA";
  kanalizacja?:
    | "BRAK"
    | "MIEJSKA_NA_DZIALCE"
    | "MIEJSKA_W_DRODZE"
    | "SZAMBO"
    | "PRZYDOMOWA_OCZYSZCZALNIA"
    | "MOZLIWOSC_PODLACZENIA";
  gaz?:
    | "BRAK"
    | "GAZ_NA_DZIALCE"
    | "GAZ_W_DRODZE"
    | "MOZLIWOSC_PODLACZENIA";
  swiatlowod?:
    | "BRAK"
    | "W_DRODZE"
    | "NA_DZIALCE"
    | "MOZLIWOSC_PODLACZENIA";

  mpzp?: boolean;
  wzWydane?: boolean;
  projektDomu?: boolean;
  klasaZiemi?: string | null;
  ksiegaWieczysta?: string | null;
  wymiary?: string | null;
  numerOferty?: string | null;

  externalUpdatedAt?: string | null;
  zdjecia?: CrmPushPhoto[];
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function makeEditToken() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizePhotos(photos: CrmPushPhoto[] | undefined) {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter((photo) => !!photo?.url)
    .map((photo, index) => ({
      url: photo.url,
      publicId: photo.publicId?.trim() || photo.url,
      kolejnosc:
        typeof photo.kolejnosc === "number" ? photo.kolejnosc : index,
    }));
}

function buildDzialkaData(body: CrmPushBody) {
  return {
    tytul: body.tytul,
    cenaPln: body.cenaPln,
    powierzchniaM2: body.powierzchniaM2,
    email: body.email ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    locationFull: body.locationFull ?? null,
    locationLabel: body.locationLabel ?? null,
    locationMode: body.locationMode ?? "APPROX",
    mapsUrl: body.mapsUrl ?? null,
    parcelText: body.parcelText ?? null,
    placeId: body.placeId ?? null,
    przeznaczenia:
      body.przeznaczenia && body.przeznaczenia.length > 0
        ? body.przeznaczenia
        : ["BUDOWLANA"],
    telefon: body.telefon,
    sprzedajacyImie: body.sprzedajacyImie ?? null,
    biuroNazwa: body.biuroNazwa ?? null,
    biuroOpiekun: body.biuroOpiekun ?? null,
    biuroLogoUrl: body.biuroLogoUrl ?? null,
    klasaZiemi: body.klasaZiemi ?? null,
    ksiegaWieczysta: body.ksiegaWieczysta ?? null,
    mpzp: body.mpzp ?? false,
    projektDomu: body.projektDomu ?? false,
    wymiary: body.wymiary ?? null,
    wzWydane: body.wzWydane ?? false,
    numerOferty: body.numerOferty ?? null,
    sprzedajacyTyp: body.sprzedajacyTyp ?? "BIURO",
    kanalizacja: body.kanalizacja ?? "BRAK",
    gaz: body.gaz ?? "BRAK",
    swiatlowod: body.swiatlowod ?? "BRAK",
    prad: body.prad ?? "BRAK_PRZYLACZA",
    woda: body.woda ?? "BRAK_PRZYLACZA",
    opis: body.opis ?? null,
    sourceType: "CRM" as const,
    crmImportedAt: new Date(),
    crmLastSyncedAt: new Date(),
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const integration = await authenticateCrmRequest(authHeader);

  if (!integration) {
    return NextResponse.json(
      { error: "Nieprawidłowy lub nieaktywny klucz API." },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as CrmPushBody;

    if (!body.externalId?.trim()) {
      return NextResponse.json(
        { error: "Pole externalId jest wymagane." },
        { status: 400 }
      );
    }

    if (!body.tytul?.trim()) {
      return NextResponse.json(
        { error: "Pole tytul jest wymagane." },
        { status: 400 }
      );
    }

    if (!body.telefon?.trim()) {
      return NextResponse.json(
        { error: "Pole telefon jest wymagane." },
        { status: 400 }
      );
    }

    if (
      typeof body.cenaPln !== "number" ||
      typeof body.powierzchniaM2 !== "number"
    ) {
      return NextResponse.json(
        { error: "Pola cenaPln i powierzchniaM2 muszą być liczbami." },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = addDays(now, 30);
    const externalId = body.externalId.trim();
    const externalUpdatedAt = body.externalUpdatedAt
      ? new Date(body.externalUpdatedAt)
      : null;
    const normalizedPhotos = normalizePhotos(body.zdjecia);

    const appConfig = await prisma.appConfig.findFirst();
    const paymentsEnabled = appConfig?.paymentsEnabled ?? false;

    const existingLink = await prisma.crmOfferLink.findUnique({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId,
        },
      },
      include: {
        dzialka: true,
      },
    });

    if (!existingLink) {
      const freshUser = await prisma.user.findUnique({
        where: { id: integration.userId },
        select: { id: true, listingCredits: true },
      });

      if (!freshUser) {
        return NextResponse.json(
          { error: "Nie znaleziono użytkownika integracji." },
          { status: 404 }
        );
      }

      if (paymentsEnabled && freshUser.listingCredits <= 0) {
        await prisma.crmIntegration.update({
          where: { id: integration.id },
          data: {
            lastUsedAt: now,
            lastErrorAt: now,
            lastErrorMessage: "Brak dostępnych publikacji do utworzenia oferty.",
          },
        });

        await prisma.crmSyncLog.create({
          data: {
            integrationId: integration.id,
            externalId,
            action: "SKIP_NO_CREDITS",
            status: "ERROR",
            message: "Brak dostępnych publikacji do utworzenia oferty.",
            payload: body,
          },
        });

        return NextResponse.json(
          { error: "Brak dostępnych publikacji." },
          { status: 402 }
        );
      }

      const created = await prisma.$transaction(async (tx) => {
        const dzialka = await tx.dzialka.create({
          data: {
            ...buildDzialkaData(body),
            ownerId: integration.userId,
            editToken: makeEditToken(),
            publishedAt: now,
            expiresAt,
            endedAt: null,
            status: "AKTYWNE",
            zdjecia: {
              create: normalizedPhotos,
            },
          },
        });

        const link = await tx.crmOfferLink.create({
          data: {
            integrationId: integration.id,
            dzialkaId: dzialka.id,
            externalId,
            externalUpdatedAt,
            lastImportedAt: now,
            lastSeenAt: now,
            lastPublishedAt: now,
            isActiveInSource: true,
          },
        });

        if (paymentsEnabled) {
          const updatedUser = await tx.user.update({
            where: { id: integration.userId },
            data: {
              listingCredits: {
                decrement: 1,
              },
            },
            select: {
              listingCredits: true,
            },
          });

          await tx.listingCreditTransaction.create({
            data: {
              userId: integration.userId,
              delta: -1,
              balanceAfter: updatedUser.listingCredits,
              sourceType: "CRM_PUBLICATION",
              note: `CRM publikacja oferty ${externalId}`,
            },
          });
        }

        await tx.crmIntegration.update({
          where: { id: integration.id },
          data: {
            lastUsedAt: now,
            lastSyncAt: now,
            lastSuccessAt: now,
            lastErrorAt: null,
            lastErrorMessage: null,
          },
        });

        await tx.crmSyncLog.create({
          data: {
            integrationId: integration.id,
            dzialkaId: dzialka.id,
            offerLinkId: link.id,
            externalId,
            action: "CREATE",
            status: "SUCCESS",
            message: "Oferta utworzona poprawnie.",
          },
        });

        return dzialka;
      });

      return NextResponse.json({
        success: true,
        action: "CREATE",
        dzialkaId: created.id,
      });
    }

    const isEnded = existingLink.dzialka.status === "ZAKONCZONE";

    if (isEnded) {
      const freshUser = await prisma.user.findUnique({
        where: { id: integration.userId },
        select: { id: true, listingCredits: true },
      });

      if (!freshUser) {
        return NextResponse.json(
          { error: "Nie znaleziono użytkownika integracji." },
          { status: 404 }
        );
      }

      if (paymentsEnabled && freshUser.listingCredits <= 0) {
        await prisma.crmIntegration.update({
          where: { id: integration.id },
          data: {
            lastUsedAt: now,
            lastErrorAt: now,
            lastErrorMessage:
              "Brak dostępnych publikacji do reaktywacji oferty.",
          },
        });

        await prisma.crmSyncLog.create({
          data: {
            integrationId: integration.id,
            dzialkaId: existingLink.dzialkaId,
            offerLinkId: existingLink.id,
            externalId,
            action: "SKIP_NO_CREDITS",
            status: "ERROR",
            message: "Brak dostępnych publikacji do reaktywacji oferty.",
            payload: body,
          },
        });

        return NextResponse.json(
          { error: "Brak dostępnych publikacji do reaktywacji oferty." },
          { status: 402 }
        );
      }

      const reactivated = await prisma.$transaction(async (tx) => {
        await tx.zdjecie.deleteMany({
          where: {
            dzialkaId: existingLink.dzialkaId,
          },
        });

        const dzialka = await tx.dzialka.update({
          where: {
            id: existingLink.dzialkaId,
          },
          data: {
            ...buildDzialkaData(body),
            publishedAt: now,
            expiresAt,
            endedAt: null,
            status: "AKTYWNE",
            zdjecia: {
              create: normalizedPhotos,
            },
          },
        });

        await tx.crmOfferLink.update({
          where: {
            id: existingLink.id,
          },
          data: {
            externalUpdatedAt,
            lastImportedAt: now,
            lastSeenAt: now,
            lastPublishedAt: now,
            isActiveInSource: true,
          },
        });

        if (paymentsEnabled) {
          const updatedUser = await tx.user.update({
            where: { id: integration.userId },
            data: {
              listingCredits: {
                decrement: 1,
              },
            },
            select: {
              listingCredits: true,
            },
          });

          await tx.listingCreditTransaction.create({
            data: {
              userId: integration.userId,
              delta: -1,
              balanceAfter: updatedUser.listingCredits,
              sourceType: "CRM_PUBLICATION",
              note: `CRM reaktywacja oferty ${externalId}`,
            },
          });
        }

        await tx.crmIntegration.update({
          where: { id: integration.id },
          data: {
            lastUsedAt: now,
            lastSyncAt: now,
            lastSuccessAt: now,
            lastErrorAt: null,
            lastErrorMessage: null,
          },
        });

        await tx.crmSyncLog.create({
          data: {
            integrationId: integration.id,
            dzialkaId: dzialka.id,
            offerLinkId: existingLink.id,
            externalId,
            action: "REACTIVATE",
            status: "SUCCESS",
            message: "Oferta reaktywowana poprawnie.",
          },
        });

        return dzialka;
      });

      return NextResponse.json({
        success: true,
        action: "REACTIVATE",
        dzialkaId: reactivated.id,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.zdjecie.deleteMany({
        where: {
          dzialkaId: existingLink.dzialkaId,
        },
      });

      const dzialka = await tx.dzialka.update({
        where: {
          id: existingLink.dzialkaId,
        },
        data: {
          ...buildDzialkaData(body),
          zdjecia: {
            create: normalizedPhotos,
          },
        },
      });

      await tx.crmOfferLink.update({
        where: {
          id: existingLink.id,
        },
        data: {
          externalUpdatedAt,
          lastImportedAt: now,
          lastSeenAt: now,
          isActiveInSource: true,
        },
      });

      await tx.crmIntegration.update({
        where: { id: integration.id },
        data: {
          lastUsedAt: now,
          lastSyncAt: now,
          lastSuccessAt: now,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await tx.crmSyncLog.create({
        data: {
          integrationId: integration.id,
          dzialkaId: dzialka.id,
          offerLinkId: existingLink.id,
          externalId,
          action: "UPDATE",
          status: "SUCCESS",
          message: "Oferta zaktualizowana poprawnie.",
        },
      });

      return dzialka;
    });

    return NextResponse.json({
      success: true,
      action: "UPDATE",
      dzialkaId: updated.id,
    });
  } catch (error) {
    console.error("POST /api/crm/push error:", error);

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: "Błąd serwera podczas obsługi push CRM.",
      },
    });

    await prisma.crmSyncLog.create({
      data: {
        integrationId: integration.id,
        action: "ERROR",
        status: "ERROR",
        message: "Błąd serwera podczas obsługi push CRM.",
      },
    });

    return NextResponse.json(
      { error: "Nie udało się obsłużyć push CRM." },
      { status: 500 }
    );
  }
}