import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { syncCrmIntegrationNow } from "@/lib/crm/domypl-sync";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = "nodejs";

export async function POST(_req: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
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

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Brak id integracji." },
        { status: 400 }
      );
    }

    const integration = await prisma.crmIntegration.findFirst({
      where: {
        id: id.trim(),
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Nie znaleziono integracji." },
        { status: 404 }
      );
    }

    const summary = await syncCrmIntegrationNow(integration.id);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("POST /api/crm/integrations/[id]/sync-now error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się uruchomić synchronizacji.",
      },
      { status: 500 }
    );
  }
}