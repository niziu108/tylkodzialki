import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Wypis jednym kliknięciem z maila (bez logowania) — identyfikacja po tokenie.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim();

  if (!token) {
    return NextResponse.redirect(new URL('/alerty/wypisano?status=notfound', req.url), 303);
  }

  const alert = await prisma.offerAlert.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, isActive: true },
  });

  if (!alert) {
    return NextResponse.redirect(new URL('/alerty/wypisano?status=notfound', req.url), 303);
  }

  if (alert.isActive) {
    await prisma.offerAlert.update({
      where: { id: alert.id },
      data: { isActive: false },
    });
  }

  return NextResponse.redirect(new URL('/alerty/wypisano?status=ok', req.url), 303);
}
