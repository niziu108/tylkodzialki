import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCrmRequest } from "@/lib/crm/authenticateCrmRequest";

type CrmDeactivateBody = {
  externalId: string;
  externalUpdatedAt?: string | null;
};

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
    const body = (await req.json()) as CrmDeactivateBody;

    if (!body.externalId?.trim()) {
      return NextResponse.json(
        { error: "Pole externalId jest wymagane." },
        { status: 400 }
      );
    }

    const now = new Date();
    const externalId = body.externalId.trim();
    const externalUpdatedAt = body.externalUpdatedAt
      ? new Date(body.externalUpdatedAt)
      : null;

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
      await prisma.crmIntegration.update({
        where: { id: integration.id },
        data: {
          lastUsedAt: now,
          lastErrorAt: now,
          lastErrorMessage: `Nie znaleziono oferty do zakończenia: ${externalId}`,
        },
      });

      await prisma.crmSyncLog.create({
        data: {
          integrationId: integration.id,
          externalId,
          action: "ERROR",
          status: "ERROR",
          message: `Nie znaleziono oferty do zakończenia: ${externalId}`,
          payload: body,
        },
      });

      return NextResponse.json(
        { error: "Nie znaleziono oferty o podanym externalId." },
        { status: 404 }
      );
    }

    if (existingLink.dzialka.status === "ZAKONCZONE") {
      await prisma.crmOfferLink.update({
        where: { id: existingLink.id },
        data: {
          externalUpdatedAt,
          lastImportedAt: now,
          lastSeenAt: now,
          lastDeactivatedAt: now,
          isActiveInSource: false,
        },
      });

      await prisma.crmIntegration.update({
        where: { id: integration.id },
        data: {
          lastUsedAt: now,
          lastSyncAt: now,
          lastSuccessAt: now,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await prisma.crmSyncLog.create({
        data: {
          integrationId: integration.id,
          dzialkaId: existingLink.dzialkaId,
          offerLinkId: existingLink.id,
          externalId,
          action: "DEACTIVATE",
          status: "SUCCESS",
          message: "Oferta była już wcześniej zakończona.",
        },
      });

      return NextResponse.json({
        success: true,
        action: "DEACTIVATE",
        alreadyEnded: true,
        dzialkaId: existingLink.dzialkaId,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.dzialka.update({
        where: {
          id: existingLink.dzialkaId,
        },
        data: {
          status: "ZAKONCZONE",
          endedAt: now,
          crmLastSyncedAt: now,
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
          lastDeactivatedAt: now,
          isActiveInSource: false,
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
          dzialkaId: existingLink.dzialkaId,
          offerLinkId: existingLink.id,
          externalId,
          action: "DEACTIVATE",
          status: "SUCCESS",
          message: "Oferta zakończona poprawnie.",
        },
      });
    });

    return NextResponse.json({
      success: true,
      action: "DEACTIVATE",
      dzialkaId: existingLink.dzialkaId,
    });
  } catch (error) {
    console.error("POST /api/crm/deactivate error:", error);

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: "Błąd serwera podczas dezaktywacji oferty CRM.",
      },
    });

    await prisma.crmSyncLog.create({
      data: {
        integrationId: integration.id,
        action: "ERROR",
        status: "ERROR",
        message: "Błąd serwera podczas dezaktywacji oferty CRM.",
      },
    });

    return NextResponse.json(
      { error: "Nie udało się zakończyć oferty CRM." },
      { status: 500 }
    );
  }
}