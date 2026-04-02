import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/emailVerification';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ ok: false, message: 'Brak email.' }, { status: 400 });
    }

    // nie ujawniamy czy konto istnieje
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: true });

    if (user.emailVerified) return NextResponse.json({ ok: true });

    await sendVerificationEmail(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('SEND_VERIFICATION_ERROR', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}