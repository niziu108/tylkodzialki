/**
 * Adresy „stałe" sitemapy: strony serwisu, blog, huby SEO, powiaty, strony cenowe i wizytówki.
 * Wydzielone z app/sitemap.ts przy podziale sitemapy na indeks + paczki (patrz sitemapy.ts).
 * Reguły doboru są bez zmian: do indeksu trafia tylko to, co ma treść i `index` w metadanych.
 */

import { SEO_REGIONS, SEO_TYPES, getSeoCity } from '@/lib/seo-locations';
import { getHubSitemapEntries } from '@/lib/seoHub';
import { getWizytowkiSitemapEntries } from '@/lib/biuroWizytowka';
import { getPowiatList, POWIAT_MIN_INDEX } from '@/lib/seoPowiaty';
import { prisma } from '@/lib/prisma';
import { SITE_URL, type SitemapEntry } from '@/lib/sitemapy';

/** Próba mediany na stronie cenowej: poniżej tylu ofert budowlanych strona ma noindex. */
const CENY_MIN = 4;

export async function getPageSitemapEntries(): Promise<SitemapEntry[]> {
  const baseUrl = SITE_URL;
  const now = new Date();

  const [articles, hubCities, powiaty, wizytowki] = await Promise.all([
    prisma.article.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    }),
    getHubSitemapEntries(),
    getPowiatList(),
    getWizytowkiSitemapEntries(),
  ]);

  // Wizytowki partnerow z realnym portfelem (>= prog indeksacji), spojnie z ich `robots`.
  // Tylko strona 1: paginacja wizytowki zostaje poza indeksem.
  const wizytowkaPages: SitemapEntry[] = wizytowki.map((w) => ({
    url: `${baseUrl}/biuro/${w.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  // Hub SEO (P22): powiaty z realną podażą (>= próg indeksacji), spójnie z noindex.
  const hubPowiatPages: SitemapEntry[] = powiaty
    .filter((p) => p.total >= POWIAT_MIN_INDEX)
    .map((p) => ({
      url: `${baseUrl}/dzialki/powiat/${p.wojSlug}/${p.slug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.72,
    }));

  // Hub SEO (P13): tylko strony miast/typów z >0 ofert (spójnie z noindex) — nie zgłaszamy
  // Google pustych adresów. Województwa i index zawsze (treść zbiorcza).
  const hubCityPages: SitemapEntry[] = [];
  const hubTypePages: SitemapEntry[] = [];
  const cenyCityPages: SitemapEntry[] = [];

  for (const entry of hubCities) {
    if (entry.total <= 0) continue;
    if (!getSeoCity(entry.citySlug)) continue;

    hubCityPages.push({
      url: `${baseUrl}/dzialki/${entry.citySlug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.75,
    });

    if ((entry.byType['budowlane'] ?? 0) >= CENY_MIN) {
      cenyCityPages.push({
        url: `${baseUrl}/ceny/${entry.citySlug}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.78,
      });
    }

    for (const type of SEO_TYPES) {
      if ((entry.byType[type.slug] ?? 0) <= 0) continue;
      hubTypePages.push({
        url: `${baseUrl}/dzialki/${entry.citySlug}/${type.slug}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
  }

  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/kup`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/dzialki`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/ceny`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: `${baseUrl}/sprzedaj`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    {
      url: `${baseUrl}/sprawdz-dzialke`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    // Wejście dla właściciela (fraza „wycena działki"), prowadzi do formularza z wskazaną działką.
    { url: `${baseUrl}/wycena-dzialki`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/dla-biur`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },

    ...articles.map((article) => ({
      url: `${baseUrl}/blog/${article.slug}`,
      lastModified: article.updatedAt ?? now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    ...SEO_REGIONS.map((region) => ({
      url: `${baseUrl}/dzialki/wojewodztwo/${region.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),

    ...hubCityPages,
    ...hubTypePages,
    ...hubPowiatPages,
    ...cenyCityPages,
    ...wizytowkaPages,
  ];
}
