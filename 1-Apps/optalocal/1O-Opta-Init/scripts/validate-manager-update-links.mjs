#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultManifestPaths = [
  path.join(repoRoot, 'channels', 'manager-updates', 'stable.json'),
  path.join(repoRoot, 'channels', 'manager-updates', 'beta.json'),
];
const defaultCargoTomlPath = path.join(repoRoot, 'desktop-manager', 'src-tauri', 'Cargo.toml');

const semverRegex = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const defaultTimeoutMs = 8000;
const defaultConcurrency = 6;

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/validate-manager-update-links.mjs',
      '  node scripts/validate-manager-update-links.mjs [options] <manifest-path> [more-manifests...]',
      '',
      'Options:',
      '  --strict                  Validate links regardless of advertised version',
      '  --manager-version <v>     Override local manager version for comparison',
      '  --timeout-ms <number>     Request timeout in milliseconds (default: 8000)',
      '  --concurrency <number>    Number of in-flight URL checks (default: 6)',
      '  -h, --help                Show this help message',
      '',
      'Default behavior:',
      '  Only checks artifact URLs when manifest.version is newer than local manager version.',
      '',
      'Defaults to channels/manager-updates/stable.json and channels/manager-updates/beta.json.',
    ].join('\n')
  );
}

function parsePositiveInteger(raw, flagName) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const manifestInputs = [];
  let strict = false;
  let timeoutMs = defaultTimeoutMs;
  let concurrency = defaultConcurrency;
  let managerVersion = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--strict') {
      strict = true;
      continue;
    }

    if (arg === '--manager-version') {
      const next = argv[index + 1];
      if (!next) throw new Error('--manager-version requires a value');
      managerVersion = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--manager-version=')) {
      managerVersion = arg.slice('--manager-version='.length);
      continue;
    }

    if (arg === '--timeout-ms') {
      const next = argv[index + 1];
      if (!next) throw new Error('--timeout-ms requires a value');
      timeoutMs = parsePositiveInteger(next, '--timeout-ms');
      index += 1;
      continue;
    }

    if (arg.startsWith('--timeout-ms=')) {
      timeoutMs = parsePositiveInteger(arg.slice('--timeout-ms='.length), '--timeout-ms');
      continue;
    }

    if (arg === '--concurrency') {
      const next = argv[index + 1];
      if (!next) throw new Error('--concurrency requires a value');
      concurrency = parsePositiveInteger(next, '--concurrency');
      index += 1;
      continue;
    }

    if (arg.startsWith('--concurrency=')) {
      concurrency = parsePositiveInteger(arg.slice('--concurrency='.length), '--concurrency');
      continue;
    }

    manifestInputs.push(arg);
  }

  return {
    help: false,
    strict,
    timeoutMs,
    concurrency,
    managerVersion,
    manifestInputs,
  };
}

