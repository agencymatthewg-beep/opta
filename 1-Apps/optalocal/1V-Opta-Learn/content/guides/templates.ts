export type GuideTemplateId =
  | 'holistic-whole-app'
  | 'feature-deep-dive'
  | 'process-workflow'
  | 'setting-configuration'
  | 'visual-interactive-journey';

export type ExplanationExtent =
  | 'L4-masterclass'
  | 'L3-deep-dive'
  | 'L2-operational'
  | 'L1-reference';

export type FlowStage =
  | 'setup'
  | 'configuration'
  | 'operation'
  | 'troubleshooting'
  | 'optimization';

export const REQUIRED_FLOW_STAGES: FlowStage[] = [
  'setup',
  'configuration',
  'operation',
  'troubleshooting',
  'optimization',
];

const FLOW_STAGE_HEADING_PREFIX: Record<FlowStage, string> = {
  setup: '[setup]',
  configuration: '[configuration]',
  operation: '[operation]',
  troubleshooting: '[troubleshooting]',
  optimization: '[optimization]',
};

const FLOW_STAGE_PATTERNS: Record<FlowStage, RegExp[]> = {
  setup: [
    /\[setup\]/i,
    /\bsetup\b/i,
    /\bprerequisite/i,
    /\bbootstrap/i,
    /\bonboarding?\b/i,
  ],
  configuration: [
    /\[configuration\]/i,
    /\bconfiguration\b/i,
    /\bconfig\b/i,
    /\bsettings?\b/i,
    /\benv\b/i,
    /\bflag\b/i,
  ],
  operation: [
    /\[operation\]/i,
    /\boperation(al)?\b/i,
    /\bworkflow\b/i,
    /\bexecution\b/i,
    /\busage\b/i,
    /\bruntime\b/i,
  ],
  troubleshooting: [
    /\[troubleshooting\]/i,
    /\btroubleshooting\b/i,
    /\bdebug\b/i,
    /\bfailure\b/i,
    /\brecovery\b/i,
    /\bincident\b/i,
    /\bverification\b/i,
  ],
  optimization: [
    /\[optimization\]/i,
    /\boptimization\b/i,
    /\boptimisation\b/i,
    /\bperformance\b/i,
    /\bscal(a|i)ng\b/i,
    /\bslo\b/i,
    /\bbest practice/i,
  ],
};

export interface GuideTemplateDefinition {
  id: GuideTemplateId;
  label: string;
  explanationExtent: ExplanationExtent;
  description: string;
  minSections: number;
  minWordCount: number;
  maxWordCount?: number;
  requiresCodeExample: boolean;
  minVisuals: number;
  minVisualCoverageRatio?: number;
  maxSectionBodyWordCount?: number;
  minCodeBlocks: number;
  minNoteBlocks: number;
  minRichBlocks: number;
  requiredFlowStages: FlowStage[];
  enforceSettingsCoverageOnAppGuides: boolean;
}

export const GUIDE_TEMPLATE_DEFINITIONS: Record<
  GuideTemplateId,
  GuideTemplateDefinition
