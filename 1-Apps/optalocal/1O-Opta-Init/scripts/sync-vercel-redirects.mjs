#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const vercelConfigPath = path.join(repoRoot, 'vercel.json');
const stableManifestPath = path.join(repoRoot, 'channels', 'stable.json');
const betaManifestPath = path.join(repoRoot, 'channels', 'beta.json');

const managedDownloadVersionPattern = /^\/downloads\/[^/]+\/v[^/]+\/:asset$/;

function ensureHttpsUrl(value, label) {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    throw new Error(`${label} must be an https URL`);
  }
}

function buildStaticRedirects() {
  return [
    {
      source: '/desktop-updates/manager/stable/:version/:asset',
      destination:
        'https://github.com/agencymatthewg-beep/opta/releases/download/opta-init-manager-stable-v:version/:asset',
      permanent: false,
    },
    {
      source: '/desktop-updates/manager/beta/:version/:asset',
      destination:
        'https://github.com/agencymatthewg-beep/opta/releases/download/opta-init-manager-beta-v:version/:asset',
      permanent: false,
    },
    {
      source: '/downloads/opta-cli/latest',
      destination:
        'https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz',
      permanent: false,
    },
    {
      source: '/downloads/cli',
      destination: '/downloads/opta-cli/latest',
      permanent: false,
    },
  ];
}

function buildComponentRedirects(manifest) {
  if (!manifest || typeof manifest !== 'object') return [];

  const notesUrl = manifest.release?.notesUrl;
  ensureHttpsUrl(notesUrl, `${manifest.channel ?? 'manifest'}.release.notesUrl`);

  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const redirects = [];

  for (const component of components) {
    if (!component || typeof component !== 'object') continue;
    const id = component.id;
    const version = component.version;

    if (typeof id !== 'string' || id.trim().length === 0) continue;
    if (typeof version !== 'string' || version.trim().length === 0) continue;

    redirects.push({
      source: `/downloads/${id}/v${version}/:asset`,
      destination: notesUrl,
      permanent: false,
    });
  }

  return redirects;
}

function dedupeRedirects(entries) {
  const bySource = new Map();

  for (const entry of entries) {
    const existing = bySource.get(entry.source);
    if (!existing) {
      bySource.set(entry.source, entry);
      continue;
    }

    if (existing.destination !== entry.destination) {
      throw new Error(
        `Redirect source conflict for '${entry.source}': '${existing.destination}' vs '${entry.destination}'`
      );
    }
  }

  return [...bySource.values()];
}

function isManagedRedirectSource(source) {
  return (
    source === '/desktop-updates/manager/stable/:version/:asset' ||
    source === '/desktop-updates/manager/beta/:version/:asset' ||
    source === '/downloads/opta-cli/latest' ||
    source === '/downloads/cli' ||
    managedDownloadVersionPattern.test(source)
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  const [vercelConfig, stableManifest, betaManifest] = await Promise.all([
    readJson(vercelConfigPath),
    readJson(stableManifestPath),
    readJson(betaManifestPath),
  ]);

  const existingRedirects = Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : [];
  const preservedRedirects = existingRedirects.filter(
    (entry) => entry && typeof entry.source === 'string' && !isManagedRedirectSource(entry.source)
  );

  const generatedRedirects = dedupeRedirects([
    ...buildComponentRedirects(stableManifest),
    ...buildComponentRedirects(betaManifest),
    ...buildStaticRedirects(),
  ]);

  vercelConfig.redirects = [...generatedRedirects, ...preservedRedirects];

  await writeFile(vercelConfigPath, `${JSON.stringify(vercelConfig, null, 2)}\n`, 'utf8');

  console.log(`synced redirects in ${path.relative(repoRoot, vercelConfigPath)}`);
  console.log(
    `managed redirects: ${generatedRedirects.length}, preserved redirects: ${preservedRedirects.length}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
