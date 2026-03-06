#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const APP_REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'apps.registry.json');
const WEBSITE_REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'websites.registry.json');
const SYNTHETIC_SCRIPT = path.join(WORKSPACE_ROOT, 'scripts/synthetic-web-health.mjs');
const ACCOUNTS_HEALTH_CONTRACT_SCRIPT = path.join(
  WORKSPACE_ROOT,
  'scripts/ops/check-accounts-health-contract.mjs',
);

function parseOptions(argv) {
  const options = {
    apps: 'all',
    siteIds: null,
    endpointIds: null,
    skipProbes: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apps') {
      options.apps = argv[i + 1] ?? 'all';
      i += 1;
      continue;
    }
    if (arg === '--sites') {
      options.siteIds = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--endpoints') {
      options.endpointIds = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--skip-probes') {
      options.skipProbes = true;
      continue;
    }
  }

  return options;
}

function parseCsvSet(value) {
  if (!value) return null;
  const values = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return values.length > 0 ? new Set(values) : null;
}

function runCommand(label, command, args, cwd) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadApps() {
  const registry = await loadJson(APP_REGISTRY_PATH);
  if (!Array.isArray(registry)) {
    throw new Error('apps.registry.json must be an array');
  }
  return registry;
}

function selectApps(apps, selector) {
  if (selector === 'all') {
    return apps.filter((app) => app.type === 'node');
  }

  const ids = new Set(
    selector
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  if (ids.size === 0) {
    throw new Error('No app ids specified in --apps');
  }

  const selected = apps.filter((app) => ids.has(app.id.toLowerCase()) || ids.has(app.slug.toLowerCase()));
  if (selected.length === 0) {
    throw new Error(`No apps matched --apps=${selector}`);
  }
  return selected;
}

async function loadWebsiteMap() {
  const parsed = await loadJson(WEBSITE_REGISTRY_PATH);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.websites)) {
    throw new Error('websites.registry.json must include websites[]');
  }

  const byAppPath = new Map();
  for (const website of parsed.websites) {
    if (typeof website?.appPath === 'string' && typeof website?.key === 'string') {
      byAppPath.set(website.appPath, website.key.toLowerCase());
    }
  }

  return byAppPath;
}

async function runGatesForApp(app) {
  const appDir = path.join(WORKSPACE_ROOT, app.path);
  const packageJsonPath = path.join(appDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error(`[${app.id}] missing package.json at ${packageJsonPath}`);
  }

  const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const scripts = pkg.scripts ?? {};

  const phases = [
    ['typecheck', 'typecheck'],
    ['lint', 'lint'],
    ['tests', 'test'],
    ['build', 'build'],
  ];

  for (const [phaseLabel, scriptName] of phases) {
    if (scripts[scriptName]) {
      runCommand(`[${app.id}] ${phaseLabel}`, process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', scriptName], appDir);
    } else {
      console.log(`[${app.id}] skip ${phaseLabel} (script '${scriptName}' not defined)`);
    }
  }
}

async function runSyntheticProbes(siteIds, endpointIds) {
  const args = [SYNTHETIC_SCRIPT];
  if (siteIds && siteIds.size > 0) {
    args.push('--sites', [...siteIds].sort().join(','));
  }
  if (endpointIds && endpointIds.size > 0) {
    args.push('--endpoints', [...endpointIds].sort().join(','));
  }
  runCommand('live probe check', process.execPath, args, WORKSPACE_ROOT);
}

function shouldCheckAccountsHealth(selectedApps, siteIds) {
  const includesAccountsApp = selectedApps.some((app) => app.id.toLowerCase() === '1r');
  const includesAccountsSite = siteIds?.has('accounts') ?? false;
  return includesAccountsApp || includesAccountsSite;
}

function runAccountsHealthContractCheck() {
  runCommand('accounts deep health contract', process.execPath, [ACCOUNTS_HEALTH_CONTRACT_SCRIPT], WORKSPACE_ROOT);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const explicitSiteIds = parseCsvSet(options.siteIds);
  const explicitEndpointIds = parseCsvSet(options.endpointIds);

  const apps = await loadApps();
  const selectedApps = selectApps(apps, options.apps);

  console.log(`Running deterministic gates for apps: ${selectedApps.map((app) => app.id).join(', ')}`);

  for (const app of selectedApps) {
    await runGatesForApp(app);
  }

  if (options.skipProbes) {
    console.log('Skipping live probes (--skip-probes)');
    return;
  }

  const siteIds = explicitSiteIds ? new Set(explicitSiteIds) : new Set();
  const endpointIds = explicitEndpointIds ? new Set(explicitEndpointIds) : new Set();

  if (!explicitSiteIds) {
    const websiteMap = await loadWebsiteMap();
    for (const app of selectedApps) {
      const key = websiteMap.get(app.path);
      if (key) {
        siteIds.add(key);
        endpointIds.add(key);
      }
    }
  }

  await runSyntheticProbes(siteIds.size > 0 ? siteIds : null, endpointIds.size > 0 ? endpointIds : null);

  if (shouldCheckAccountsHealth(selectedApps, siteIds)) {
    runAccountsHealthContractCheck();
  } else {
    console.log('Skipping accounts deep health contract check (accounts surface not in selected scope)');
  }

  console.log('\nPASS deterministic gates');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
