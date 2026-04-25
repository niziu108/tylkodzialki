import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Brak ID.' }, { status: 400 });
    }

    const item = await prisma.dzialka.findUnique({
      where: { id },
      include: {
        zdjecia: { orderBy: { kolejnosc: 'asc' } },
        owner: {
          select: {
            defaultBiuroLogoUrl: true,
            defaultBiuroNazwa: true,
            defaultBiuroOpiekun: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Nie znaleziono ogłoszenia.' }, { status: 404 });
    }

    return NextResponse.json({
      ...item,
      biuroLogoUrl: item.biuroLogoUrl || item.owner?.defaultBiuroLogoUrl || null,
      biuroNazwa: item.biuroNazwa || item.owner?.defaultBiuroNazwa || null,
      biuroOpiekun: item.biuroOpiekun || item.owner?.defaultBiuroOpiekun || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Błąd serwera.' },
      { status: 500 }
    );
  }
}