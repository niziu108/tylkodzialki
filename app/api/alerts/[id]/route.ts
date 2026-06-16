import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

async function getOwnedAlert(id: string, userId: string) {
  const alert = await prisma.offerAlert.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!alert || alert.userId !== userId) return null;
  return alert;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: 'Brak autoryzacji.' }, { status: 401 });
  }

  const { id } = await params;
  const owned = await getOwnedAlert(id, userId);
  if (!owned) {
    return NextResponse.json({ ok: false, message: 'Nie znaleziono alertu.' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.isActive !== 'boolean') {
    return NextResponse.json({ ok: false, message: 'Brak pola isActive.' }, { status: 400 });
  }

  // Wznowienie: licznik „od teraz", żeby nie zalać maila zaległościami z okresu wstrzymania.
  const data = body.isActive
    ? { isActive: true, lastCheckedAt: new Date() }
    : { isActive: false };

  await prisma.offerAlert.update({ where: { id }, data });

  return NextResponse.json({ ok: true, isActive: body.isActive });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, message: 'Brak autoryzacji.' }, { status: 401 });
  }

  const { id } = await params;
  const owned = await getOwnedAlert(id, userId);
  if (!owned) {
    return NextResponse.json({ ok: false, message: 'Nie znaleziono alertu.' }, { status: 404 });
  }

  await prisma.offerAlert.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
