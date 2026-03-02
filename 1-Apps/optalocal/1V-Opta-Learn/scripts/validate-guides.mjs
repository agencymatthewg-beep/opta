#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const guidesRoot = path.join(projectRoot, 'content', 'guides');
const indexPath = path.join(guidesRoot, 'index.ts');

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

if (!fs.existsSync(indexPath)) {
  fail(`index.ts not found at ${indexPath}`);
}

const indexSource = fs.readFileSync(indexPath, 'utf8');
const importMatches = Array.from(
  indexSource.matchAll(/from '\.\/([a-z0-9-]+)'/gi),
  (m) => m[1],
).filter((name) => name !== 'templates');

const activeGuideFiles = [...new Set(importMatches)]
  .map((name) => path.join(guidesRoot, `${name}.ts`))
  .filter((filePath) => fs.existsSync(filePath));

if (activeGuideFiles.length === 0) {
  fail('No active guide modules found via content/guides/index.ts imports.');
}

const guides = activeGuideFiles.map((filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const slug = source.match(/slug:\s*'([^']+)'/)?.[1];
  const template = source.match(/template:\s*'([^']+)'/)?.[1];
  const headingCount = (source.match(/\bheading:\s*['`"]/g) || []).length;
  const hasCode = /\bcode:\s*['`"]/.test(source);
  const links = Array.from(
    source.matchAll(/href=["']\/guides\/([a-z0-9-]+)["']/gi),
    (m) => m[1],
  );

  // Approximate text corpus for word-count enforcement.
  const textCorpus = source
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = textCorpus ? textCorpus.split(' ').length : 0;

  return { filePath, source, slug, template, headingCount, hasCode, links, wordCount };
});

const errors = [];

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
  `Guide validation passed for ${guides.length} active guides (${[...slugSet].length} unique slugs).`,
);
