#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const ROUTE_MAP_PATH = path.join(repoRoot, 'lib', 'learn-route-guide-map.json');
const GUIDE_ALIAS_PATH = path.join(repoRoot, 'lib', 'learn-guide-slug-aliases.json');
const SYNCED_MANIFEST_PATH = path.join(repoRoot, 'lib', 'generated', 'learn-guides-manifest.json');

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function normalizeRouteMap(input) {
  if (!Array.isArray(input)) {
    throw new Error('Route map must be an array');
  }

  return input.map((rule, index) => {
    const docsPrefix = typeof rule?.docsPrefix === 'string' ? rule.docsPrefix.trim() : '';
    const guides = Array.isArray(rule?.guides)
      ? rule.guides.filter((slug) => typeof slug === 'string' && slug.trim().length > 0)
      : [];

    if (!docsPrefix) {
      throw new Error(`Route map rule #${index + 1} is missing docsPrefix`);
    }

    if (guides.length === 0) {
      throw new Error(`Route map rule #${index + 1} (${docsPrefix}) has no guide slugs`);
    }

    return { docsPrefix, guides };
  });
}

function normalizeManifestSlugs(manifest) {
  const slugSet = new Set();
  for (const guide of manifest?.guides ?? []) {
    if (typeof guide?.slug === 'string' && guide.slug.trim().length > 0) {
      slugSet.add(guide.slug.trim());
    }
  }

  if (slugSet.size === 0) {
    throw new Error('Synced Learn manifest has no guide slugs');
  }

  return slugSet;
}

function normalizeGuideAliases(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Guide alias map must be an object');
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter(([legacySlug, canonicalSlug]) =>
        typeof legacySlug === 'string'
        && legacySlug.trim().length > 0
        && typeof canonicalSlug === 'string'
        && canonicalSlug.trim().length > 0)
      .map(([legacySlug, canonicalSlug]) => [legacySlug.trim(), canonicalSlug.trim()])
  );
}

async function main() {
  const [routeMapRaw, guideAliasesRaw, manifestRaw] = await Promise.all([
    readJson(ROUTE_MAP_PATH),
    readJson(GUIDE_ALIAS_PATH),
    readJson(SYNCED_MANIFEST_PATH),
  ]);

  const routeMap = normalizeRouteMap(routeMapRaw);
  const guideAliases = normalizeGuideAliases(guideAliasesRaw);
  const manifestSlugs = normalizeManifestSlugs(manifestRaw);
  const source = typeof manifestRaw?.source === 'string' ? manifestRaw.source : 'unknown';

  const missing = [];
  for (const rule of routeMap) {
    for (const slug of rule.guides) {
      const resolvedSlug = guideAliases[slug] ?? slug;
      if (!manifestSlugs.has(resolvedSlug)) {
        missing.push({ docsPrefix: rule.docsPrefix, slug, resolvedSlug });
      }
    }
  }

  console.log('validate-learn-links summary:');
  console.log(`- manifest source: ${source}`);
  console.log(`- manifest guide slugs: ${manifestSlugs.size}`);
  console.log(`- mapped rules: ${routeMap.length}`);
  console.log(`- slug aliases: ${Object.keys(guideAliases).length}`);

  if (missing.length > 0) {
    console.error(`FAIL Learn link validation (${missing.length} missing mapping${missing.length === 1 ? '' : 's'})`);
    for (const issue of missing) {
      console.error(`- ${issue.docsPrefix} -> ${issue.slug} (resolved: ${issue.resolvedSlug})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('PASS Learn link validation');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
