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
export const maxDuration = 300;

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
      return NextResponse.json({ error: "Brak uprawnień administratora." }, { status: 403 });
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json({ error: "Brak id integracji." }, { status: 400 });
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { id: id.trim() },
      select: { id: true },
    });

    if (!integration) {
      return NextResponse.json({ error: "Nie znaleziono integracji." }, { status: 404 });
    }

    const summary = await syncCrmIntegrationNow(integration.id);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("POST /api/admin/crm/integrations/[id]/sync-now error:", error);

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