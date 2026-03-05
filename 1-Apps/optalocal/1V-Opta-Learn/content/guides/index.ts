export type AppSlug = 'lmx' | 'cli' | 'accounts' | 'init' | 'general';
export type Category = 'getting-started' | 'feature' | 'troubleshooting' | 'reference';
export type GuideStatus = 'verified' | 'draft';

import {
  type ExplanationExtent,
  type GuideTemplateId,
  getTemplateDefinition,
  validateGuideByTemplate,
} from './templates';

export interface GuideSection {
  heading: string;
  body: string;
  note?: string;
  code?: string;
  visual?: string;
}

export interface Guide {
  slug: string;
  title: string;
  app: AppSlug;
  category: Category;
  template: GuideTemplateId;
  summary: string;
  tags: string[];
  sections: GuideSection[];
  updatedAt: string;
}

export type RegisteredGuide = Guide & {
  status: GuideStatus;
};

import { lmxOverview } from './lmx-overview';
import { optaLocalIntro } from './opta-local-intro';
import { cliMasterclass } from './cli-masterclass';
import { accountsSync } from './accounts-sync';
import { browserAutomationGuide } from './browser-automation';
import { codeDesktopOverview } from './code-desktop-overview';
import { deepDiveTemplate } from './template-deep-dive';

import { lmxMasterclass } from './lmx-masterclass';
import { codeDesktopMasterclass } from './code-desktop-masterclass';
import { accountsMasterclass } from './accounts-masterclass';
import { audioVoiceGuide } from './audio-voice';
import { ragWorkflowGuide } from './rag-workflow';
export const allGuides: RegisteredGuide[] = [
  { ...optaLocalIntro, status: 'draft' },
  { ...lmxOverview, status: 'draft' },
  { ...cliMasterclass, status: 'verified' },
  { ...browserAutomationGuide, status: 'draft' },
  { ...codeDesktopOverview, status: 'draft' },
  { ...accountsSync, status: 'draft' },
  { ...deepDiveTemplate, status: 'draft' },
  { ...lmxMasterclass, status: 'draft' },
  { ...codeDesktopMasterclass, status: 'draft' },
  { ...accountsMasterclass, status: 'draft' },
  { ...audioVoiceGuide, status: 'draft' },
  { ...ragWorkflowGuide, status: 'draft' },
];

function extractGuideLinks(content: string): string[] {
  const matches = content.matchAll(/href=["']\/guides\/([a-z0-9-]+)["']/gi);
  return Array.from(matches, (match) => match[1].toLowerCase());
}

function validateGuideSet(guides: RegisteredGuide[]): string[] {
  const errors: string[] = [];

  const slugSet = new Set<string>();
  for (const guide of guides) {
    if (slugSet.has(guide.slug)) {
      errors.push(`Duplicate guide slug '${guide.slug}'.`);
    }
    slugSet.add(guide.slug);
  }

  for (const guide of guides) {
    const templateErrors = validateGuideByTemplate(guide);
    for (const error of templateErrors) {
      errors.push(`[${guide.slug}] ${error}`);
    }

    for (const section of guide.sections) {
      const links = [
        ...extractGuideLinks(section.body),
        ...(section.note ? extractGuideLinks(section.note) : []),
      ];
      for (const linkedSlug of links) {
        if (!slugSet.has(linkedSlug)) {
          errors.push(
            `[${guide.slug}] broken internal guide link '/guides/${linkedSlug}'.`,
          );
        }
      }
    }
  }

  return errors;
}

const guideValidationErrors = validateGuideSet(allGuides);
if (guideValidationErrors.length > 0) {
  throw new Error(
    `Guide validation failed:\n- ${guideValidationErrors.join('\n- ')}`,
  );
}

export function getGuide(slug: string): RegisteredGuide | undefined {
  return getPublishedGuides().find((g) => g.slug === slug);
}

export function getPublishedGuides(): RegisteredGuide[] {
  return allGuides.filter((g) => g.status === 'verified');
}

export function getExplanationExtent(guide: Guide): ExplanationExtent {
  return getTemplateDefinition(guide.template).explanationExtent;
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
