import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requestPasswordReset } from '@/lib/passwordReset';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ ok: false, message: 'Podaj email.' }, { status: 400 });
    }

    // nie zdradzamy czy konto istnieje
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: true });

    await requestPasswordReset(email);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('FORGOT_ERROR', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}