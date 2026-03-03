#!/usr/bin/env node

import path from 'node:path';
import { collectGuidesInventory } from './guides-inventory-lib.mjs';

const projectRoot = process.cwd();

const TEMPLATE_RULES = {
  'holistic-whole-app': { minSections: 4, minWords: 220, requiresCode: false },
  'feature-deep-dive': { minSections: 4, minWords: 160, requiresCode: false },
  'process-workflow': { minSections: 3, minWords: 130, requiresCode: true },
  'setting-configuration': { minSections: 4, minWords: 120, requiresCode: true },
};

function fail(message) {
  console.error(`\nGuide validation failed:\n${message}\n`);
  process.exit(1);
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
  errors.push(
    `duplicate slug '${duplicate.slug}' across: ${duplicate.files.join(', ')}.`,
  );
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

  if (templateRule.requiresCode && !guide.hasCode) {
    errors.push(
      `[${fileName}] template '${guide.template}' requires at least one code block.`,
    );
  }

  for (const targetSlug of guide.links) {
    if (!slugSet.has(targetSlug)) {
      errors.push(
        `[${fileName}] broken internal guide link '/guides/${targetSlug}'.`,
      );
    }
  }
}

if (errors.length > 0) {
  fail(`- ${errors.join('\n- ')}`);
}

console.log(
  `Guide validation passed for ${guides.length} guide modules (${[...slugSet].length} unique slugs, registered=${inventory.published.length + inventory.draft.length}).`,
);
