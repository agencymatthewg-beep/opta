#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { collectGuidesInventory } from './guides-inventory-lib.mjs';

const projectRoot = process.cwd();

const FLOW_STAGES = [
  'setup',
  'configuration',
  'operation',
  'troubleshooting',
  'optimization',
];

const FLOW_STAGE_HEADING_PREFIX = {
  setup: '[setup]',
  configuration: '[configuration]',
  operation: '[operation]',
  troubleshooting: '[troubleshooting]',
  optimization: '[optimization]',
};

const FLOW_STAGE_PATTERNS = {
  setup: [/\[setup\]/i, /\bsetup\b/i, /\bprerequisite/i, /\bbootstrap/i, /\bonboarding?\b/i],
  configuration: [
    /\[configuration\]/i,
    /\bconfiguration\b/i,
    /\bconfig\b/i,
    /\bsettings?\b/i,
    /\benv\b/i,
    /\bflag\b/i,
  ],
  operation: [/\[operation\]/i, /\boperation(al)?\b/i, /\bworkflow\b/i, /\bexecution\b/i, /\busage\b/i, /\bruntime\b/i],
  troubleshooting: [/\[troubleshooting\]/i, /\btroubleshooting\b/i, /\bdebug\b/i, /\bfailure\b/i, /\brecovery\b/i, /\bincident\b/i, /\bverification\b/i],
  optimization: [/\[optimization\]/i, /\boptimization\b/i, /\boptimisation\b/i, /\bperformance\b/i, /\bscal(a|i)ng\b/i, /\bbest practice/i, /\bslo\b/i],
};

const SETTINGS_COVERAGE_PATTERN =
  /\b(configuration|config|setting|settings|env|environment variable|flag|profile)\b/i;

const TEMPLATE_RULES = {
  'holistic-whole-app': {
    minSections: 7,
    minWords: 360,
    minVisuals: 2,
    minCodeBlocks: 2,
    minNoteBlocks: 0,
    minRichBlocks: 4,
    requiresCode: true,
    requiredFlowStages: FLOW_STAGES,
    requireSettingsCoverageForAppGuides: true,
  },
  'feature-deep-dive': {
    minSections: 5,
    minWords: 220,
    minVisuals: 1,
    minCodeBlocks: 1,
    minNoteBlocks: 1,
    minRichBlocks: 3,
    requiresCode: true,
    requiredFlowStages: FLOW_STAGES,
    requireSettingsCoverageForAppGuides: true,
  },
  'process-workflow': {
    minSections: 5,
    minWords: 240,
    minVisuals: 1,
    minCodeBlocks: 1,
    minNoteBlocks: 0,
    minRichBlocks: 3,
    requiresCode: true,
    requiredFlowStages: FLOW_STAGES,
    requireSettingsCoverageForAppGuides: true,
  },
  'setting-configuration': {
    minSections: 5,
    minWords: 220,
    maxWords: Infinity,
    minVisuals: 1,
    minVisualCoverageRatio: 0,
    maxSectionBodyWords: Infinity,
    minCodeBlocks: 1,
    minNoteBlocks: 1,
    minRichBlocks: 3,
    requiresCode: true,
    requiredFlowStages: FLOW_STAGES,
    requireSettingsCoverageForAppGuides: true,
  },
  'visual-interactive-journey': {
    minSections: 5,
    minWords: 120,
    maxWords: 420,
    minVisuals: 4,
    minVisualCoverageRatio: 0.8,
    maxSectionBodyWords: 45,
    minCodeBlocks: 0,
    minNoteBlocks: 0,
    minRichBlocks: 5,
    requiresCode: false,
    requiredFlowStages: FLOW_STAGES,
    requireSettingsCoverageForAppGuides: true,
  },
};

for (const templateId of Object.keys(TEMPLATE_RULES)) {
  const rule = TEMPLATE_RULES[templateId];
  if (rule.maxWords === undefined) rule.maxWords = Infinity;
  if (rule.minVisualCoverageRatio === undefined) rule.minVisualCoverageRatio = 0;
  if (rule.maxSectionBodyWords === undefined) rule.maxSectionBodyWords = Infinity;
}

function fail(message) {
  console.error(`\nGuide validation failed:\n${message}\n`);
  process.exit(1);
}

