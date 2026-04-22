import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Brak autoryzacji." },
        { status: 401 }
      );
    }

    const integrationId = req.nextUrl.searchParams.get("integrationId")?.trim() || null;

    if (!integrationId) {
      return NextResponse.json({
        success: true,
        logs: [],
      });
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { id: integrationId },
      select: { id: true },
    });

    if (!integration?.id) {
      return NextResponse.json({
        success: true,
        logs: [],
      });
    }

    const logs = await prisma.crmSyncLog.findMany({
      where: { integrationId: integration.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        externalId: true,
        action: true,
        status: true,
        message: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("GET /api/admin/crm/logs error:", error);

    return NextResponse.json(
      { error: "Nie udało się pobrać logów CRM." },
      { status: 500 }
    );
  }
}