import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
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