function parseGuideSource(source) {
  const bodyWordCounts = Array.from(
    source.matchAll(/\bbody:\s*(`[\s\S]*?`|'(?:\\'|[^'])*'|"(?:\\"|[^"])*")/g),
    (match) => {
      const raw = match[1].slice(1, -1);
      const cleaned = raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned ? cleaned.split(' ').length : 0;
    },
  );

  const headings = Array.from(
    source.matchAll(/\bheading:\s*['"`]([^'"`]+)['"`]/g),
    (match) => match[1],
  );
  const app = source.match(/\bapp:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
  const codeBlockCount = (source.match(/\bcode:\s*['"`]/g) || []).length;
  const noteBlockCount = (source.match(/\bnote:\s*['"`]/g) || []).length;
  const visualHtmlCount = (
    source.match(/\bvisual:\s*`[\s\S]*?<div[\s\S]*?class=/g) || []
  ).length;

  const headingCorpus = headings.join('\n');
  const fullCorpus = `${headingCorpus}\n${source}`;

  return {
    app,
    headings,
    headingCorpus,
    fullCorpus,
    bodyWordCounts,
    codeBlockCount,
    noteBlockCount,
    visualHtmlCount,
  };
}

function getFlowCoverage(headings, source) {
  const sectionCorpus = headings.join('\n');
  const sourceWithoutMarkup = source.replace(/<[^>]*>/g, ' ');
  const scanCorpus = `${sectionCorpus}\n${sourceWithoutMarkup}`;
  const covered = {};

  for (const stage of FLOW_STAGES) {
    covered[stage] = FLOW_STAGE_PATTERNS[stage].some((pattern) =>
      pattern.test(scanCorpus),
    );
  }
  return covered;
}

function getCanonicalFlowOrderDiagnostics(headings) {
  const firstIndexByStage = new Map();

  headings.forEach((heading, index) => {
    const normalized = heading.trim().toLowerCase();
    for (const stage of FLOW_STAGES) {
      if (
        normalized.startsWith(FLOW_STAGE_HEADING_PREFIX[stage]) &&
        !firstIndexByStage.has(stage)
      ) {
        firstIndexByStage.set(stage, index);
      }
    }
  });

  const missingStages = FLOW_STAGES.filter((stage) => !firstIndexByStage.has(stage));
  const outOfOrderStages = [];
  let lastIndex = -1;

  for (const stage of FLOW_STAGES) {
    const stageIndex = firstIndexByStage.get(stage);
    if (stageIndex === undefined) continue;
    if (stageIndex < lastIndex) {
      outOfOrderStages.push(stage);
    }
    lastIndex = Math.max(lastIndex, stageIndex);
  }

  return { missingStages, outOfOrderStages };
}

let inventory;
try {
  inventory = collectGuidesInventory(projectRoot);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const guides = inventory.modules.map((guide) => ({
  ...guide,
  filePath: path.join(projectRoot, guide.file),
}));

if (guides.length === 0) {
  fail('No guide modules found in content/guides.');
}

const errors = [];

if (inventory.diagnostics.parseError) {
  errors.push(`[index.ts] ${inventory.diagnostics.parseError}`);
}

for (const duplicate of inventory.diagnostics.duplicateSlugs) {
  errors.push(`duplicate slug '${duplicate.slug}' across: ${duplicate.files.join(', ')}.`);
}

for (const entry of inventory.diagnostics.missingStatus) {
  const target = entry.file ?? entry.exportName;
  errors.push(`[${target}] missing explicit status in allGuides registration.`);
}

for (const entry of inventory.diagnostics.invalidStatus) {
  errors.push(
    `[${entry.exportName}] invalid status '${entry.status}' in allGuides registration.`,
  );
}

for (const exportName of inventory.diagnostics.registrationWithoutImport) {
  errors.push(
    `[${exportName}] allGuides registration has no matching import in content/guides/index.ts.`,
  );
}

for (const entry of inventory.diagnostics.importWithoutRegistration) {
  errors.push(
    `[${entry.file}] imported as '${entry.exportName}' but not registered in allGuides.`,
  );
}

for (const orphan of inventory.orphan) {
  errors.push(`[${orphan.file}] orphan guide module (not registered in allGuides).`);
}

const slugSet = new Set();
for (const guide of guides) {
  if (!guide.slug) {
    errors.push(`[${path.basename(guide.filePath)}] missing slug.`);
    continue;
  }
  if (slugSet.has(guide.slug)) {
    errors.push(`[${path.basename(guide.filePath)}] duplicate slug '${guide.slug}'.`);
  }
  slugSet.add(guide.slug);
}

for (const guide of guides) {
  const fileName = path.basename(guide.filePath);

  if (!guide.template) {
    errors.push(`[${fileName}] missing template.`);
    continue;
  }

  const templateRule = TEMPLATE_RULES[guide.template];
  if (!templateRule) {
    errors.push(`[${fileName}] unknown template '${guide.template}'.`);
    continue;
  }

  const source = fs.readFileSync(guide.filePath, 'utf8');
  const parsed = parseGuideSource(source);
  const richBlockCount =
    parsed.codeBlockCount + parsed.noteBlockCount + (guide.visualCount ?? 0);
  const flowCoverage = getFlowCoverage(parsed.headings, source);
  const missingStages = templateRule.requiredFlowStages.filter(
    (stage) => !flowCoverage[stage],
  );
  const canonicalFlow = getCanonicalFlowOrderDiagnostics(parsed.headings);

  if (guide.headingCount < templateRule.minSections) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least ${templateRule.minSections} sections (found ${guide.headingCount}).`,
    );
  }

  if (guide.wordCount < templateRule.minWords) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least ${templateRule.minWords} words (found ${guide.wordCount}).`,
    );
  }
  if (guide.wordCount > templateRule.maxWords) {
    errors.push(
      `[${fileName}] template '${guide.template}' allows at most ${templateRule.maxWords} words (found ${guide.wordCount}).`,
    );
  }

  if (templateRule.requiresCode && !guide.hasCode) {
    errors.push(`[${fileName}] template '${guide.template}' requires at least one code block.`);
  }

  if (parsed.codeBlockCount < templateRule.minCodeBlocks) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least ${templateRule.minCodeBlocks} code block(s) (found ${parsed.codeBlockCount}).`,
    );
  }

  if (parsed.noteBlockCount < templateRule.minNoteBlocks) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least ${templateRule.minNoteBlocks} note block(s) (found ${parsed.noteBlockCount}).`,
    );
  }

  if ((guide.visualCount ?? 0) < templateRule.minVisuals) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least ${templateRule.minVisuals} visual block(s) (found ${guide.visualCount ?? 0}).`,
    );
  }

  const visualCoverage = guide.headingCount === 0 ? 0 : (guide.visualCount ?? 0) / guide.headingCount;
  if (visualCoverage < templateRule.minVisualCoverageRatio) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires visual coverage ratio >= ${templateRule.minVisualCoverageRatio} (found ${visualCoverage.toFixed(2)}).`,
    );
  }

  if (parsed.visualHtmlCount < templateRule.minVisuals) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires visual blocks with structured HTML markup (div + class) for at least ${templateRule.minVisuals} section(s) (found ${parsed.visualHtmlCount}).`,
    );
  }

  if (richBlockCount < templateRule.minRichBlocks) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least ${templateRule.minRichBlocks} rich content blocks (code + note + visual, found ${richBlockCount}).`,
    );
  }

  const sectionBodyOverages = parsed.bodyWordCounts
    .map((wordCount, index) => ({ index, wordCount }))
    .filter((entry) => entry.wordCount > templateRule.maxSectionBodyWords);
  for (const overage of sectionBodyOverages) {
    errors.push(
      `[${fileName}] template '${guide.template}' section ${overage.index + 1} exceeds max body words (${overage.wordCount} > ${templateRule.maxSectionBodyWords}).`,
    );
  }

  if (missingStages.length > 0) {
    errors.push(
      `[${fileName}] template '${guide.template}' missing required flow stage coverage: ${missingStages.join(', ')}.`,
    );
  }

  if (canonicalFlow.missingStages.length > 0) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires explicit lifecycle heading prefixes for stages: ${canonicalFlow.missingStages.join(', ')}. Use headings like [Setup], [Configuration], [Operation], [Troubleshooting], [Optimization].`,
    );
  }

  if (canonicalFlow.outOfOrderStages.length > 0) {
    errors.push(
      `[${fileName}] template '${guide.template}' lifecycle stage headings are out of order for: ${canonicalFlow.outOfOrderStages.join(', ')}. Keep canonical order from [Setup] to [Optimization].`,
    );
  }

  const isAppFocused = parsed.app && parsed.app !== 'general';
  if (
    isAppFocused &&
    templateRule.requireSettingsCoverageForAppGuides &&
    !SETTINGS_COVERAGE_PATTERN.test(parsed.fullCorpus)
  ) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires explicit settings/config coverage for app-focused guides.`,
    );
  }

  for (const targetSlug of guide.links) {
    if (!slugSet.has(targetSlug)) {
      errors.push(`[${fileName}] broken internal guide link '/guides/${targetSlug}'.`);
    }
  }
}

if (errors.length > 0) {
  fail(`- ${errors.join('\n- ')}`);
}

console.log(
  `Guide validation passed for ${guides.length} guide modules (${[...slugSet].length} unique slugs, registered=${inventory.published.length + inventory.draft.length}).`,
);
