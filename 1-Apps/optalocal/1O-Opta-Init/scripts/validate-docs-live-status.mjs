#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(repoRoot, 'docs');

const STABLE_CHANNEL_PATH = path.join(repoRoot, 'channels', 'stable.json');
const BETA_CHANNEL_PATH = path.join(repoRoot, 'channels', 'beta.json');
const STABLE_MANAGER_UPDATES_PATH = path.join(repoRoot, 'channels', 'manager-updates', 'stable.json');
const BETA_MANAGER_UPDATES_PATH = path.join(repoRoot, 'channels', 'manager-updates', 'beta.json');

const DOC_PATHS = [
  path.join(docsRoot, 'ROADMAP.md'),
  path.join(docsRoot, 'GO-LIVE-CHECKLIST.md'),
  path.join(docsRoot, 'WORKFLOWS.md'),
  path.join(docsRoot, 'CHANGELOG.md'),
  path.join(docsRoot, 'INDEX.md'),
];

const COMPONENT_IDS = ['opta-lmx', 'opta-code-universal', 'opta-daemon'];
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CONCURRENCY = 6;
const NEGATIVE_STATUS_PATTERN = /\b(?:pending|blocked|not(?:\s+yet)?\s+published|unpublished|coming soon|not live)\b/i;
const NON_CLI_CONTEXT_PATTERN = /\b(?:non-CLI|component installers?|opta-lmx|opta-code-universal|opta-daemon)\b/i;
const WINDOWS_MANAGER_CONTEXT_PATTERN = /\b(?:windows.*(?:manager|installer|updater)|(?:manager|installer|updater).*windows|opta-init-windows-x64\.exe|Opta-Init-Manager_x64-setup\.nsis\.zip)\b/i;

const NON_CLI_STALE_PATTERNS = [
  {
    id: 'roadmap-non-cli-pending',
    regex: /- \[ \] Publish stable real installers for `opta-lmx`, `opta-code-universal`, and `opta-daemon` artifacts/i,
    explanation: 'Docs still claim non-CLI stable installers are unpublished.',
  },
  {
    id: 'golive-non-cli-not-published',
    regex: /non-CLI component installers are not yet published/i,
    explanation: 'Docs still claim non-CLI installers are not published.',
  },
  {
    id: 'golive-lmx-pending',
    regex: /LMX package artifact still pending in release feed/i,
    explanation: 'Docs still claim the LMX package is pending.',
  },
];

const WINDOWS_MANAGER_STALE_PATTERNS = [
  {
    id: 'roadmap-windows-manager-pending',
    regex: /- \[ \] Publish Windows manager updater \+ installer for stable\+beta/i,
    explanation: 'Docs still claim Windows manager updater/installer are unpublished.',
  },
  {
    id: 'golive-windows-blocked',
    regex: /Signed Windows installer lane remains blocked by missing Windows signing secrets/i,
    explanation: 'Docs still claim Windows manager lane is blocked.',
  },
  {
    id: 'workflows-known-live-gap',
    regex: /Known live gap \(2026-03-03\)/i,
    explanation: 'Docs still advertise old known live gap state.',
  },
  {
    id: 'workflows-missing-windows-secrets-gap',
    regex: /Missing Windows signing secrets currently only block signed Windows installers/i,
    explanation: 'Docs still advertise Windows manager availability gap.',
  },
];

function parsePositiveInteger(raw, flagName) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let concurrency = DEFAULT_CONCURRENCY;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--timeout-ms') {
      const next = argv[i + 1];
      if (!next) throw new Error('--timeout-ms requires a value');
      timeoutMs = parsePositiveInteger(next, '--timeout-ms');
      i += 1;
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      timeoutMs = parsePositiveInteger(arg.slice('--timeout-ms='.length), '--timeout-ms');
      continue;
    }
    if (arg === '--concurrency') {
      const next = argv[i + 1];
      if (!next) throw new Error('--concurrency requires a value');
      concurrency = parsePositiveInteger(next, '--concurrency');
      i += 1;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = parsePositiveInteger(arg.slice('--concurrency='.length), '--concurrency');
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, timeoutMs, concurrency };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, timeoutMs, concurrency };
}

