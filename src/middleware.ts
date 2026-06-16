import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function isProtectedPath(pathname: string) {
  // /sprzedaj jest celowo PUBLICZNE — formularz wypełnia się bez logowania,
  // a konto zakłada się dopiero przy publikacji (patrz DzialkaForm: 401 -> /auth -> autopublish).
  return pathname.startsWith('/panel') || pathname.startsWith('/admin');
}

function isAdminPath(pathname: string) {
  return pathname.startsWith('/admin');
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // nie ruszamy nextowych zasobów ani API
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('callbackUrl', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // admin (na start allowlist przez ENV)
  if (isAdminPath(pathname)) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const userEmail = (token as any)?.email as string | undefined;

    if (adminEmail && userEmail && userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
      const url = req.nextUrl.clone();
      url.pathname = '/panel';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*', '/admin/:path*'],
};