#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const baselinePath = join(repoRoot, 'scripts', 'lint-warning-baseline.json');
const shouldWrite = process.argv.includes('--write');

function runEslintJson() {
  const result = spawnSync(
    'npx',
    ['eslint', 'src', '-f', 'json'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (!result.stdout?.trim()) {
    throw new Error('eslint returned no JSON output.');
  }

  /** @type {Array<{ filePath: string, messages: Array<{ severity: number, ruleId: string | null }> }>} */
  const files = JSON.parse(result.stdout);
  const ruleCounts = new Map();
  let warnings = 0;
  let errors = 0;

  for (const file of files) {
    for (const message of file.messages) {
      if (message.severity === 1) {
        warnings += 1;
        const ruleId = message.ruleId ?? 'unknown';
        ruleCounts.set(ruleId, (ruleCounts.get(ruleId) ?? 0) + 1);
      } else if (message.severity === 2) {
        errors += 1;
      }
    }
  }

  return { warnings, errors, ruleCounts };
}

function toObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function printTopRules(ruleCounts) {
  const top = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length === 0) return;
  console.log('Top warning rules:');
  for (const [rule, count] of top) {
    console.log(`  - ${rule}: ${count}`);
  }
}

function loadBaseline() {
  if (!existsSync(baselinePath)) {
    return null;
  }
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function writeBaseline({ warnings, ruleCounts }) {
  const payload = {
    maxWarnings: warnings,
    updatedAt: new Date().toISOString(),
    command: 'npx eslint src -f json',
    ruleCounts: toObject(ruleCounts),
  };
  writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Updated lint warning baseline: ${warnings} warnings`);
  console.log(`Baseline file: ${baselinePath}`);
}

function main() {
  const { warnings, errors, ruleCounts } = runEslintJson();

  if (errors > 0) {
    console.error(`Lint errors detected: ${errors}`);
    process.exit(1);
  }

  if (shouldWrite) {
    writeBaseline({ warnings, ruleCounts });
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error('No lint warning baseline found.');
    console.error(`Run: node scripts/lint-warning-budget.mjs --write`);
    process.exit(1);
  }

  const maxWarnings = Number(baseline.maxWarnings);
  if (!Number.isFinite(maxWarnings) || maxWarnings < 0) {
    console.error(`Invalid maxWarnings in baseline: ${baseline.maxWarnings}`);
    process.exit(1);
  }

  if (warnings > maxWarnings) {
    console.error(`Warning budget exceeded: ${warnings} > ${maxWarnings}`);
    printTopRules(ruleCounts);
    process.exit(1);
  }

  const delta = maxWarnings - warnings;
  console.log(`Warning budget OK: ${warnings}/${maxWarnings}${delta > 0 ? ` (${delta} below baseline)` : ''}`);
  printTopRules(ruleCounts);
}

main();

