#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(appRoot, 'docs');
const staleWorkflowPathPatterns = ['1-Apps/../.github/workflows/', '../.github/workflows/'];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findWorkspaceRoot(startDir) {
  let current = startDir;
  while (true) {
    const workflowsDir = path.join(current, '.github', 'workflows');
    if (await fileExists(workflowsDir)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function collectMatches(line, regex) {
  const matches = [];
  for (const match of line.matchAll(regex)) {
    if (typeof match[0] === 'string' && match[0].length > 0) {
      matches.push(match[0]);
    }
  }
  return matches;
}

function trimTrailingPunctuation(value) {
  return value.replace(/[),.;:]+$/g, '');
}

async function main() {
  const workspaceRoot = await findWorkspaceRoot(appRoot);
  const docsEntries = await readdir(docsRoot, { withFileTypes: true });
  const docsFiles = docsEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => path.join(docsRoot, entry.name))
    .sort();

  const errors = [];
  const docRefRegex = /\bdocs\/[A-Za-z0-9._/-]+\.md\b/g;
  const workflowRefRegex = /\/\.github\/workflows\/[A-Za-z0-9._-]+\.yml\b/g;

  for (const filePath of docsFiles) {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNo = index + 1;

      for (const staleFragment of staleWorkflowPathPatterns) {
        if (line.includes(staleFragment)) {
          errors.push(`${path.relative(appRoot, filePath)}:${lineNo} contains stale workflow path fragment "${staleFragment}"`);
        }
      }

      const docRefs = collectMatches(line, docRefRegex);
      for (const ref of docRefs) {
        const cleanedRef = trimTrailingPunctuation(ref);
        const targetPath = path.join(appRoot, cleanedRef);
        // Active docs can reference archive docs, but references must resolve.
        if (!(await fileExists(targetPath))) {
          errors.push(`${path.relative(appRoot, filePath)}:${lineNo} references missing doc "${cleanedRef}"`);
        }
      }

      const workflowRefs = collectMatches(line, workflowRefRegex);
      for (const workflowRef of workflowRefs) {
        const cleanedRef = trimTrailingPunctuation(workflowRef);
        const relativeWorkflowPath = cleanedRef.startsWith('/') ? cleanedRef.slice(1) : cleanedRef;
        const targetPath = path.join(workspaceRoot, relativeWorkflowPath);
        if (!(await fileExists(targetPath))) {
          errors.push(
            `${path.relative(appRoot, filePath)}:${lineNo} references missing workflow "${cleanedRef}"`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(`FAIL docs reference validation (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`PASS docs reference validation (${docsFiles.length} docs file${docsFiles.length === 1 ? '' : 's'})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
