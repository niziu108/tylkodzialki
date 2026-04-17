import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { generateCrmApiKey } from "@/lib/crm/generateApiKey";
import { hashCrmApiKey } from "@/lib/crm/hashApiKey";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const integration = await prisma.crmIntegration.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Nie znaleziono integracji" },
        { status: 404 }
      );
    }

    const apiKey = generateCrmApiKey();
    const apiKeyHash = hashCrmApiKey(apiKey);

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: {
        apiKeyHash,
        apiKeyPrefix: apiKey.slice(0, 12),
        apiKeyLast4: apiKey.slice(-4),
      },
    });

    return NextResponse.json({
      success: true,
      apiKey,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Błąd regeneracji klucza" },
      { status: 500 }
    );
  }
}