import { NextResponse } from "next/server";
import { sendMonthlyReminders } from "@/lib/reminderEmails";

function isAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const bearer = req.headers.get("authorization");
  const xSecret = req.headers.get("x-cron-secret");

  if (bearer === `Bearer ${expected}`) return true;
  if (xSecret === expected) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, message: "Brak autoryzacji." },
        { status: 401 }
      );
    }

    const result = await sendMonthlyReminders();

    return NextResponse.json(result);
  } catch (e) {
    console.error("CRON_REMINDER_ERROR", e);
    return NextResponse.json(
      { ok: false, message: "Błąd podczas wysyłki reminderów." },
      { status: 500 }
    );
  }
}