import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateIntegrationBody = {
  name?: string;
  provider?: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
  isActive?: boolean;
  ftpHost?: string | null;
  ftpPort?: number | null;
  ftpUsername?: string | null;
  ftpPassword?: string | null;
  ftpRemotePath?: string | null;
  ftpPassive?: boolean;
  expectedFilePattern?: string | null;
  fullImportMode?: boolean;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Brak id integracji." },
        { status: 400 }
      );
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { id: id.trim() },
      select: { id: true },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Nie znaleziono integracji." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as UpdateIntegrationBody;

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Nazwa integracji nie może być pusta." },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body.provider) data.provider = body.provider;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    if (typeof body.ftpHost === "string" || body.ftpHost === null) {
      data.ftpHost = body.ftpHost?.trim() || null;
    }

    if (typeof body.ftpPort === "number" || body.ftpPort === null) {
      if (body.ftpPort !== null && (body.ftpPort < 1 || body.ftpPort > 65535)) {
        return NextResponse.json(
          { error: "Port FTP musi być liczbą od 1 do 65535." },
          { status: 400 }
        );
      }
      data.ftpPort = body.ftpPort;
    }

    if (typeof body.ftpUsername === "string" || body.ftpUsername === null) {
      data.ftpUsername = body.ftpUsername?.trim() || null;
    }

    if (typeof body.ftpPassword === "string") {
      const trimmed = body.ftpPassword.trim();
      if (trimmed.length > 0) {
        data.ftpPassword = trimmed;
      }
    }

    if (typeof body.ftpRemotePath === "string" || body.ftpRemotePath === null) {
      data.ftpRemotePath = body.ftpRemotePath?.trim() || null;
    }

    if (typeof body.ftpPassive === "boolean") {
      data.ftpPassive = body.ftpPassive;
    }

    if (
      typeof body.expectedFilePattern === "string" ||
      body.expectedFilePattern === null
    ) {
      data.expectedFilePattern = body.expectedFilePattern?.trim() || null;
    }

    if (typeof body.fullImportMode === "boolean") {
      data.fullImportMode = body.fullImportMode;
    }

    const updated = await prisma.crmIntegration.update({
      where: { id: integration.id },
      data,
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
      integration: updated,
      message: "Konfiguracja integracji została zapisana.",
    });
  } catch (error) {
    console.error("PATCH /api/admin/crm/integrations/[id] error:", error);

    return NextResponse.json(
      { error: "Nie udało się zapisać integracji CRM." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Brak id integracji." },
        { status: 400 }
      );
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { id: id.trim() },
      select: { id: true },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Nie znaleziono integracji." },
        { status: 404 }
      );
    }

    await prisma.crmIntegration.delete({
      where: {
        id: integration.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Integracja CRM została usunięta.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/crm/integrations/[id] error:", error);

    return NextResponse.json(
      { error: "Nie udało się usunąć integracji CRM." },
      { status: 500 }
    );
  }
}