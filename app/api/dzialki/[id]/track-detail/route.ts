import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBotRequest } from '@/lib/isBotRequest';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Roboty renderujace JS podbijaly statystyki biur, wiec nie liczymy ich wcale.
    if (isBotRequest(req)) {
      return NextResponse.json({ ok: true, skipped: 'bot' });
    }

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Brak id ogłoszenia' },
        { status: 400 }
      );
    }

    const updated = await prisma.dzialka.update({
      where: { id },
      data: {
        detailViewsCount: {
          increment: 1,
        },
      },
      select: {
        id: true,
        detailViewsCount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      id: updated.id,
      detailViewsCount: updated.detailViewsCount,
    });
  } catch (error) {
    console.error('track-detail error:', error);

    return NextResponse.json(
      { ok: false, error: 'Nie udało się zapisać wejścia w ogłoszenie' },
      { status: 500 }
    );
  }
}