import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function baseUrl() {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) return NextResponse.redirect(`${baseUrl()}/auth?verified=0`);

    const row = await prisma.verificationToken.findUnique({ where: { token } });
    if (!row) return NextResponse.redirect(`${baseUrl()}/auth?verified=0`);

    if (row.expires.getTime() < Date.now()) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.redirect(`${baseUrl()}/auth?verified=0`);
    }

    // ustawiamy verified
    await prisma.user.update({
      where: { email: row.identifier },
      data: { emailVerified: new Date() },
    });

    // sprzątamy tokeny dla email
    await prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } });

    return NextResponse.redirect(`${baseUrl()}/auth?verified=1`);
  } catch (e) {
    console.error('VERIFY_EMAIL_ERROR', e);
    return NextResponse.redirect(`${baseUrl()}/auth?verified=0`);
  }
}