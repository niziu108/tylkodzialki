import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Double opt-in: potwierdzenie alertu z maila (bez logowania) po tokenie.
// Ustawiamy okno „od teraz" (lastCheckedAt), żeby po potwierdzeniu nie zalać zaległościami.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim();

  if (!token) {
    return NextResponse.redirect(new URL('/alerty/potwierdzono?status=notfound', req.url), 303);
  }

  const alert = await prisma.offerAlert.findUnique({
    where: { confirmToken: token },
    select: { id: true },
  });

  if (!alert) {
    return NextResponse.redirect(new URL('/alerty/potwierdzono?status=notfound', req.url), 303);
  }

  await prisma.offerAlert.update({
    where: { id: alert.id },
    data: {
      isActive: true,
      confirmedAt: new Date(),
      confirmToken: null,
      lastCheckedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL('/alerty/potwierdzono?status=ok', req.url), 303);
}
