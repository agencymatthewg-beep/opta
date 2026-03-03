#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildGuidesManifest,
  collectGuidesInventory,
  normalizeManifestForComparison,
} from './guides-inventory-lib.mjs';

const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, 'public', 'guides-manifest.json');
const checkMode = process.argv.includes('--check');

function fail(message) {
  console.error(`\nGuides inventory ${checkMode ? 'check' : 'generation'} failed:\n${message}\n`);
  process.exit(1);
}

function toManifestJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

let inventory;
try {
  inventory = collectGuidesInventory(projectRoot);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const manifest = buildGuidesManifest(inventory);

const nextContent = toManifestJson(manifest);

if (checkMode) {
  if (!fs.existsSync(outputPath)) {
    fail(`Manifest missing: ${path.relative(projectRoot, outputPath)}. Run npm run guides:inventory`);
  }
  const currentContent = fs.readFileSync(outputPath, 'utf8');
  let currentManifest;
  try {
    currentManifest = JSON.parse(currentContent);
  } catch {
    fail(`Manifest JSON is invalid: ${path.relative(projectRoot, outputPath)}.`);
  }

  const expectedForComparison = normalizeManifestForComparison(manifest);
  const currentForComparison = normalizeManifestForComparison(currentManifest);
  if (JSON.stringify(currentForComparison) !== JSON.stringify(expectedForComparison)) {
    fail(`Manifest is stale: ${path.relative(projectRoot, outputPath)}. Run npm run guides:inventory`);
  }
  console.log(`Guides manifest is up-to-date: ${path.relative(projectRoot, outputPath)}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, nextContent, 'utf8');

console.log(
  `Wrote ${path.relative(projectRoot, outputPath)} (published=${manifest.counts.published}, draft=${manifest.counts.draft}, orphan=${manifest.counts.orphan}).`,
);
