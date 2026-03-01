import Fuse from 'fuse.js';
import type { Guide } from '@/content/guides';

export function createSearchIndex(guides: Guide[]) {
  return new Fuse(guides, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'summary', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'sections.heading', weight: 1 },
      { name: 'sections.body', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

export function searchGuides(fuse: Fuse<Guide>, query: string): Guide[] {
  if (!query.trim()) return [];
  return fuse.search(query).map((r) => r.item);
}
