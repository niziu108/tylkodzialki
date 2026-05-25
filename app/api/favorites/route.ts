import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ favoriteIds: [] }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids.length) {
    return NextResponse.json({ favoriteIds: [] }, { status: 200 });
  }

  const favorites = await prisma.favoriteDzialka.findMany({
    where: {
      userId,
      dzialkaId: { in: ids },
    },
    select: { dzialkaId: true },
  });

  return NextResponse.json({
    favoriteIds: favorites.map((f) => f.dzialkaId),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, message: 'Musisz się zalogować.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const dzialkaId = typeof body?.dzialkaId === 'string' ? body.dzialkaId : '';

  if (!dzialkaId) {
    return NextResponse.json({ ok: false, message: 'Brak ID działki.' }, { status: 400 });
  }

  const dzialkaExists = await prisma.dzialka.findFirst({
    where: {
      id: dzialkaId,
      status: 'AKTYWNE',
    },
    select: { id: true },
  });

  if (!dzialkaExists) {
    return NextResponse.json({ ok: false, message: 'Oferta nie istnieje.' }, { status: 404 });
  }

  const existing = await prisma.favoriteDzialka.findUnique({
    where: {
      userId_dzialkaId: {
        userId,
        dzialkaId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.favoriteDzialka.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true, isFavorite: false });
  }

  await prisma.favoriteDzialka.create({
    data: {
      userId,
      dzialkaId,
    },
  });

  return NextResponse.json({ ok: true, isFavorite: true });
}
