#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const APP_DIR_PATTERN = /^1[A-Z]-/;
const CSP_HEADER_KEY = 'content-security-policy';

function tokenizeDirectiveValue(value) {
  return value.match(/'[^']*'|[^\s]+/g) ?? [];
}

function parseCsp(cspValue) {
  return cspValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split(/\s+/);
      return { name, value: rest.join(' ') };
    });
}

function collectVercelConfigs() {
  return readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && APP_DIR_PATTERN.test(entry.name))
    .map((entry) => path.join(workspaceRoot, entry.name, 'vercel.json'))
    .filter((configPath) => existsSync(configPath));
}

function collectDynamicCspSourceFiles() {
  return readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && APP_DIR_PATTERN.test(entry.name))
    .flatMap((entry) => {
      const appRoot = path.join(workspaceRoot, entry.name);
      return [
        path.join(appRoot, 'proxy.ts'),
        path.join(appRoot, 'middleware.ts'),
        path.join(appRoot, 'src', 'proxy.ts'),
        path.join(appRoot, 'src', 'middleware.ts'),
      ];
    })
    .filter((sourcePath) => existsSync(sourcePath));
}

function collectUnsafeInlineScriptSrcInSource(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);
  const violations = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (line.includes('script-src') && line.includes('unsafe-inline')) {
      violations.push({
        filePath,
        lineNumber: index + 1,
        line: line.trim(),
      });
    }
  }
  return violations;
}

function main() {
  const vercelConfigs = collectVercelConfigs();
  const dynamicSourceFiles = collectDynamicCspSourceFiles();
  const violations = [];

  for (const configPath of vercelConfigs) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    for (const headerRule of config.headers ?? []) {
      const source = headerRule.source ?? '(unknown source)';
      for (const header of headerRule.headers ?? []) {
        if (String(header.key).toLowerCase() !== CSP_HEADER_KEY) continue;
        const directives = parseCsp(String(header.value));
        const scriptDirective = directives.find((directive) => directive.name === 'script-src');
        if (!scriptDirective) continue;
        const tokens = tokenizeDirectiveValue(scriptDirective.value);
        if (tokens.includes("'unsafe-inline'") || tokens.includes('unsafe-inline')) {
          violations.push({
            kind: 'vercel',
            configPath,
            source,
            scriptSrc: scriptDirective.value,
          });
        }
      }
    }
  }

  for (const sourcePath of dynamicSourceFiles) {
    const sourceViolations = collectUnsafeInlineScriptSrcInSource(sourcePath);
    for (const sourceViolation of sourceViolations) {
      violations.push({
        kind: 'source',
        ...sourceViolation,
      });
    }
  }

  if (violations.length > 0) {
    console.error('FAIL: script-src contains unsafe-inline in Vercel config:');
    for (const violation of violations) {
      if (violation.kind === 'vercel') {
        const relativePath = path.relative(workspaceRoot, violation.configPath);
        console.error(`- ${relativePath} (header source: ${violation.source})`);
        console.error(`  script-src ${violation.scriptSrc}`);
      } else {
        const relativePath = path.relative(workspaceRoot, violation.filePath);
        console.error(`- ${relativePath}:${violation.lineNumber}`);
        console.error(`  ${violation.line}`);
      }
    }
    process.exit(1);
  }

  console.log(
    `PASS: script-src unsafe-inline check (${vercelConfigs.length} vercel.json files + ${dynamicSourceFiles.length} CSP source files scanned)`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
