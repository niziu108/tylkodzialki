import { prisma } from '@/lib/prisma';
import { indexableOfferWhere, SITE_URL } from '@/lib/sitemapy';
import { ladnaLokalizacja } from '@/lib/lokalizacjaOferty';

// Feed ofert dla Działkopedii (Radar Działek), uzgodniony z Mateuszem Stawczykiem 15-16.10.2026.
// Zakres OGRANICZONY świadomie: rodzaj, cena, powierzchnia, lokalizacja do poziomu miejscowości
// i gminy, jedno zdjęcie oraz link do oferty u nas z UTM. BEZ opisu, telefonu, nazwiska agenta
// i dokładnych współrzędnych: kontakt z kupującym ma się odbyć na tylkodzialki.pl.
//
// Adres z kluczem w ścieżce, żeby feedu nie zbierał nikt inny. Wyłączenie: WLACZONY = false
// (albo zmiana KLUCZ, wtedy stary adres daje 404). Ocena po 1-2 miesiącach po ruchu z
// utm_source=dzialkopedia w GA i kontaktach.

const WLACZONY = true;
const KLUCZ = '61daa44a0ea43d260a245f15';

export const dynamic = 'force-dynamic';

const RODZAJ: Record<string, string> = {
  BUDOWLANA: 'budowlana',
  ROLNA: 'rolna',
  LESNA: 'leśna',
  REKREACYJNA: 'rekreacyjna',
  SIEDLISKOWA: 'siedliskowa',
  INWESTYCYJNA: 'inwestycyjna',
};

function x(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function bezDopiskuGminy(g: string | null): string {
  return (g ?? '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^gmina\s+/i, '')
    .replace(/\s*-?\s*gmina(\s+(miejska|wiejska|miejsko-wiejska))?\s*$/i, '')
    .trim();
}

// Vercel ucina odpowiedź funkcji powyżej ok. 4,5 MB, a cały feed (9 tys. ofert) ma ok. 6,5 MB.
// Dlatego strony po 2500 ofert (ok. 1,8 MB): ?strona=1, 2, ... Każda strona ma atrybuty
// strona/stron i element <nastepna> z adresem kolejnej; bez ?strona = strona 1.
const NA_STRONE = 2500;

export async function GET(req: Request, ctx: { params: Promise<{ klucz: string }> }) {
  const { klucz } = await ctx.params;
  if (!WLACZONY || klucz !== KLUCZ) {
    return new Response('Not found', { status: 404 });
  }

  const where = { ...indexableOfferWhere(), transakcja: 'SPRZEDAZ' as const, cenaPln: { gt: 0 } };
  const wszystkich = await prisma.dzialka.count({ where });
  const stron = Math.max(1, Math.ceil(wszystkich / NA_STRONE));
  const strona = Math.min(stron, Math.max(1, Number(new URL(req.url).searchParams.get('strona')) || 1));

  const oferty = await prisma.dzialka.findMany({
    where,
    select: {
      id: true,
      cenaPln: true,
      powierzchniaM2: true,
      przeznaczenia: true,
      locationLabel: true,
      adminGmina: true,
      adminPowiat: true,
      adminWoj: true,
      publishedAt: true,
      updatedAt: true,
      zdjecia: { select: { url: true }, orderBy: { kolejnosc: 'asc' }, take: 1 },
    },
    // Stała kolejność po id: oferta nie przeskakuje między stronami, gdy przybywają nowe.
    orderBy: { id: 'asc' },
    skip: (strona - 1) * NA_STRONE,
    take: NA_STRONE,
  });

  const teraz = new Date().toISOString();
  const wiersze = oferty.map((o) => {
    const rodzaj = (o.przeznaczenia ?? []).map((p) => RODZAJ[p] ?? p.toLowerCase()).join(', ');
    const url = `${SITE_URL}/dzialka/${o.id}?utm_source=dzialkopedia&utm_medium=feed&utm_campaign=radar`;
    const powiat = (o.adminPowiat ?? '').replace(/^powiat\s+/i, '');
    return [
      `  <oferta id="${x(o.id)}">`,
      `    <url>${x(url)}</url>`,
      `    <rodzaj>${x(rodzaj)}</rodzaj>`,
      `    <cena waluta="PLN">${x(o.cenaPln)}</cena>`,
      `    <powierzchnia jednostka="m2">${x(o.powierzchniaM2)}</powierzchnia>`,
      `    <miejscowosc>${x(ladnaLokalizacja(o.locationLabel))}</miejscowosc>`,
      `    <gmina>${x(ladnaLokalizacja(bezDopiskuGminy(o.adminGmina)))}</gmina>`,
      `    <powiat>${x(powiat)}</powiat>`,
      `    <wojewodztwo>${x((o.adminWoj ?? '').toLowerCase())}</wojewodztwo>`,
      o.zdjecia[0]?.url ? `    <zdjecie>${x(o.zdjecia[0].url)}</zdjecie>` : null,
      `    <dodano>${x(o.publishedAt?.toISOString())}</dodano>`,
      `    <aktualizacja>${x(o.updatedAt?.toISOString())}</aktualizacja>`,
      `  </oferta>`,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const nastepna =
    strona < stron ? `${SITE_URL}/api/feed/dzialkopedia/${KLUCZ}?strona=${strona + 1}` : null;
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<oferty zrodlo="tylkodzialki.pl" wygenerowano="${teraz}" wszystkich="${wszystkich}" strona="${strona}" stron="${stron}" liczba="${oferty.length}">\n` +
    (nastepna ? `  <nastepna>${x(nastepna)}</nastepna>\n` : '') +
    wiersze.join('\n') +
    `\n</oferty>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Raz na godzinę z bazy, potem z CDN Vercela.
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      'X-Robots-Tag': 'noindex',
    },
  });
}
