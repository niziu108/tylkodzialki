import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json(
        { error: "Brak autoryzacji." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user?.id) {
      return NextResponse.json(
        { error: "Nie znaleziono użytkownika." },
        { status: 404 }
      );
    }

    const integration = await prisma.crmIntegration.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
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
      take: 20,
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
    console.error("GET /api/crm/logs error:", error);

    return NextResponse.json(
      { error: "Nie udało się pobrać logów CRM." },
      { status: 500 }
    );
  }
}