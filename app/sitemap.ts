import type { MetadataRoute } from 'next';
import { SEO_CITIES } from '@/lib/seo-locations';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://tylkodzialki.pl';
  const now = new Date();

  const dzialki = await prisma.dzialka.findMany({
    select: {
      id: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 45000,
  });

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
      url: `${baseUrl}/sprzedaj`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },

    ...SEO_CITIES.map((city) => ({
      url: `${baseUrl}/dzialki/${city.slug}/budowlane`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    })),

    ...dzialki.map((dzialka) => ({
      url: `${baseUrl}/dzialka/${dzialka.id}`,
      lastModified: dzialka.updatedAt ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}