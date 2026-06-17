import type { MetadataRoute } from 'next';
import { SEO_REGIONS, SEO_TYPES, getSeoCity } from '@/lib/seo-locations';
import { getHubSitemapEntries } from '@/lib/seoHub';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://tylkodzialki.pl';
  const now = new Date();

  const [dzialki, articles, hubCities] = await Promise.all([
    prisma.dzialka.findMany({
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 45000,
    }),
    prisma.article.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5000,
    }),
    getHubSitemapEntries(),
  ]);

  // Hub SEO (P13): tylko strony miast/typów z >0 ofert (spójnie z noindex) — nie zgłaszamy
  // Google pustych adresów. Województwa i index zawsze (treść zbiorcza).
  const hubCityPages: MetadataRoute.Sitemap = [];
  const hubTypePages: MetadataRoute.Sitemap = [];

  for (const entry of hubCities) {
    if (entry.total <= 0) continue;
    if (!getSeoCity(entry.citySlug)) continue;

    hubCityPages.push({
      url: `${baseUrl}/dzialki/${entry.citySlug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.75,
    });

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
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/kup`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dzialki`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/sprzedaj`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dla-biur`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },

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

    ...dzialki.map((dzialka) => ({
      url: `${baseUrl}/dzialka/${dzialka.id}`,
      lastModified: dzialka.updatedAt ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
