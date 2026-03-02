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
  status?: 'verified' | 'draft';
}

import { lmxOverview } from './lmx-overview';
import { optaLocalIntro } from './opta-local-intro';
import { cliMasterclass } from './cli-masterclass';
import { accountsSync } from './accounts-sync';
import { browserAutomationGuide } from './browser-automation';
import { codeDesktopOverview } from './code-desktop-overview';

export const allGuides: Guide[] = [
  { ...optaLocalIntro, status: 'verified' },
  { ...lmxOverview, status: 'verified' },
  { ...cliMasterclass, status: 'verified' },
  { ...browserAutomationGuide, status: 'verified' },
  { ...codeDesktopOverview, status: 'verified' },
  { ...accountsSync, status: 'verified' },
];

export function getGuide(slug: string): Guide | undefined {
  return getPublishedGuides().find((g) => g.slug === slug);
}

export function getPublishedGuides(): Guide[] {
  return allGuides.filter((g) => g.status === 'verified');
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
