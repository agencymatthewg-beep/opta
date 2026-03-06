import Fuse from 'fuse.js';
import type { GuideSearchEntry } from '@/content/guides';

export function createSearchIndex(guides: GuideSearchEntry[]) {
  return new Fuse(guides, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'summary', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'sectionHeadings', weight: 1 },
      { name: 'app', weight: 0.25 },
      { name: 'category', weight: 0.25 },
    ],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

export function searchGuides(fuse: Fuse<GuideSearchEntry>, query: string): GuideSearchEntry[] {
  if (!query.trim()) return [];
  return fuse.search(query).map((r) => r.item);
}
