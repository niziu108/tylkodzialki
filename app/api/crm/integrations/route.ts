import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/crm/getCurrentUser";

type CreateIntegrationBody = {
  name?: string;
  provider?: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const existingAny = await prisma.crmIntegration.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (existingAny) {
      return NextResponse.json(
        { error: "To konto ma już utworzoną integrację CRM." },
        { status: 409 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as CreateIntegrationBody;

    const rawName = body.name?.trim();
    const name =
      rawName && rawName.length > 0 ? rawName : "Galactica / DOMY.PL / FTP";

    const provider = body.provider ?? "GALACTICA";

    const integration = await prisma.crmIntegration.create({
      data: {
        userId: user.id,
        name,
        provider,
        isActive: true,
        transportType: "FTP",
        feedFormat: "DOMY_PL",
        ftpPort: 21,
        ftpPassive: true,
        expectedFilePattern: "oferty_*.zip",
        fullImportMode: true,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        transportType: true,
        feedFormat: true,
        ftpHost: true,
        ftpPort: true,
        ftpUsername: true,
        ftpRemotePath: true,
        ftpPassive: true,
        expectedFilePattern: true,
        fullImportMode: true,
        lastUsedAt: true,
        lastSyncAt: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        lastImportedOffers: true,
        lastCreatedCount: true,
        lastUpdatedCount: true,
        lastDeactivatedCount: true,
        lastSkippedCount: true,
        lastErrorCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      integration,
      message: "Integracja FTP / XML DOMY.PL została utworzona.",
    });
  } catch (error) {
    console.error("POST /api/crm/integrations error:", error);

    return NextResponse.json(
      { error: "Nie udało się utworzyć integracji CRM." },
      { status: 500 }
    );
  }
}