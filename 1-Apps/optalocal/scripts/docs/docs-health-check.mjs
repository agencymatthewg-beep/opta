#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const canonicalDocs = [
  'APP.md',
  'docs/README.md',
  'docs/INDEX.md',
  'docs/ARCHITECTURE.md',
  'docs/ECOSYSTEM.md',
  'docs/GUARDRAILS.md',
  'docs/KNOWLEDGE.md',
  'docs/WORKFLOWS.md',
  'docs/DECISIONS.md',
  'docs/ROADMAP.md',
  'docs/PRODUCT-MODEL.md',
  'docs/reports/OPTALOCAL-DOCS-STATUS.md',
  'docs/standards/DOCUMENTATION-SYSTEM.md',
];

const freshnessRequired = new Set([
  'APP.md',
  'docs/README.md',
  'docs/INDEX.md',
  'docs/ARCHITECTURE.md',
  'docs/ECOSYSTEM.md',
  'docs/GUARDRAILS.md',
  'docs/KNOWLEDGE.md',
  'docs/WORKFLOWS.md',
  'docs/DECISIONS.md',
  'docs/ROADMAP.md',
  'docs/PRODUCT-MODEL.md',
  'docs/reports/OPTALOCAL-DOCS-STATUS.md',
  'docs/standards/DOCUMENTATION-SYSTEM.md',
]);

const legacyAliases = [
  '1L-Opta-LMX-Dashboard',
  '1P-Opta-Code-Universal',
];

const errors = [];
const warnings = [];

function recordError(file, message) {
  errors.push({ file, message });
}

function recordWarning(file, message) {
  warnings.push({ file, message });
}

function readText(relPath) {
  const absPath = path.join(root, relPath);
  if (!existsSync(absPath)) {
    recordError(relPath, 'file missing');
    return null;
  }
  return readFileSync(absPath, 'utf8');
}

function extractFreshnessDate(content) {
  const inlineMatch = content.match(/(?:Last updated|Updated):\s*(\d{4}-\d{2}-\d{2})/i);
  if (inlineMatch) return inlineMatch[1];

  const frontmatterMatch = content.match(/^\s*---[\s\S]*?\b(?:last_updated|updated)\s*:\s*(\d{4}-\d{2}-\d{2})[\s\S]*?---/i);
  if (frontmatterMatch) return frontmatterMatch[1];

  return null;
}

for (const file of canonicalDocs) {
  const content = readText(file);
  if (content == null) continue;

  if (content.includes('<!--')) {
    recordError(file, 'contains template placeholder comments (`<!-- ... -->`)');
  }

  for (const alias of legacyAliases) {
    if (content.includes(alias)) {
      recordError(file, `contains legacy app alias: ${alias}`);
    }
  }

  const appPathMatches = content.match(/\b\d[A-Z]-[A-Za-z0-9-]+\b/g) ?? [];
  for (const appPath of new Set(appPathMatches)) {
    if (!existsSync(path.join(root, appPath))) {
      recordWarning(file, `references app path that does not exist in workspace: ${appPath}`);
    }
  }

  if (freshnessRequired.has(file)) {
    const freshnessDate = extractFreshnessDate(content);
    if (!freshnessDate) {
      recordError(
        file,
        'missing freshness marker (frontmatter `last_updated:` or inline `Last updated:` / `Updated:` with YYYY-MM-DD)',
      );
    } else {
      const date = new Date(`${freshnessDate}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) {
        recordError(file, `invalid freshness date: ${freshnessDate}`);
      } else {
        const ageDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays > 45) {
          recordWarning(file, `freshness marker is ${ageDays} days old (>45)`);
        }
      }
    }
  }
}

const registryPath = path.join(root, 'apps.registry.json');
if (!existsSync(registryPath)) {
  recordError('apps.registry.json', 'missing app registry');
} else {
  try {
    const apps = JSON.parse(readFileSync(registryPath, 'utf8'));
    const indexText = readText('docs/INDEX.md') ?? '';
    for (const app of apps) {
      if (!app?.path) continue;
      if (!indexText.includes(app.path)) {
        recordError('docs/INDEX.md', `missing app path from registry: ${app.path}`);
      }
    }
  } catch (err) {
    recordError('apps.registry.json', `invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (warnings.length > 0) {
  console.log('Documentation warnings:');
  for (const w of warnings) {
    console.log(`- ${w.file}: ${w.message}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.error('Documentation check failed.');
  for (const e of errors) {
    console.error(`- ${e.file}: ${e.message}`);
  }
  process.exit(1);
}

console.log(`Documentation check passed (${canonicalDocs.length} canonical docs verified).`);
