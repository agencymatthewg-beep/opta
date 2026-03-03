import type { MetadataRoute } from 'next';
import { getPublishedGuides } from '@/content/guides';

const DEFAULT_SITE_URL = 'http://localhost:3007';

function resolveBaseUrl(): string {
  const rawBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    DEFAULT_SITE_URL;

  return rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;
}

function absoluteUrl(pathname: string): string {
  return new URL(pathname, resolveBaseUrl()).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = getPublishedGuides();

  return [
    {
      url: absoluteUrl('/'),
      changeFrequency: 'daily',
      priority: 1,
      lastModified: new Date(),
    },
    ...guides.map((guide) => ({
      url: absoluteUrl(`/guides/${guide.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      lastModified: new Date(`${guide.updatedAt}T00:00:00.000Z`),
    })),
  ];
}
