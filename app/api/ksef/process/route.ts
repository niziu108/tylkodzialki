import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { sendReadyInvoicesToKsef, sendSingleInvoiceToKsef } from "@/lib/ksef";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new NextResponse("Brak autoryzacji", { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return new NextResponse("Brak dostępu", { status: 403 });
  }

  let body: { invoiceId?: string; limit?: number } = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if (body.invoiceId) {
      const result = await sendSingleInvoiceToKsef(body.invoiceId);

      return NextResponse.json({
        ok: true,
        mode: "single",
        result,
      });
    }

    const results = await sendReadyInvoicesToKsef(
      Number.isFinite(body.limit) ? Number(body.limit) : 5
    );

    return NextResponse.json({
      ok: true,
      mode: "batch",
      count: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Błąd przetwarzania KSeF",
      },
      { status: 500 }
    );
  }
}