#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const MANIFEST_ENDPOINTS = [
  'https://learn.optalocal.com/api/guides-manifest',
  'https://learn.optalocal.com/guides-manifest.json',
];

const OUTPUT_PATH = path.join(repoRoot, 'lib', 'generated', 'learn-guides-manifest.json');
const LOCAL_FALLBACK_PATH = path.join(repoRoot, 'lib', 'learn-guides-fallback-manifest.json');
const REQUEST_TIMEOUT_MS = 8000;

function isGuideRecord(candidate) {
  return Boolean(
    candidate
      && typeof candidate === 'object'
      && typeof candidate.slug === 'string'
      && candidate.slug.trim().length > 0
      && typeof candidate.title === 'string'
      && candidate.title.trim().length > 0
  );
}

function resolveGuideSummary(guide) {
  const summaryCandidates = [guide.summary, guide.description, guide.excerpt];
  for (const value of summaryCandidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeGuides(source) {
  const guides = [];
  for (const guide of source?.published ?? source?.guides ?? []) {
    if (!isGuideRecord(guide)) continue;
    const normalizedGuide = {
      slug: guide.slug.trim(),
      title: guide.title.trim(),
    };
    const summary = resolveGuideSummary(guide);
    if (summary) {
      normalizedGuide.summary = summary;
    }
    guides.push(normalizedGuide);
  }

  const deduped = new Map();
  for (const guide of guides) {
    if (!deduped.has(guide.slug)) {
      deduped.set(guide.slug, guide);
    }
  }

  return [...deduped.values()];
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeManifest(data) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function syncFromRemote() {
  const failures = [];

  for (const url of MANIFEST_ENDPOINTS) {
    try {
      const payload = await fetchJson(url);
      const guides = normalizeGuides(payload);
      if (guides.length === 0) {
        throw new Error('manifest returned no published guides');
      }

      return {
        source: url,
        upstreamGeneratedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
        guides,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${url} -> ${reason}`);
    }
  }

  const aggregate = new Error('Unable to fetch Learn guide manifest from all configured endpoints.');
  aggregate.details = failures;
  throw aggregate;
}

async function resolveLocalFallback() {
  const fallbackPayload = await readJson(LOCAL_FALLBACK_PATH);
  const fallbackGuides = normalizeGuides(fallbackPayload);
  if (fallbackGuides.length === 0) {
    throw new Error(`Fallback manifest has no guides: ${path.relative(repoRoot, LOCAL_FALLBACK_PATH)}`);
  }

  return {
    source: 'local-fallback',
    upstreamGeneratedAt: typeof fallbackPayload.generatedAt === 'string' ? fallbackPayload.generatedAt : null,
    guides: fallbackGuides,
  };
}

async function main() {
  let manifest;

  try {
    manifest = await syncFromRemote();
    console.log(`Synced Learn guides from remote manifest: ${manifest.source}`);
  } catch (remoteError) {
    const details = Array.isArray(remoteError?.details) ? remoteError.details : [];
    console.warn('WARN Learn manifest sync failed across remote endpoints; using local fallback.');
    for (const detail of details) {
      console.warn(`- ${detail}`);
    }
    manifest = await resolveLocalFallback();
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: manifest.source,
    upstreamGeneratedAt: manifest.upstreamGeneratedAt,
    guideCount: manifest.guides.length,
    guides: manifest.guides,
  };

  await writeManifest(output);
  console.log(`Wrote ${manifest.guides.length} guides -> ${path.relative(repoRoot, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
