import { NextResponse } from "next/server";
import { takeDailyStatsSnapshot } from "@/lib/biuroStats";
import { takeDailyCityPriceSnapshot } from "@/lib/cityPriceStats";

// P16 (fundament raportu leadów): dzienny snapshot kumulacyjnych liczników per biuro.
// Wzorzec jak /api/cron/alert-emails — chroniony CRON_SECRET, wołany z systemowego crona na VPS.
// WYMAGA wpisu w cronie (raz dziennie, najlepiej PO synchronizacji CRM, np. po 20:00),
// inaczej snapshoty się nie zapisują i okna czasu / wykresy nie mają z czego liczyć.

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

    const result = await takeDailyStatsSnapshot();

    // Trend cen per miasto — niezależnie od snapshotu biur: błąd tu (np. brak tabeli przed
    // migracją) nie może wywrócić snapshotu leadów, który jest fundamentem raportu.
    let cityPrices: unknown;
    try {
      cityPrices = await takeDailyCityPriceSnapshot();
    } catch (e) {
      console.error("CRON_CITY_PRICE_SNAPSHOT_ERROR", e);
      cityPrices = { ok: false };
    }

    return NextResponse.json({ ...result, cityPrices });
  } catch (e) {
    console.error("CRON_STATS_SNAPSHOT_ERROR", e);
    return NextResponse.json(
      { ok: false, message: "Błąd podczas zapisu snapshotu statystyk." },
      { status: 500 }
    );
  }
}
