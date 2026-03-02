#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultManifestPaths = [
  path.join(repoRoot, 'channels', 'stable.json'),
  path.join(repoRoot, 'channels', 'beta.json'),
];

const defaultTimeoutMs = 8000;
const defaultConcurrency = 6;

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/validate-manifest-links.mjs',
      '  node scripts/validate-manifest-links.mjs [options] <manifest-path> [more-manifests...]',
      '',
      'Options:',
      '  --timeout-ms <number>   Request timeout in milliseconds (default: 8000)',
      '  --concurrency <number>  Number of in-flight URL checks (default: 6)',
      '  -h, --help              Show this help message',
      '',
      'Defaults to channels/stable.json and channels/beta.json.',
    ].join('\n')
  );
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  let timeoutMs = defaultTimeoutMs;
  let concurrency = defaultConcurrency;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--timeout-ms') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--timeout-ms requires a value');
      }
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
      if (!next) {
        throw new Error('--concurrency requires a value');
      }
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
    timeoutMs,
    concurrency,
    manifestInputs,
  };
}

function collectManifestUrls(manifest, manifestPath) {
  const references = [];
  const relManifestPath = path.relative(repoRoot, manifestPath);

  if (!isObject(manifest)) {
    return references;
  }

  if (isObject(manifest.release) && typeof manifest.release.notesUrl === 'string') {
    references.push({
      url: manifest.release.notesUrl,
      location: `${relManifestPath}: release.notesUrl`,
    });
  }

  if (!Array.isArray(manifest.components)) {
    return references;
  }

  for (let componentIndex = 0; componentIndex < manifest.components.length; componentIndex += 1) {
    const component = manifest.components[componentIndex];
    if (!isObject(component) || !isObject(component.artifacts)) {
      continue;
    }

    for (const platform of ['macos', 'windows']) {
      const artifacts = component.artifacts[platform];
      if (!Array.isArray(artifacts)) {
        continue;
      }

      for (let artifactIndex = 0; artifactIndex < artifacts.length; artifactIndex += 1) {
        const artifact = artifacts[artifactIndex];
        const prefix = `${relManifestPath}: components[${componentIndex}].artifacts.${platform}[${artifactIndex}]`;
        if (!isObject(artifact)) {
          continue;
        }

        if (typeof artifact.url === 'string') {
          references.push({
            url: artifact.url,
            location: `${prefix}.url`,
          });
        }

        if (isObject(artifact.signature) && typeof artifact.signature.url === 'string') {
          references.push({
            url: artifact.signature.url,
            location: `${prefix}.signature.url`,
          });
        }
      }
    }
  }

  return references;
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

async function requestWithTimeout(url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

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
    if (error instanceof Error && isObject(error.cause)) {
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
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(concurrency, items.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function formatFailure(result) {
  const headReason = result.head.error ? result.head.error : `HTTP ${result.head.status}`;
  const getReason = result.get.error ? result.get.error : `HTTP ${result.get.status}`;
  return `HEAD ${headReason}; GET ${getReason}`;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    usage();
    return;
  }

  const manifestPaths =
    parsed.manifestInputs.length > 0
      ? parsed.manifestInputs.map((input) => path.resolve(process.cwd(), input))
      : defaultManifestPaths;

  const allReferences = [];

  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readJsonFile(manifestPath);
      allReferences.push(...collectManifestUrls(manifest, manifestPath));
    } catch (error) {
      console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (unable to read JSON)`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }
  }

  const grouped = dedupeByUrl(allReferences);

  if (grouped.length === 0) {
    console.error('FAIL no URLs found to validate');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Checking ${grouped.length} unique URL(s) from ${manifestPaths.length} manifest(s) with timeout ${parsed.timeoutMs}ms (concurrency ${parsed.concurrency})`
  );

  const checked = await mapWithConcurrency(grouped, parsed.concurrency, async (item) => {
    const result = await checkUrl(item.url, parsed.timeoutMs);
    return {
      ...item,
      result,
    };
  });

  let hadFailures = false;

  for (const entry of checked) {
    if (entry.result.ok) {
      console.log(`PASS [${entry.result.status} via ${entry.result.method}] ${entry.url}`);
      continue;
    }

    hadFailures = true;
    console.error(`FAIL [${formatFailure(entry.result)}] ${entry.url}`);
    for (const location of entry.locations) {
      console.error(`  - ${location}`);
    }
  }

  if (hadFailures) {
    process.exitCode = 1;
    return;
  }

  console.log(`All manifest URLs are reachable (${checked.length} unique URL(s)).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
