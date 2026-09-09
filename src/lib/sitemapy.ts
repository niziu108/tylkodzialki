/**
 * Budowa sitemap dla skali docelowej (50 tys. ofert i więcej).
 *
 * Do 2026-09-09 cały serwis leciał w jednym pliku /sitemap.xml z `take: 45000` na ofertach.
 * Google przyjmuje maksymalnie 50 000 adresów i 50 MB na plik, a nadmiar nie jest obcinany:
 * odrzucany jest CAŁY plik. Przy 7 tys. ofert to była teoria, przy 50 tys. (jeden partner
 * franczyzowy potrafi wnieść kilka tysięcy) sitemapa przestałaby działać w ciszy, bez błędu
 * na produkcji i bez sygnału innego niż powolny zjazd indeksacji.
 *
 * Układ docelowy, standardowy dla dużych serwisów ogłoszeniowych:
 *   /sitemap.xml            -> indeks (lista plików poniżej), ten sam adres co wcześniej,
 *   /sitemap-strony.xml     -> strony stałe, huby SEO, powiaty, ceny, wizytówki, blog,
 *   /sitemap-oferty/N.xml   -> oferty, paczkami po OFFERS_PER_SITEMAP.
 *
 * Adres wejściowy się nie zmienia, więc robots.txt i to, co Google ma już zapamiętane, zostaje
 * ważne. Paczki ofert sortujemy po `id` rosnąco, nie po dacie: przy sortowaniu po `updatedAt`
 * każda edycja oferty przesuwałaby setki adresów między plikami i Google przy każdym odczycie
 * widziałby sztuczny ruch w całej strukturze.
 */

import { DzialkaStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Adresów ofert na jeden plik. Z zapasem pod limit 50 000. */
export const OFFERS_PER_SITEMAP = 20000;

export const SITE_URL = 'https://tylkodzialki.pl';

export type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

/**
 * Warunek „oferta widoczna w indeksie" musi być IDENTYCZNY z tym, co pokazuje /kup i co ma
 * `index` w metadanych. Zakończona oferta ma noindex, więc trzymanie jej w sitemapie wysyłało
 * Google sprzeczny sygnał i zjadało budżet indeksowania kosztem świeżych ofert.
 */
export function indexableOfferWhere(now = new Date()) {
  return {
    ownerId: { not: null },
    status: DzialkaStatus.AKTYWNE,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export async function countIndexableOffers(): Promise<number> {
  return prisma.dzialka.count({ where: indexableOfferWhere() });
}

/** Ile plików ofert potrzeba przy obecnej podaży. Zawsze co najmniej jeden. */
export function countOfferSitemaps(offerCount: number): number {
  return Math.max(1, Math.ceil(offerCount / OFFERS_PER_SITEMAP));
}

export async function getOfferSitemapPage(part: number): Promise<SitemapEntry[]> {
  const offers = await prisma.dzialka.findMany({
    where: indexableOfferWhere(),
    select: { id: true, updatedAt: true },
    orderBy: { id: 'asc' },
    skip: part * OFFERS_PER_SITEMAP,
    take: OFFERS_PER_SITEMAP,
  });

  return offers.map((offer) => ({
    url: `${SITE_URL}/dzialka/${offer.id}`,
    lastModified: offer.updatedAt ?? new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIso(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function renderUrlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const lastmod = toIso(entry.lastModified);
      return [
        '  <url>',
        `    <loc>${escapeXml(entry.url)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        entry.changeFrequency ? `    <changefreq>${entry.changeFrequency}</changefreq>` : null,
        entry.priority != null ? `    <priority>${entry.priority}</priority>` : null,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderSitemapIndex(files: { url: string; lastModified?: Date }[]): string {
  const body = files
    .map((file) => {
      const lastmod = toIso(file.lastModified);
      return [
        '  <sitemap>',
        `    <loc>${escapeXml(file.url)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        '  </sitemap>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Ten sam rytm co poprzednie `revalidate = 3600` na app/sitemap.ts.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