> = {
  'holistic-whole-app': {
    id: 'holistic-whole-app',
    label: 'Holistic Whole App Guide',
    explanationExtent: 'L4-masterclass',
    description:
      'Extensive, ecosystem-level guide with architecture and integrated workflows.',
    minSections: 7,
    minWordCount: 360,
    requiresCodeExample: true,
    minVisuals: 2,
    minCodeBlocks: 2,
    minNoteBlocks: 0,
    minRichBlocks: 4,
    requiredFlowStages: REQUIRED_FLOW_STAGES,
    enforceSettingsCoverageOnAppGuides: true,
  },
  'feature-deep-dive': {
    id: 'feature-deep-dive',
    label: 'Feature Guide',
    explanationExtent: 'L3-deep-dive',
    description:
      'Detailed explanation of one capability, covering use cases and internals.',
    minSections: 5,
    minWordCount: 220,
    requiresCodeExample: true,
    minVisuals: 1,
    minCodeBlocks: 1,
    minNoteBlocks: 1,
    minRichBlocks: 3,
    requiredFlowStages: REQUIRED_FLOW_STAGES,
    enforceSettingsCoverageOnAppGuides: true,
  },
  'process-workflow': {
    id: 'process-workflow',
    label: 'Process / Workflow Guide',
    explanationExtent: 'L2-operational',
    description:
      'Operational, step-oriented guide focused on execution and verification.',
    minSections: 5,
    minWordCount: 240,
    requiresCodeExample: true,
    minVisuals: 1,
    minCodeBlocks: 1,
    minNoteBlocks: 0,
    minRichBlocks: 3,
    requiredFlowStages: REQUIRED_FLOW_STAGES,
    enforceSettingsCoverageOnAppGuides: true,
  },
  'setting-configuration': {
    id: 'setting-configuration',
    label: 'Setting / Configuration Guide',
    explanationExtent: 'L1-reference',
    description:
      'Reference-first guide for flags/env vars/settings with concrete examples.',
    minSections: 5,
    minWordCount: 220,
    requiresCodeExample: true,
    minVisuals: 1,
    minCodeBlocks: 1,
    minNoteBlocks: 1,
    minRichBlocks: 3,
    requiredFlowStages: REQUIRED_FLOW_STAGES,
    enforceSettingsCoverageOnAppGuides: true,
  },
  'visual-interactive-journey': {
    id: 'visual-interactive-journey',
    label: 'Visual Interactive Journey',
    explanationExtent: 'L3-deep-dive',
    description:
      'Visual-first guided narrative using interactive HTML blocks and compact explanatory text.',
    minSections: 5,
    minWordCount: 120,
    maxWordCount: 420,
    requiresCodeExample: false,
    minVisuals: 4,
    minVisualCoverageRatio: 0.8,
    maxSectionBodyWordCount: 45,
    minCodeBlocks: 0,
    minNoteBlocks: 0,
    minRichBlocks: 5,
    requiredFlowStages: REQUIRED_FLOW_STAGES,
    enforceSettingsCoverageOnAppGuides: true,
  },
};

