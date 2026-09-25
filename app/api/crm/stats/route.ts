import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCrmRequest } from "@/lib/crm/authenticateCrmRequest";
import { getBiuroDailySeries } from "@/lib/biuroStats";

// Statystyki ofert dla biura przez API (klucz CRM w nagłówku Authorization: Bearer TDCRM_...).
// Tylko odczyt i tylko oferty właściciela klucza: te same liczby, które biuro widzi w panelu
// w zakładce „Statystyki". Liczniki ofert są kumulacyjne (od publikacji), przyrosty dzienne
// są per biuro, bo per oferta nie trzymamy historii dziennej.

const SITE_URL = "https://tylkodzialki.pl";
const MAX_DAYS = 365;
const ENDED_LOOKBACK_DAYS = 90;

export async function GET(req: NextRequest) {
  const integration = await authenticateCrmRequest(req.headers.get("authorization"));

  if (!integration) {
    return NextResponse.json(
      { error: "Nieprawidłowy lub nieaktywny klucz API." },
      { status: 401 }
    );
  }

  try {
    const daysParam = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const days = Number.isFinite(daysParam)
      ? Math.min(MAX_DAYS, Math.max(1, Math.round(daysParam)))
      : 30;

    const userId = integration.userId;
    const endedSince = new Date(Date.now() - ENDED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const [series, dzialki] = await Promise.all([
      getBiuroDailySeries(userId, days),
      prisma.dzialka.findMany({
        where: {
          ownerId: userId,
          OR: [{ status: "AKTYWNE" }, { endedAt: { gte: endedSince } }],
        },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          tytul: true,
          numerOferty: true,
          status: true,
          publishedAt: true,
          endedAt: true,
          viewsCount: true,
          detailViewsCount: true,
          phoneClicksCount: true,
          messageClicksCount: true,
          crmOfferLinks: { select: { externalId: true }, take: 1 },
        },
      }),
    ]);

    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      days,
      totals: {
        allTime: series.allTime,
        window: series.windowTotals,
      },
      daily: series.points,
      offers: dzialki.map((d) => ({
        id: d.id,
        externalId: d.crmOfferLinks[0]?.externalId ?? null,
        numerOferty: d.numerOferty,
        title: d.tytul,
        url: `${SITE_URL}/dzialka/${d.id}`,
        status: d.status === "AKTYWNE" ? "active" : "ended",
        publishedAt: d.publishedAt.toISOString(),
        endedAt: d.endedAt?.toISOString() ?? null,
        views: d.viewsCount,
        detailViews: d.detailViewsCount,
        phoneClicks: d.phoneClicksCount,
        messageClicks: d.messageClicksCount,
      })),
    });
  } catch (err) {
    console.error("CRM_STATS_ERROR", err);
    return NextResponse.json({ error: "Błąd pobierania statystyk." }, { status: 500 });
  }
}
