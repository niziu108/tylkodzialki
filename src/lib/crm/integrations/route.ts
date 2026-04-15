import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCrmApiKey } from "@/src/lib/crm/generateApiKey";
import { hashCrmApiKey } from "@/src/lib/crm/hashApiKey";
import { getCurrentUser } from "@/src/lib/crm/getCurrentUser";

type CreateIntegrationBody = {
  name?: string;
  provider?: "GENERIC" | "ASARI" | "ESTI_CRM" | "IMOX" | "GALACTICA";
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Brak autoryzacji." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as CreateIntegrationBody;

    const rawName = body.name?.trim();
    const name = rawName && rawName.length > 0 ? rawName : "Moja integracja CRM";
    const provider = body.provider ?? "GENERIC";

    const existing = await prisma.crmIntegration.findFirst({
      where: {
        userId: user.id,
        name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Integracja o takiej nazwie już istnieje." },
        { status: 409 }
      );
    }

    const { apiKey, apiKeyPrefix, apiKeyLast4 } = generateCrmApiKey();
    const apiKeyHash = hashCrmApiKey(apiKey);

    const integration = await prisma.crmIntegration.create({
      data: {
        userId: user.id,
        name,
        provider,
        apiKeyHash,
        apiKeyPrefix,
        apiKeyLast4,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        apiKeyPrefix: true,
        apiKeyLast4: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      integration,
      apiKey, // pokazujemy tylko teraz, w momencie tworzenia
      message:
        "Integracja CRM została utworzona. Zapisz klucz API, bo później nie będzie już widoczny w całości.",
    });
  } catch (error) {
    console.error("POST /api/crm/integrations error:", error);

    return NextResponse.json(
      { error: "Nie udało się utworzyć integracji CRM." },
      { status: 500 }
    );
  }
}