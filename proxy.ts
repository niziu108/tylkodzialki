import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/* Bramka logowania dla /panel i /admin: bez sesji odsyła na /logowanie z callbackUrl, żeby
 * po zalogowaniu wrócić na tę samą stronę (link z maila, powrót ze Stripe, zakładka admina).
 *
 * Sprawdza tylko, czy jest ważne ciasteczko sesji. O dostępie decydują strony i akcje serwerowe
 * (rola ADMIN z bazy, właściciel ogłoszenia) i tak ma zostać: proxy ich nie zastępuje.
 *
 * Plik musi leżeć w korzeniu repo, obok app/. Next szuka go w src/ tylko przy układzie src/app,
 * dlatego wcześniejszy src/middleware.ts nigdy się nie uruchomił. */
export async function proxy(req: NextRequest) {
  // Akcja serwerowa to POST na adres strony. Przekierowanie kazałoby przeglądarce powtórzyć POST
  // na /logowanie i zamiast komunikatu z akcji użytkownik dostałby ogólny błąd.
  if (req.method !== 'GET' && req.method !== 'HEAD') return NextResponse.next();

  // Bez jawnego sekretu i nazwy ciasteczka: getToken bierze te same domyślne co next-auth
  // (NEXTAUTH_SECRET, prefiks __Secure- pod https). Rozjazd dałby pętlę /logowanie ↔ /panel.
  if (await getToken({ req })) return NextResponse.next();

  const url = new URL('/logowanie', req.url);
  url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/panel/:path*', '/admin/:path*'],
};
