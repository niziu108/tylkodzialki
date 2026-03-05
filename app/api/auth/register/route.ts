import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = (body?.email ?? "").toString().toLowerCase().trim();
    const password = (body?.password ?? "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, code: "INVALID", message: "Podaj email i hasło." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, code: "WEAK_PASSWORD", message: "Hasło musi mieć minimum 6 znaków." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_EXISTS",
          message: "Konto z tym emailem już istnieje. Zaloguj się.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e) {
    console.error("REGISTER_ERROR", e);
    return NextResponse.json(
      { ok: false, code: "SERVER", message: "Błąd serwera przy rejestracji." },
      { status: 500 }
    );
  }
}