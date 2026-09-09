/**
 * Indeks sitemap. Ten sam adres co wcześniej (/sitemap.xml), inna zawartość: zamiast kilkudziesięciu
 * tysięcy adresów w jednym pliku zwraca listę plików składowych. Powód i układ: src/lib/sitemapy.ts.
 */

import {
  SITE_URL,
  countIndexableOffers,
  countOfferSitemaps,
  renderSitemapIndex,
  xmlResponse,
} from '@/lib/sitemapy';

export const revalidate = 3600;

export async function GET() {
  const now = new Date();
  const offerCount = await countIndexableOffers();
  const parts = countOfferSitemaps(offerCount);

  const files = [
    { url: `${SITE_URL}/sitemap-strony.xml`, lastModified: now },
    ...Array.from({ length: parts }, (_, part) => ({
      url: `${SITE_URL}/sitemap-oferty/${part}.xml`,
      lastModified: now,
    })),
  ];

  return xmlResponse(renderSitemapIndex(files));
}
