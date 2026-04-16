import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type {
  GazStatus,
  KanalizacjaStatus,
  LocationMode,
  PradStatus,
  Przeznaczenie,
  SprzedajacyTyp,
  SwiatlowodStatus,
  WodaStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateCrmRequest } from "@/lib/crm/authenticateCrmRequest";

type CrmPushPhoto = {
  url: string;
  publicId?: string;
  kolejnosc?: number;
};

type CrmPushBody = {
  externalId: string;
  crmOfferType?: "DZIALKA" | "DOM" | "MIESZKANIE" | "LOKAL" | "INNE";

  tytul: string;
  opis?: string | null;
  cenaPln: number;
  powierzchniaM2: number;
  telefon: string;
  email?: string | null;

  sprzedajacyTyp?: SprzedajacyTyp;
  sprzedajacyImie?: string | null;
  biuroNazwa?: string | null;
  biuroOpiekun?: string | null;
  biuroLogoUrl?: string | null;

  locationLabel?: string | null;
  locationFull?: string | null;
  locationMode?: LocationMode;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  parcelText?: string | null;
  placeId?: string | null;

  przeznaczenia?: Przeznaczenie[];

  prad?: PradStatus;
  woda?: WodaStatus;
  kanalizacja?: KanalizacjaStatus;
  gaz?: GazStatus;
  swiatlowod?: SwiatlowodStatus;

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

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizePhotos(photos: CrmPushPhoto[] | undefined) {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter((photo) => !!photo?.url && isValidHttpUrl(photo.url))
    .slice(0, 30)
    .map((photo, index) => ({
      url: photo.url,
      publicId: photo.publicId?.trim() || photo.url,
      kolejnosc:
        typeof photo.kolejnosc === "number" ? photo.kolejnosc : index,
    }));
}

function buildDzialkaData(body: CrmPushBody) {
  const przeznaczenia: Przeznaczenie[] =
    body.przeznaczenia && body.przeznaczenia.length > 0
      ? body.przeznaczenia
      : ["BUDOWLANA"];

  return {
    tytul: body.tytul.trim(),
    cenaPln: body.cenaPln,
    powierzchniaM2: body.powierzchniaM2,
    email: body.email?.trim() || null,
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
    locationFull: body.locationFull?.trim() || null,
    locationLabel: body.locationLabel?.trim() || null,
    locationMode: (body.locationMode ?? "APPROX") as LocationMode,
    mapsUrl: body.mapsUrl?.trim() || null,
    parcelText: body.parcelText?.trim() || null,
    placeId: body.placeId?.trim() || null,
    przeznaczenia,
    telefon: body.telefon.trim(),
    sprzedajacyImie: body.sprzedajacyImie?.trim() || null,
    biuroNazwa: body.biuroNazwa?.trim() || null,
    biuroOpiekun: body.biuroOpiekun?.trim() || null,
    biuroLogoUrl: body.biuroLogoUrl?.trim() || null,
    klasaZiemi: body.klasaZiemi?.trim() || null,
    ksiegaWieczysta: body.ksiegaWieczysta?.trim() || null,
    mpzp: body.mpzp ?? false,
    projektDomu: body.projektDomu ?? false,
    wymiary: body.wymiary?.trim() || null,
    wzWydane: body.wzWydane ?? false,
    numerOferty: body.numerOferty?.trim() || null,
    sprzedajacyTyp: (body.sprzedajacyTyp ?? "BIURO") as SprzedajacyTyp,
    kanalizacja: (body.kanalizacja ?? "BRAK") as KanalizacjaStatus,
    gaz: (body.gaz ?? "BRAK") as GazStatus,
    swiatlowod: (body.swiatlowod ?? "BRAK") as SwiatlowodStatus,
    prad: (body.prad ?? "BRAK_PRZYLACZA") as PradStatus,
    woda: (body.woda ?? "BRAK_PRZYLACZA") as WodaStatus,
    opis: body.opis?.trim() || null,
    sourceType: "CRM" as const,
    crmImportedAt: new Date(),
    crmLastSyncedAt: new Date(),
  };
}

function validateBody(body: CrmPushBody) {
  if (!body.externalId?.trim()) {
    return "Pole externalId jest wymagane.";
  }

  if (body.externalId.trim().length > 120) {
    return "Pole externalId jest za długie.";
  }

  if (body.crmOfferType && body.crmOfferType !== "DZIALKA") {
    return "Integracja przyjmuje tylko oferty typu DZIALKA.";
  }

  if (!body.tytul?.trim()) {
    return "Pole tytul jest wymagane.";
  }

  if (body.tytul.trim().length < 5) {
    return "Tytuł oferty jest zbyt krótki.";
  }

  if (body.tytul.trim().length > 160) {
    return "Tytuł oferty jest zbyt długi.";
  }

  if (!body.telefon?.trim()) {
    return "Pole telefon jest wymagane.";
  }

  const phoneDigits = body.telefon.replace(/\D/g, "");
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    return "Pole telefon ma nieprawidłowy format.";
  }

  if (typeof body.cenaPln !== "number" || Number.isNaN(body.cenaPln)) {
    return "Pole cenaPln musi być liczbą.";
  }

  if (body.cenaPln < 0) {
    return "Pole cenaPln nie może być ujemne.";
  }

  if (
    typeof body.powierzchniaM2 !== "number" ||
    Number.isNaN(body.powierzchniaM2)
  ) {
    return "Pole powierzchniaM2 musi być liczbą.";
  }

  if (body.powierzchniaM2 <= 0) {
    return "Pole powierzchniaM2 musi być większe od zera.";
  }

  if (!body.przeznaczenia || body.przeznaczenia.length === 0) {
    return "Pole przeznaczenia jest wymagane w integracji CRM.";
  }

  if (body.zdjecia && body.zdjecia.length > 30) {
    return "Można przesłać maksymalnie 30 zdjęć.";
  }

  if (body.mapsUrl && !isValidHttpUrl(body.mapsUrl)) {
    return "mapsUrl musi być poprawnym adresem http lub https.";
  }

  if (body.biuroLogoUrl && !isValidHttpUrl(body.biuroLogoUrl)) {
    return "biuroLogoUrl musi być poprawnym adresem http lub https.";
  }

  if (body.email && !body.email.includes("@")) {
    return "Pole email ma nieprawidłowy format.";
  }

  return null;
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
    const validationError = validateBody(body);

    if (validationError) {
      await prisma.crmIntegration.update({
        where: { id: integration.id },
        data: {
          lastUsedAt: new Date(),
          lastErrorAt: new Date(),
          lastErrorMessage: validationError,
        },
      });

      await prisma.crmSyncLog.create({
        data: {
          integrationId: integration.id,
          externalId: body?.externalId?.trim() || null,
          action: "ERROR",
          status: "ERROR",
          message: validationError,
          payload: body,
        },
      });

      return NextResponse.json({ error: validationError }, { status: 400 });
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
          dzialkaId: updated?.id ?? existingLink.dzialkaId,
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