function usage() {
  console.log(
    [
      'Usage: node scripts/validate-docs-live-status.mjs [--timeout-ms N] [--concurrency N]',
      '',
      'Fails if active docs claim non-CLI artifacts or Windows manager artifacts are pending/blocked',
      'while live release manifests and URLs show they are promoted and reachable.',
    ].join('\n')
  );
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function uniqueUrls(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

function collectComponentArtifactUrls(channelManifest, componentId) {
  const component = channelManifest?.components?.find?.((candidate) => candidate?.id === componentId);
  if (!component) {
    return { component: null, macUrls: [], windowsUrls: [] };
  }

  const artifacts = component.artifacts ?? {};
  const macUrls = uniqueUrls((artifacts.macos ?? []).map((artifact) => artifact?.url));
  const windowsUrls = uniqueUrls((artifacts.windows ?? []).map((artifact) => artifact?.url));

  return { component, macUrls, windowsUrls };
}

function componentPromoted(component, channelManifest) {
  const componentRollout = component?.rollout?.percentage;
  const manifestRollout = channelManifest?.rollout?.percentage;
  const resolved = Number.isFinite(componentRollout)
    ? componentRollout
    : Number.isFinite(manifestRollout)
      ? manifestRollout
      : 100;
  return Number(resolved) > 0;
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
      status: response.status,
      statusText: response.statusText,
      method,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        method,
        error: `timeout after ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      method,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url, timeoutMs) {
  const head = await requestWithTimeout(url, 'HEAD', timeoutMs);
  if (head.ok) {
    return { ok: true, url, method: 'HEAD', status: head.status };
  }

  const get = await requestWithTimeout(url, 'GET', timeoutMs);
  if (get.ok) {
    return { ok: true, url, method: 'GET', status: get.status, fallbackFrom: head };
  }

  return { ok: false, url, head, get };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(new Array(workerCount).fill(null).map(() => worker()));
  return results;
}

function buildPatternChecks({ nonCliLive, windowsManagerLive }) {
  const checks = [];

  if (nonCliLive) {
    for (const pattern of NON_CLI_STALE_PATTERNS) {
      checks.push({ ...pattern, gate: 'nonCliLive' });
    }
  }

  if (windowsManagerLive) {
    for (const pattern of WINDOWS_MANAGER_STALE_PATTERNS) {
      checks.push({ ...pattern, gate: 'windowsManagerLive' });
    }
  }

  return checks;
}

async function findExplicitStaleAssertions(patternChecks) {
  const findings = [];

  for (const docPath of DOC_PATHS) {
    const content = await readFile(docPath, 'utf8');
    const lines = content.split('\n');

    for (const pattern of patternChecks) {
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (pattern.regex.test(line)) {
          findings.push({
            gate: pattern.gate,
            ruleId: pattern.id,
            explanation: pattern.explanation,
            file: path.relative(repoRoot, docPath),
            line: lineIndex + 1,
            text: line.trim(),
          });
        }
      }
    }
  }

  return findings;
}

async function findContextualStaleAssertions({ nonCliLive, windowsManagerLive }) {
  const findings = [];

  for (const docPath of DOC_PATHS) {
    const content = await readFile(docPath, 'utf8');
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!NEGATIVE_STATUS_PATTERN.test(line)) {
        continue;
      }

      if (nonCliLive && NON_CLI_CONTEXT_PATTERN.test(line)) {
        findings.push({
          gate: 'nonCliLive',
          ruleId: 'context-non-cli-negative-status',
          explanation:
            'Docs contain a pending/blocked status for non-CLI artifacts while promoted+reachable truth is live.',
          file: path.relative(repoRoot, docPath),
          line: lineIndex + 1,
          text: line.trim(),
        });
      }

      if (windowsManagerLive && WINDOWS_MANAGER_CONTEXT_PATTERN.test(line)) {
        findings.push({
          gate: 'windowsManagerLive',
          ruleId: 'context-windows-manager-negative-status',
          explanation:
            'Docs contain a pending/blocked status for Windows manager artifacts while promoted+reachable truth is live.',
          file: path.relative(repoRoot, docPath),
          line: lineIndex + 1,
          text: line.trim(),
        });
      }
    }
  }

  return findings;
}

function summarizeUrlFailure(result) {
  const headPart = result.head?.error
    ? `HEAD error: ${result.head.error}`
    : `HEAD status: ${result.head?.status ?? 'n/a'} ${result.head?.statusText ?? ''}`.trim();
  const getPart = result.get?.error
    ? `GET error: ${result.get.error}`
    : `GET status: ${result.get?.status ?? 'n/a'} ${result.get?.statusText ?? ''}`.trim();
  return `${headPart}; ${getPart}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const [stableChannel, betaChannel, stableManagerUpdates, betaManagerUpdates] = await Promise.all([
    readJson(STABLE_CHANNEL_PATH),
    readJson(BETA_CHANNEL_PATH),
    readJson(STABLE_MANAGER_UPDATES_PATH),
    readJson(BETA_MANAGER_UPDATES_PATH),
  ]);

  const urlSet = new Set();

  const componentFacts = {};
  const channelManifests = [
    { name: 'stable', manifest: stableChannel },
    { name: 'beta', manifest: betaChannel },
  ];

  for (const componentId of COMPONENT_IDS) {
    const channels = channelManifests.map(({ name, manifest }) => {
      const { component, macUrls, windowsUrls } = collectComponentArtifactUrls(manifest, componentId);
      const urls = [...macUrls, ...windowsUrls];
      urls.forEach((url) => urlSet.add(url));

      return {
        channel: name,
        promoted: componentPromoted(component, manifest),
        hasMac: macUrls.length > 0,
        hasWindows: windowsUrls.length > 0,
        urls,
      };
    });

    componentFacts[componentId] = { channels };
  }

  const stableManagerWindowsUrl = stableManagerUpdates?.platforms?.['windows-x86_64']?.url;
  const betaManagerWindowsUrl = betaManagerUpdates?.platforms?.['windows-x86_64']?.url;
  const windowsAliasUrl = 'https://init.optalocal.com/downloads/opta-init/latest/opta-init-windows-x64.exe';

  [stableManagerWindowsUrl, betaManagerWindowsUrl, windowsAliasUrl].forEach((url) => {
    if (typeof url === 'string' && url.trim().length > 0) {
      urlSet.add(url);
    }
  });

  const urls = [...urlSet];
  const checkResults = await mapWithConcurrency(urls, args.concurrency, (url) => checkUrl(url, args.timeoutMs));
  const urlStatus = new Map(checkResults.map((result) => [result.url, result]));

  const componentReachability = {};
  const componentLiveTruth = {};
  for (const componentId of COMPONENT_IDS) {
    const channelFacts = componentFacts[componentId].channels.map((fact) => {
      const reachable = fact.urls.length > 0
        && fact.urls.every((url) => urlStatus.get(url)?.ok === true);
      const live = fact.promoted && fact.hasMac && fact.hasWindows && reachable;
      return { ...fact, reachable, live };
    });

    componentReachability[componentId] = channelFacts;
    componentLiveTruth[componentId] = channelFacts.some((fact) => fact.live);
  }

  const nonCliLive = COMPONENT_IDS.every((componentId) => componentLiveTruth[componentId] === true);

  const stableManagerWindowsLive = typeof stableManagerWindowsUrl === 'string' && stableManagerWindowsUrl.length > 0
    && urlStatus.get(stableManagerWindowsUrl)?.ok === true;
  const betaManagerWindowsLive = typeof betaManagerWindowsUrl === 'string' && betaManagerWindowsUrl.length > 0
    && urlStatus.get(betaManagerWindowsUrl)?.ok === true;
  const windowsAliasLive = urlStatus.get(windowsAliasUrl)?.ok === true;
  const windowsManagerLive = stableManagerWindowsLive && betaManagerWindowsLive && windowsAliasLive;

  const patternChecks = buildPatternChecks({ nonCliLive, windowsManagerLive });
  const explicitFindings = await findExplicitStaleAssertions(patternChecks);
  const contextualFindings = await findContextualStaleAssertions({ nonCliLive, windowsManagerLive });
  const staleFindings = [...explicitFindings, ...contextualFindings];

  const failedUrlChecks = checkResults.filter((result) => !result.ok);

  console.log('validate-docs-live-status summary:');
  for (const componentId of COMPONENT_IDS) {
    const channelFacts = componentReachability[componentId];
    const channelSummary = channelFacts
      .map((fact) => {
        return `${fact.channel}(promoted=${fact.promoted} mac=${fact.hasMac} windows=${fact.hasWindows} reachable=${fact.reachable})`;
      })
      .join(' ');
    console.log(`- ${componentId}: live=${componentLiveTruth[componentId]} ${channelSummary}`);
  }
  console.log(
    `- windows manager updater/feed: stable=${stableManagerWindowsLive} beta=${betaManagerWindowsLive} alias=${windowsAliasLive}`
  );
  console.log(`- gate nonCliLive=${nonCliLive}`);
  console.log(`- gate windowsManagerLive=${windowsManagerLive}`);

  if (failedUrlChecks.length > 0) {
    console.log(`- URL checks: ${urls.length - failedUrlChecks.length} passed, ${failedUrlChecks.length} failed`);
  }

  const errors = [];

  if (staleFindings.length > 0) {
    for (const finding of staleFindings) {
      errors.push(
        `${finding.file}:${finding.line} (${finding.ruleId}) ${finding.explanation}\n  ↳ ${finding.text}`
      );
    }
  }

  if (errors.length > 0) {
    console.error(`FAIL docs/live status validation (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (failedUrlChecks.length > 0) {
    console.log('Note: Some URL checks failed. No stale-claim assertions were gated on failed live checks.');
    for (const result of failedUrlChecks) {
      console.log(`  - ${result.url}: ${summarizeUrlFailure(result)}`);
    }
  }

  console.log('PASS docs/live status validation');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
