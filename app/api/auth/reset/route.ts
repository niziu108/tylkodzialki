import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/passwordReset";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token || !password) {
      return NextResponse.json(
        { ok: false, message: "Brak tokenu lub hasła." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "Hasło musi mieć minimum 6 znaków." },
        { status: 400 }
      );
    }

    const result = await resetPassword(token, password);

    if (!result.ok) {
      if (result.code === "EXPIRED_TOKEN") {
        return NextResponse.json(
          { ok: false, message: "Link do resetu hasła wygasł." },
          { status: 400 }
        );
      }

      if (result.code === "PASSWORD_TOO_SHORT") {
        return NextResponse.json(
          { ok: false, message: "Hasło musi mieć minimum 6 znaków." },
          { status: 400 }
        );
      }

      if (result.code === "USER_NOT_FOUND") {
        return NextResponse.json(
          { ok: false, message: "Nie znaleziono użytkownika dla tego resetu hasła." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { ok: false, message: "Token resetu hasła jest nieprawidłowy." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("RESET_PASSWORD_ERROR", e);
    return NextResponse.json(
      { ok: false, message: "Wystąpił błąd serwera." },
      { status: 500 }
    );
  }
}