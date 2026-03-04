#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(workspaceRoot, 'websites.registry.json');

const targetPaths = [
  path.join(workspaceRoot, '1X-Opta-Admin', 'src', 'app', 'lib', 'websites.registry.generated.json'),
  path.join(workspaceRoot, '1S-Opta-Status', 'app', 'websites.registry.generated.json'),
];

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validateRegistry(parsed) {
  if (!isObject(parsed)) {
    throw new Error('Registry must be an object.');
  }
  if (!Array.isArray(parsed.websites)) {
    throw new Error('Registry.websites must be an array.');
  }
}

async function run() {
  const checkOnly = process.argv.includes('--check');
  const raw = await readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  validateRegistry(parsed);
  const normalized = `${JSON.stringify(parsed, null, 2)}\n`;

  const drifted = [];
  for (const targetPath of targetPaths) {
    if (checkOnly) {
      try {
        const existing = await readFile(targetPath, 'utf8');
        if (existing !== normalized) {
          drifted.push(targetPath);
        }
      } catch {
        drifted.push(targetPath);
      }
      continue;
    }

    await writeFile(targetPath, normalized, 'utf8');
    console.log(`Synced: ${path.relative(workspaceRoot, targetPath)}`);
  }

  if (checkOnly) {
    if (drifted.length > 0) {
      console.error('Website registry drift detected:');
      for (const targetPath of drifted) {
        console.error(`  - ${path.relative(workspaceRoot, targetPath)}`);
      }
      process.exit(1);
    }
    console.log('PASS website registry is in sync');
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sync-websites-registry failed: ${message}`);
  process.exit(1);
});