export interface GuideLike {
  slug: string;
  title: string;
  app?: string;
  template: GuideTemplateId;
  sections: Array<{
    heading: string;
    body: string;
    note?: string;
    code?: string;
    visual?: string;
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

function countFlowCoverage(
  sections: GuideLike['sections'],
): Record<FlowStage, boolean> {
  const stageCoverage = Object.fromEntries(
    REQUIRED_FLOW_STAGES.map((stage) => [stage, false]),
  ) as Record<FlowStage, boolean>;

  for (const section of sections) {
    const block = `${section.heading}\n${section.body}\n${section.note ?? ''}`;
    for (const stage of REQUIRED_FLOW_STAGES) {
      if (FLOW_STAGE_PATTERNS[stage].some((pattern) => pattern.test(block))) {
        stageCoverage[stage] = true;
      }
    }
  }

  return stageCoverage;
}

function canonicalStageFromHeading(heading: string): FlowStage | null {
  const normalized = heading.trim().toLowerCase();
  for (const stage of REQUIRED_FLOW_STAGES) {
    if (normalized.startsWith(FLOW_STAGE_HEADING_PREFIX[stage])) {
      return stage;
    }
  }
  return null;
}

function validateCanonicalFlowOrder(sections: GuideLike['sections']): {
  missingStages: FlowStage[];
  outOfOrderStages: FlowStage[];
} {
  const firstIndexByStage = new Map<FlowStage, number>();

  sections.forEach((section, index) => {
    const stage = canonicalStageFromHeading(section.heading);
    if (stage && !firstIndexByStage.has(stage)) {
      firstIndexByStage.set(stage, index);
    }
  });

  const missingStages = REQUIRED_FLOW_STAGES.filter(
    (stage) => !firstIndexByStage.has(stage),
  );
  const outOfOrderStages: FlowStage[] = [];

  let lastIndex = -1;
  for (const stage of REQUIRED_FLOW_STAGES) {
    const stageIndex = firstIndexByStage.get(stage);
    if (stageIndex === undefined) continue;
    if (stageIndex < lastIndex) {
      outOfOrderStages.push(stage);
    }
    lastIndex = Math.max(lastIndex, stageIndex);
  }

  return { missingStages, outOfOrderStages };
}

function hasSettingsCoverage(sections: GuideLike['sections']): boolean {
  const settingsPattern =
    /\b(configuration|config|setting|settings|env|environment variable|flag|profile)\b/i;
  return sections.some((section) =>
    settingsPattern.test(`${section.heading}\n${section.body}\n${section.note ?? ''}`),
  );
}

export function getTemplateDefinition(
  templateId: GuideTemplateId,
): GuideTemplateDefinition {
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
  if (template.maxWordCount !== undefined && words > template.maxWordCount) {
    errors.push(
      `Template '${template.id}' allows at most ${template.maxWordCount} words (found ${words}).`,
    );
  }

  const codeBlocks = guide.sections.filter((section) =>
    Boolean(section.code?.trim()),
  ).length;
  const noteBlocks = guide.sections.filter((section) =>
    Boolean(section.note?.trim()),
  ).length;
  const visualBlocks = guide.sections.filter((section) =>
    Boolean(section.visual?.trim()),
  ).length;
  const richBlocks = codeBlocks + noteBlocks + visualBlocks;

  if (template.requiresCodeExample && codeBlocks === 0) {
    errors.push(`Template '${template.id}' requires at least one code example.`);
  }
  if (codeBlocks < template.minCodeBlocks) {
    errors.push(
      `Template '${template.id}' requires at least ${template.minCodeBlocks} code block(s) (found ${codeBlocks}).`,
    );
  }
  if (noteBlocks < template.minNoteBlocks) {
    errors.push(
      `Template '${template.id}' requires at least ${template.minNoteBlocks} note block(s) (found ${noteBlocks}).`,
    );
  }
  if (visualBlocks < template.minVisuals) {
    errors.push(
      `Template '${template.id}' requires at least ${template.minVisuals} visual block(s) (found ${visualBlocks}).`,
    );
  }
  if (template.minVisualCoverageRatio !== undefined) {
    const visualCoverage = guide.sections.length === 0 ? 0 : visualBlocks / guide.sections.length;
    if (visualCoverage < template.minVisualCoverageRatio) {
      errors.push(
        `Template '${template.id}' requires visual coverage ratio of at least ${template.minVisualCoverageRatio} (found ${visualCoverage.toFixed(
          2,
        )}).`,
      );
    }
  }
  if (template.maxSectionBodyWordCount !== undefined) {
    const maxSectionBodyWordCount = template.maxSectionBodyWordCount;
    guide.sections.forEach((section, index) => {
      const sectionWords = normalizedWordCount(section.body);
      if (sectionWords > maxSectionBodyWordCount) {
        errors.push(
          `Template '${template.id}' section ${index + 1} exceeds max body words (${sectionWords} > ${maxSectionBodyWordCount}).`,
        );
      }
    });
  }
  if (richBlocks < template.minRichBlocks) {
    errors.push(
      `Template '${template.id}' requires at least ${template.minRichBlocks} rich content block(s) (code+note+visual, found ${richBlocks}).`,
    );
  }

  const stageCoverage = countFlowCoverage(guide.sections);
  const missingStages = template.requiredFlowStages.filter(
    (stage) => !stageCoverage[stage],
  );
  if (missingStages.length > 0) {
    errors.push(
      `Template '${template.id}' is missing required flow stage coverage: ${missingStages.join(
        ', ',
      )}.`,
    );
  }

  const canonicalFlow = validateCanonicalFlowOrder(guide.sections);
  if (canonicalFlow.missingStages.length > 0) {
    errors.push(
      `Template '${template.id}' requires explicit lifecycle heading prefixes for stages: ${canonicalFlow.missingStages.join(
        ', ',
      )}. Use headings like [Setup], [Configuration], [Operation], [Troubleshooting], [Optimization].`,
    );
  }
  if (canonicalFlow.outOfOrderStages.length > 0) {
    errors.push(
      `Template '${template.id}' lifecycle stage headings are out of order for: ${canonicalFlow.outOfOrderStages.join(
        ', ',
      )}. Keep canonical order from [Setup] to [Optimization].`,
    );
  }

  const isAppFocused = guide.app && guide.app !== 'general';
  if (
    isAppFocused &&
    template.enforceSettingsCoverageOnAppGuides &&
    !hasSettingsCoverage(guide.sections)
  ) {
    errors.push(
      `Template '${template.id}' requires explicit settings/configuration coverage for app-focused guides.`,
    );
  }

  return errors;
}
