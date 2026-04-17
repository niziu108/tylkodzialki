import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { generateCrmApiKey } from "@/lib/crm/generateApiKey";
import { hashCrmApiKey } from "@/lib/crm/hashApiKey";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Nie znaleziono użytkownika" },
        { status: 404 }
      );
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: "Brak id integracji" },
        { status: 400 }
      );
    }

    const integration = await prisma.crmIntegration.findFirst({
      where: {
        id: id.trim(),
        userId: user.id,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Nie znaleziono integracji" },
        { status: 404 }
      );
    }

    const generated = generateCrmApiKey();
    const apiKeyHash = hashCrmApiKey(generated.apiKey);

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        apiKeyHash,
        apiKeyPrefix: generated.apiKeyPrefix,
        apiKeyLast4: generated.apiKeyLast4,
      },
    });

    return NextResponse.json({
      success: true,
      apiKey: generated.apiKey,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Błąd regeneracji klucza" },
      { status: 500 }
    );
  }
}