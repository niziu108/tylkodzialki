import type { MetadataRoute } from 'next';
import { SEO_CITIES } from '@/lib/seo-locations';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://tylkodzialki.pl';
  const now = new Date();

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
  ];
}