export type AppSlug = 'lmx' | 'cli' | 'accounts' | 'init' | 'general';
export type Category = 'getting-started' | 'feature' | 'troubleshooting' | 'reference';

export interface GuideSection {
  heading: string;
  body: string;
  note?: string;
  code?: string;
}

export interface Guide {
  slug: string;
  title: string;
  app: AppSlug;
  category: Category;
  summary: string;
  tags: string[];
  sections: GuideSection[];
  updatedAt: string;
}

import { lmxOverview } from './lmx';

export const allGuides: Guide[] = [
  lmxOverview,
];

export function getGuide(slug: string): Guide | undefined {
  return allGuides.find((g) => g.slug === slug);
}

export const appColors: Record<AppSlug, string> = {
  lmx: '#a855f7',
  cli: '#22c55e',
  accounts: '#3b82f6',
  init: '#f59e0b',
  general: '#a1a1aa',
};

export const appLabels: Record<AppSlug, string> = {
  lmx: 'LMX',
  cli: 'CLI',
  accounts: 'Accounts',
  init: 'Init',
  general: 'General',
};
