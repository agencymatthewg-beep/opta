#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(APP_ROOT, 'src');

const INVALID_KIND_PATTERNS = [
  /kind\s*:\s*['"]correction['"]/g,
  /kind:\s*LearningEntryKindSchema[\s\S]*['"]correction['"]/g,
];

const LEARNING_KIND_ENUM_PATTERN =
  /LearningEntryKindSchema\s*=\s*z\.enum\(\s*\[[\s\S]*?['"]correction['"][\s\S]*?\]\s*\)/g;

async function listSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineNumberForOffset(content, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

async function main() {
  const files = await listSourceFiles(SRC_DIR);
  const violations = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const relativePath = path.relative(APP_ROOT, filePath);

    for (const pattern of INVALID_KIND_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        const offset = match.index ?? 0;
        const line = lineNumberForOffset(content, offset);
        violations.push({
          file: relativePath,
          line,
          reason: `Invalid learning kind literal detected: ${match[0]}`,
        });
      }
    }

    if (relativePath === 'src/learning/types.ts') {
      LEARNING_KIND_ENUM_PATTERN.lastIndex = 0;
      const match = LEARNING_KIND_ENUM_PATTERN.exec(content);
      if (match) {
        const offset = match.index ?? 0;
        const line = lineNumberForOffset(content, offset);
        violations.push({
          file: relativePath,
          line,
          reason: 'LearningEntryKindSchema includes forbidden value "correction"',
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error('\nLearning-kind guard failed:\n');
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} — ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log('Learning-kind guard passed.');
}

await main();
