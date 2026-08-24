import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBotRequest } from "@/lib/isBotRequest";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Roboty renderujace JS podbijaly statystyki biur, wiec nie liczymy ich wcale.
    if (isBotRequest(req)) {
      return NextResponse.json({ ok: true, skipped: "bot" });
    }

    const body = await req.json().catch(() => null);
    const type = body?.type;

    if (!id) {
      return NextResponse.json({ error: "Brak ID ogłoszenia." }, { status: 400 });
    }

    if (type !== "phone" && type !== "message") {
      return NextResponse.json({ error: "Nieprawidłowy typ kliknięcia." }, { status: 400 });
    }

    const data =
      type === "phone"
        ? { phoneClicksCount: { increment: 1 } }
        : { messageClicksCount: { increment: 1 } };

    await prisma.dzialka.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("TRACK_CONTACT_ERROR", error);
    return NextResponse.json({ error: "Nie udało się zapisać kliknięcia." }, { status: 500 });
  }
}