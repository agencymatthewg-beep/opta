export type GuideTemplateId =
  | 'holistic-whole-app'
  | 'feature-deep-dive'
  | 'process-workflow'
  | 'setting-configuration';

export type ExplanationExtent =
  | 'L4-masterclass'
  | 'L3-deep-dive'
  | 'L2-operational'
  | 'L1-reference';

export interface GuideTemplateDefinition {
  id: GuideTemplateId;
  label: string;
  explanationExtent: ExplanationExtent;
  description: string;
  minSections: number;
  minWordCount: number;
  requiresCodeExample: boolean;
}

export const GUIDE_TEMPLATE_DEFINITIONS: Record<GuideTemplateId, GuideTemplateDefinition> = {
  'holistic-whole-app': {
    id: 'holistic-whole-app',
    label: 'Holistic Whole App Guide',
    explanationExtent: 'L4-masterclass',
    description:
      'Extensive, ecosystem-level guide with architecture and integrated workflows.',
    minSections: 4,
    minWordCount: 220,
    requiresCodeExample: false,
  },
  'feature-deep-dive': {
    id: 'feature-deep-dive',
    label: 'Feature Guide',
    explanationExtent: 'L3-deep-dive',
    description:
      'Detailed explanation of one capability, covering use cases and internals.',
    minSections: 4,
    minWordCount: 160,
    requiresCodeExample: false,
  },
  'process-workflow': {
    id: 'process-workflow',
    label: 'Process / Workflow Guide',
    explanationExtent: 'L2-operational',
    description:
      'Operational, step-oriented guide focused on execution and verification.',
    minSections: 3,
    minWordCount: 130,
    requiresCodeExample: true,
  },
  'setting-configuration': {
    id: 'setting-configuration',
    label: 'Setting / Configuration Guide',
    explanationExtent: 'L1-reference',
    description:
      'Reference-first guide for flags/env vars/settings with concrete examples.',
    minSections: 4,
    minWordCount: 120,
    requiresCodeExample: true,
  },
};

export interface GuideLike {
  slug: string;
  title: string;
  template: GuideTemplateId;
  sections: Array<{
    heading: string;
    body: string;
    note?: string;
    code?: string;
  }>;
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ');
}

function normalizedWordCount(input: string): number {
  const normalized = stripHtmlTags(input)
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 0;
  return normalized.split(' ').length;
}

export function getTemplateDefinition(templateId: GuideTemplateId): GuideTemplateDefinition {
  return GUIDE_TEMPLATE_DEFINITIONS[templateId];
}

export function validateGuideByTemplate(guide: GuideLike): string[] {
  const template = getTemplateDefinition(guide.template);
  const errors: string[] = [];

  if (!template) {
    return [`Unknown template '${String(guide.template)}'.`];
  }

  if (guide.sections.length < template.minSections) {
    errors.push(
      `Template '${template.id}' requires at least ${template.minSections} sections (found ${guide.sections.length}).`,
    );
  }

  const textCorpus = guide.sections
    .map((section) => `${section.heading}\n${section.body}\n${section.note ?? ''}`)
    .join('\n');
  const words = normalizedWordCount(textCorpus);
  if (words < template.minWordCount) {
    errors.push(
      `Template '${template.id}' requires at least ${template.minWordCount} words (found ${words}).`,
    );
  }

  if (template.requiresCodeExample) {
    const hasCode = guide.sections.some((section) => Boolean(section.code?.trim()));
    if (!hasCode) {
      errors.push(`Template '${template.id}' requires at least one code example.`);
    }
  }

  return errors;
}
