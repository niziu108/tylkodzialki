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

// „Synchronizuj teraz" z panelu biura tylko dodaje zadanie do kolejki workera (VPS), tak jak trasa
// admina. Wcześniej uruchamiała silnik wprost na Vercelu, bez sprawdzenia, czy worker nie przerabia
// tej samej integracji. Dwa równoległe przebiegi kasują sobie nawzajem świeżo wgrane zdjęcia z R2
// (strażnik photosUnchanged potem ich nie odtworzy), wygaszają oferty utworzone przez drugi przebieg
// i sprzątają FTP pod nogami drugiego. Do tego limit czasu funkcji Vercela przerywał import w połowie.
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

    const existingJob = await prisma.crmImportJob.findFirst({
      where: {
        integrationId: integration.id,
        status: { in: ["PENDING", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingJob) {
      return NextResponse.json({
        success: true,
        jobId: existingJob.id,
        message:
          "Synchronizacja jest już w kolejce albo właśnie trwa. Wyniki pojawią się w logach poniżej.",
      });
    }

    const job = await prisma.crmImportJob.create({
      data: {
        integrationId: integration.id,
        status: "PENDING",
        message: "Synchronizacja zlecona z panelu biura.",
      },
      select: { id: true },
    });

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message:
        "Synchronizacja dodana do kolejki. Wyniki pojawią się w logach poniżej po jej zakończeniu.",
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
