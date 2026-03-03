#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildGuidesManifest,
  collectGuidesInventory,
  normalizeManifestForComparison,
} from './guides-inventory-lib.mjs';

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, 'public', 'guides-manifest.json');

function fail(message) {
  console.error(`\nGuide inventory check failed:\n- ${message}\n`);
  process.exit(1);
}

let inventory;
try {
  inventory = collectGuidesInventory(projectRoot);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const expectedManifest = `${JSON.stringify(buildGuidesManifest(inventory), null, 2)}\n`;
if (!fs.existsSync(manifestPath)) {
  fail(`Manifest missing: ${path.relative(projectRoot, manifestPath)}. Run npm run guides:inventory`);
}

const actualManifestRaw = fs.readFileSync(manifestPath, 'utf8');
let actualManifest;
try {
  actualManifest = JSON.parse(actualManifestRaw);
} catch {
  fail(`Manifest JSON is invalid: ${path.relative(projectRoot, manifestPath)}.`);
}
const expectedManifestObj = JSON.parse(expectedManifest);

const actualForComparison = normalizeManifestForComparison(actualManifest);
const expectedForComparison = normalizeManifestForComparison(expectedManifestObj);
if (JSON.stringify(actualForComparison) !== JSON.stringify(expectedForComparison)) {
  fail(`Manifest is stale: ${path.relative(projectRoot, manifestPath)}. Run npm run guides:inventory`);
}

console.log(`Guide inventory check passed: ${path.relative(projectRoot, manifestPath)} is up-to-date.`);
