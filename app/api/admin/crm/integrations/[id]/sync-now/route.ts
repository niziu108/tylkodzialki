import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = "nodejs";

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

export async function POST(_req: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Brak uprawnień administratora." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const integrationId = id?.trim();

    if (!integrationId) {
      return NextResponse.json(
        { error: "Brak id integracji." },
        { status: 400 }
      );
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { id: integrationId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Nie znaleziono integracji." },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        { error: "Integracja jest nieaktywna." },
        { status: 400 }
      );
    }

    const existingRunningJob = await prisma.crmImportJob.findFirst({
      where: {
        integrationId,
        status: {
          in: ["PENDING", "RUNNING"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingRunningJob) {
      return NextResponse.json({
        success: true,
        jobId: existingRunningJob.id,
        message:
          "Synchronizacja jest już w kolejce albo właśnie trwa. Nie utworzono drugiego zadania.",
      });
    }

    const job = await prisma.crmImportJob.create({
      data: {
        integrationId,
        status: "PENDING",
        message: "Zadanie importu CRM zostało utworzone.",
      },
    });

    await prisma.crmIntegration.update({
      where: { id: integrationId },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message:
        "Import CRM został dodany do kolejki. Teraz uruchom worker poza Vercel.",
    });
  } catch (error) {
    console.error("POST /api/admin/crm/integrations/[id]/sync-now error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się utworzyć zadania synchronizacji.",
      },
      { status: 500 }
    );
  }
}