function parseSemver(value) {
  const match = semverRegex.exec(value?.trim?.() ?? '');
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareIdentifiers(left, right) {
  const leftIsNum = /^[0-9]+$/.test(left);
  const rightIsNum = /^[0-9]+$/.test(right);

  if (leftIsNum && rightIsNum) {
    const a = Number(left);
    const b = Number(right);
    return a === b ? 0 : a > b ? 1 : -1;
  }
  if (leftIsNum && !rightIsNum) return -1;
  if (!leftIsNum && rightIsNum) return 1;
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const cmp = compareIdentifiers(a, b);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;

  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

async function requestWithTimeout(url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.body && typeof response.body.cancel === 'function') {
      response.body.cancel().catch(() => {});
    }

    return {
      ok: response.ok,
      method,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        method,
        error: `timeout after ${timeoutMs}ms`,
      };
    }

    let message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.cause && typeof error.cause === 'object') {
      const causeCode = typeof error.cause.code === 'string' ? error.cause.code : null;
      const causeMessage = typeof error.cause.message === 'string' ? error.cause.message : null;
      if (causeCode && causeMessage) {
        message = `${message} (${causeCode}: ${causeMessage})`;
      } else if (causeMessage) {
        message = `${message} (${causeMessage})`;
      }
    }

    return {
      ok: false,
      method,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url, timeoutMs) {
  const head = await requestWithTimeout(url, 'HEAD', timeoutMs);
  if (head.ok) {
    return {
      ok: true,
      method: head.method,
      status: head.status,
    };
  }

  const get = await requestWithTimeout(url, 'GET', timeoutMs);
  if (get.ok) {
    return {
      ok: true,
      method: get.method,
      status: get.status,
      fallbackFrom: head,
    };
  }

  return {
    ok: false,
    head,
    get,
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = [];
  const workerCount = Math.min(concurrency, items.length);
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

function collectPlatformUrls(manifest) {
  if (!manifest || typeof manifest !== 'object' || !manifest.platforms || typeof manifest.platforms !== 'object') {
    return [];
  }

  const refs = [];
  for (const [platformKey, release] of Object.entries(manifest.platforms)) {
    if (release && typeof release === 'object' && typeof release.url === 'string') {
      refs.push({
        url: release.url,
        location: `platforms.${platformKey}.url`,
      });
    }
  }

  return refs;
}

function dedupeByUrl(references) {
  const grouped = new Map();

  for (const reference of references) {
    if (!grouped.has(reference.url)) {
      grouped.set(reference.url, {
        url: reference.url,
        locations: [],
      });
    }
    grouped.get(reference.url).locations.push(reference.location);
  }

  return [...grouped.values()];
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function detectManagerVersion() {
  const cargoRaw = await readFile(defaultCargoTomlPath, 'utf-8');
  const match = cargoRaw.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Could not determine manager version from ${path.relative(repoRoot, defaultCargoTomlPath)}`);
  }
  return match[1];
}

function normalizeManifestInputs(manifestInputs) {
  if (manifestInputs.length > 0) {
    return manifestInputs.map((input) => path.resolve(process.cwd(), input));
  }
  return defaultManifestPaths;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    usage();
    return;
  }

  const managerVersion = parsed.managerVersion ?? await detectManagerVersion();
  if (!parseSemver(managerVersion)) {
    throw new Error(`Manager version '${managerVersion}' is not valid semver`);
  }

  const manifestPaths = normalizeManifestInputs(parsed.manifestInputs);

  console.log(`Local manager version: ${managerVersion}`);
  console.log(`Strict mode: ${parsed.strict ? 'on' : 'off'}`);

  let hadFailures = false;

  for (const manifestPath of manifestPaths) {
    let manifest;
    try {
      manifest = await readJsonFile(manifestPath);
    } catch (error) {
      hadFailures = true;
      console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (unreadable manifest)`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const manifestVersion = manifest?.version;
    if (typeof manifestVersion !== 'string' || !parseSemver(manifestVersion)) {
      hadFailures = true;
      console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (invalid version)`);
      console.error('  - manifest.version must be a valid semver string');
      continue;
    }

    const comparison = compareSemver(manifestVersion, managerVersion);
    if (comparison === null) {
      hadFailures = true;
      console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (version compare failed)`);
      console.error(`  - cannot compare '${manifestVersion}' against '${managerVersion}'`);
      continue;
    }

    const shouldCheck = parsed.strict || comparison > 0;
    const relPath = path.relative(repoRoot, manifestPath);

    if (!shouldCheck) {
      console.log(`SKIP ${relPath} (manifest.version=${manifestVersion} is not newer than manager=${managerVersion})`);
      continue;
    }

    const references = dedupeByUrl(collectPlatformUrls(manifest));
    if (references.length === 0) {
      hadFailures = true;
      console.error(`FAIL ${relPath} (no platform URLs)`);
      console.error('  - no platform URLs found while update is advertised');
      continue;
    }

    const reason = parsed.strict
      ? `strict mode (manifest.version=${manifestVersion}, manager=${managerVersion})`
      : `advertised update ${manifestVersion} > ${managerVersion}`;
    console.log(`CHECK ${relPath} (${references.length} URL(s), ${reason})`);

    const results = await mapWithConcurrency(references, parsed.concurrency, async (reference) => {
      const status = await checkUrl(reference.url, parsed.timeoutMs);
      return { reference, status };
    });

    const failures = results.filter((entry) => !entry.status.ok);

    for (const entry of results) {
      const { reference, status } = entry;
      if (status.ok) {
        const via = status.fallbackFrom ? ` via ${status.method} (fallback from HEAD)` : ` via ${status.method}`;
        console.log(`PASS [${status.status}${via}] ${reference.url}`);
      } else {
        const headSummary = status.head?.error
          ? `HEAD error: ${status.head.error}`
          : status.head
            ? `HEAD ${status.head.status} ${status.head.statusText ?? ''}`.trim()
            : 'HEAD unavailable';
        const getSummary = status.get?.error
          ? `GET error: ${status.get.error}`
          : status.get
            ? `GET ${status.get.status} ${status.get.statusText ?? ''}`.trim()
            : 'GET unavailable';
        console.error(`FAIL ${reference.url}`);
        console.error(`  - ${headSummary}`);
        console.error(`  - ${getSummary}`);
        if (reference.locations.length > 0) {
          console.error(`  - referenced by: ${reference.locations.join(', ')}`);
        }
      }
    }

    if (failures.length > 0) {
      hadFailures = true;
      console.error(`FAIL ${relPath} (${failures.length} broken URL(s))`);
    } else {
      console.log(`PASS ${relPath} (${references.length} URL(s))`);
    }
  }

  if (hadFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
