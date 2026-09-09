/**
 * Paczka adresów ofert: /sitemap-oferty/0.xml, /sitemap-oferty/1.xml, ...
 * Numery wylicza indeks (app/sitemap.xml/route.ts) z aktualnej liczby ofert.
 */

import {
  OFFERS_PER_SITEMAP,
  countIndexableOffers,
  countOfferSitemaps,
  getOfferSitemapPage,
  renderUrlset,
  xmlResponse,
} from '@/lib/sitemapy';

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ part: string }> }) {
  const { part: raw } = await params;
  const part = Number(raw.replace(/\.xml$/i, ''));

  if (!Number.isInteger(part) || part < 0) {
    return new Response('Not found', { status: 404 });
  }

  // Poza zakresem zwracamy 404, a nie pustego urlseta: Google traktuje pusty plik w indeksie
  // jako błąd sitemapy, a nieistniejący numer po prostu wypada z obiegu przy kolejnym odczycie.
  const offerCount = await countIndexableOffers();
  if (part >= countOfferSitemaps(offerCount)) {
    return new Response('Not found', { status: 404 });
  }

  const entries = await getOfferSitemapPage(part);
  if (entries.length === 0 && part > 0) {
    return new Response('Not found', { status: 404 });
  }

  console.log(
    `[SITEMAP] Paczka ${part}: ${entries.length} ofert (po ${OFFERS_PER_SITEMAP} na plik, razem ${offerCount}).`
  );

  return xmlResponse(renderUrlset(entries));
}
