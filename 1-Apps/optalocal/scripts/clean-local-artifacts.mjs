#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const registryPath = path.join(workspaceRoot, 'apps.registry.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const deep = args.has('--deep');

if (args.has('--help') || args.has('-h')) {
  console.log([
    'Clean local Opta workspace artifacts',
    '',
    'Usage:',
    '  node scripts/clean-local-artifacts.mjs [--dry-run] [--deep]',
    '',
    'Options:',
    '  --dry-run  Print targets without deleting',
    '  --deep     Also remove app dependency folders (node_modules, .venv)',
  ].join('\n'));
  process.exit(0);
}

const registryRaw = await readFile(registryPath, 'utf8');
const registry = JSON.parse(registryRaw);
if (!Array.isArray(registry)) {
  throw new Error('apps.registry.json must be an array');
}

const targets = new Set([
  '.e2e-artifacts',
  '.tmp-apple-cert',
  '1P-Opta-Code-Universal/test-results',
  '1D-Opta-CLI-TS/.opta/browser',
  '1D-Opta-CLI-TS/.opta/eslint-warnings.json',
  '1D-Opta-CLI-TS/tmp/eslint-report.json',
]);

async function collectNestedNodeModules(absStartPath, relStartPath, outTargets) {
  const stack = [[absStartPath, relStartPath]];

  while (stack.length > 0) {
    const [absDir, relDir] = stack.pop();
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const relChild = path.join(relDir, entry.name);
      const absChild = path.join(absDir, entry.name);
      if (entry.name === 'node_modules') {
        outTargets.add(relChild);
        continue;
      }
      stack.push([absChild, relChild]);
    }
  }
}

for (const app of registry) {
  if (!app?.path || typeof app.path !== 'string') continue;

  targets.add(path.join(app.path, '.next'));
  targets.add(path.join(app.path, '.pytest_cache'));

  if (deep && app.type === 'node') {
    targets.add(path.join(app.path, 'node_modules'));
    const absAppPath = path.join(workspaceRoot, app.path);
    await collectNestedNodeModules(absAppPath, app.path, targets);
  }
  if (deep && app.type === 'python') {
    targets.add(path.join(app.path, '.venv'));
  }
}

function isUnderWorkspace(absPath) {
  const normalizedRoot = `${workspaceRoot}${path.sep}`;
  return absPath === workspaceRoot || absPath.startsWith(normalizedRoot);
}

let removed = 0;
let missing = 0;

for (const relTarget of [...targets].sort()) {
  const absTarget = path.resolve(workspaceRoot, relTarget);
  if (!isUnderWorkspace(absTarget)) {
    throw new Error(`Refusing to clean path outside workspace: ${relTarget}`);
  }

  if (!existsSync(absTarget)) {
    missing += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] remove ${relTarget}`);
    removed += 1;
    continue;
  }

  await rm(absTarget, { recursive: true, force: true, maxRetries: 2 });
  console.log(`removed ${relTarget}`);
  removed += 1;
}

console.log(
  [
    '',
    `Clean complete (${dryRun ? 'dry-run' : 'apply'})`,
    `Targets removed: ${removed}`,
    `Targets already absent: ${missing}`,
    `Mode: ${deep ? 'deep' : 'standard'}`,
  ].join('\n')
);
