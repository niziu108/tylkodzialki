import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'Brak autoryzacji.' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        listingCredits: true,
        listingCreditsExpiresAt: true,
        featuredCredits: true,
        featuredCreditsExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Nie znaleziono użytkownika.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, credits: user });
  } catch (e) {
    console.error('USER_CREDITS_ERROR', e);
    return NextResponse.json(
      { ok: false, message: 'Błąd serwera.', error: e instanceof Error ? e.message : 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}
