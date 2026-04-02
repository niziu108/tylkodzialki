import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Brak id ogłoszenia' },
        { status: 400 }
      );
    }

    const updated = await prisma.dzialka.update({
      where: { id },
      data: {
        viewsCount: {
          increment: 1,
        },
      },
      select: {
        id: true,
        viewsCount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      id: updated.id,
      viewsCount: updated.viewsCount,
    });
  } catch (error) {
    console.error('track-view error:', error);

    return NextResponse.json(
      { ok: false, error: 'Nie udało się zapisać wyświetlenia ogłoszenia' },
      { status: 500 }
    );
  }
}