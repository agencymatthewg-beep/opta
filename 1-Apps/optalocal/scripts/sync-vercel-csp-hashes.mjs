#!/usr/bin/env node

import crypto from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const TARGET_APPS = [
  '1O-Opta-Init',
  '1U-Opta-Help',
];

const CSP_HEADER_KEY = 'content-security-policy';
const HASH_TOKEN = /^'sha(?:256|384|512)-[^']+'$/;
const INLINE_SCRIPT_REGEX = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function walkHtmlFiles(dirPath) {
  const files = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

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

function serializeCsp(directives) {
  return directives
    .map((directive) =>
      directive.value.length > 0 ? `${directive.name} ${directive.value}` : directive.name
    )
    .join('; ');
}

function dedupeOrdered(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    output.push(item);
  }
  return output;
}

function computeScriptHashes(outDirPath) {
  const htmlFiles = walkHtmlFiles(outDirPath);
  const hashes = new Set();
  let inlineScriptCount = 0;

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8');
    for (const match of html.matchAll(INLINE_SCRIPT_REGEX)) {
      inlineScriptCount += 1;
      const scriptBody = match[1].trim();
      if (scriptBody.length === 0) continue;
      const hash = crypto.createHash('sha256').update(scriptBody).digest('base64');
      hashes.add(`'sha256-${hash}'`);
    }
  }

  return {
    htmlFiles: htmlFiles.length,
    inlineScripts: inlineScriptCount,
    hashes: [...hashes].sort(),
  };
}

function updateScriptSrc(cspValue, scriptHashes) {
  const directives = parseCsp(cspValue);
  const scriptDirective = directives.find((directive) => directive.name === 'script-src');
  if (!scriptDirective) {
    throw new Error('CSP is missing script-src directive');
  }

  const scriptTokens = tokenizeDirectiveValue(scriptDirective.value);
  const baseTokens = scriptTokens.filter(
    (token) => token !== "'unsafe-inline'" && token !== 'unsafe-inline' && !HASH_TOKEN.test(token)
  );
  const orderedBaseTokens = baseTokens.includes("'self'")
    ? ["'self'", ...baseTokens.filter((token) => token !== "'self'")]
    : baseTokens;

  scriptDirective.value = dedupeOrdered([...orderedBaseTokens, ...scriptHashes]).join(' ');
  return serializeCsp(directives);
}

function syncAppCsp(appPath) {
  const appRoot = path.join(workspaceRoot, appPath);
  const outDirPath = path.join(appRoot, 'out');
  const vercelConfigPath = path.join(appRoot, 'vercel.json');

  if (!existsSync(outDirPath)) {
    throw new Error(`[${appPath}] static export not found at ${outDirPath}. Run build first.`);
  }
  if (!existsSync(vercelConfigPath)) {
    throw new Error(`[${appPath}] missing Vercel config at ${vercelConfigPath}.`);
  }

  const { htmlFiles, inlineScripts, hashes } = computeScriptHashes(outDirPath);
  if (hashes.length === 0) {
    throw new Error(`[${appPath}] no inline scripts found to hash in ${outDirPath}.`);
  }

  const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, 'utf8'));
  let updatedPolicies = 0;

  for (const headerRule of vercelConfig.headers ?? []) {
    for (const header of headerRule.headers ?? []) {
      if (String(header.key).toLowerCase() !== CSP_HEADER_KEY) continue;
      header.value = updateScriptSrc(String(header.value), hashes);
      updatedPolicies += 1;
    }
  }

  if (updatedPolicies === 0) {
    throw new Error(`[${appPath}] no Content-Security-Policy header found in vercel.json.`);
  }

  writeFileSync(vercelConfigPath, `${JSON.stringify(vercelConfig, null, 2)}\n`);

  console.log(
    `[${appPath}] synced script-src hashes (${hashes.length} unique hashes, ${inlineScripts} inline scripts, ${htmlFiles} HTML files)`
  );
}

function main() {
  for (const appPath of TARGET_APPS) {
    syncAppCsp(appPath);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
