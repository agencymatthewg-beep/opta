#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const registryPath = path.join(workspaceRoot, 'apps.registry.json');

function usage() {
  console.log([
    'Opta Local Workspace Manager',
    '',
    'Usage:',
    '  node scripts/opta-local-workspace.mjs list',
    '  node scripts/opta-local-workspace.mjs verify',
    '  node scripts/opta-local-workspace.mjs run <app|all> <task> [--continue-on-error]',
    '',
    'App selector examples: 1o, opta-init, all',
    'Tasks: dev, build, check, start',
  ].join('\n'));
}

async function loadRegistry() {
  const raw = await readFile(registryPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('apps.registry.json must be an array');
  }
  return parsed;
}

function resolveApps(registry, selector) {
  if (selector === 'all') return registry;
  const normalized = selector.toLowerCase();
  const match = registry.find((app) => app.id === normalized || app.slug === normalized);
  if (!match) {
    throw new Error(`Unknown app selector '${selector}'. Run 'list' to view valid selectors.`);
  }
  return [match];
}

function runNodeTask(app, taskLabel, taskName, cwd) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = { ...process.env };

  // Quality and build runs should be non-interactive across local shells/CI.
  if ((taskLabel === 'check' || taskLabel === 'build') && !env.CI) {
    env.CI = '1';
  }

  return spawnSync(npmCmd, ['run', taskName], {
    cwd,
    stdio: 'inherit',
    env,
  });
}

function runShellTask(command, cwd) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
      cwd,
      stdio: 'inherit',
    });
  }
  return spawnSync('sh', ['-lc', command], {
    cwd,
    stdio: 'inherit',
  });
}

async function verifyRegistry(registry) {
  const errors = [];

  for (const app of registry) {
    const appPath = path.join(workspaceRoot, app.path);
    if (!existsSync(appPath)) {
      errors.push(`${app.id}: missing path ${app.path}`);
      continue;
    }

    if (app.type === 'node') {
      const packageJsonPath = path.join(appPath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        errors.push(`${app.id}: missing package.json`);
        continue;
      }

      const raw = await readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(raw);
      const scripts = pkg.scripts ?? {};
      for (const [taskLabel, scriptName] of Object.entries(app.tasks ?? {})) {
        if (typeof scriptName !== 'string') continue;
        if (!(scriptName in scripts)) {
          errors.push(`${app.id}: missing npm script '${scriptName}' for task '${taskLabel}'`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Registry verification failed with ${errors.length} issue(s):`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`PASS apps registry (${registry.length} apps)`);
}

function printRegistry(registry) {
  const rows = registry.map((app) => [
    app.id,
    app.slug,
    app.type,
    app.path,
    app.port === null || app.port === undefined ? '-' : String(app.port),
    Object.keys(app.tasks ?? {}).join(','),
  ]);

  const headers = ['id', 'slug', 'type', 'path', 'port', 'tasks'];
  const widths = headers.map((header, i) => Math.max(header.length, ...rows.map((row) => row[i].length)));
  const formatRow = (row) => row.map((cell, i) => cell.padEnd(widths[i])).join('  ');

  console.log(formatRow(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

async function runTask(registry, selector, task, continueOnError) {
  const apps = resolveApps(registry, selector);
  let failures = 0;

  for (const app of apps) {
    const taskSpec = app.tasks?.[task];
    if (!taskSpec) {
      console.error(`[${app.id}] task '${task}' is not defined in registry.`);
      failures += 1;
      if (!continueOnError) break;
      continue;
    }

    const cwd = path.join(workspaceRoot, app.path);
    if (!existsSync(cwd)) {
      console.error(`[${app.id}] path does not exist: ${app.path}`);
      failures += 1;
      if (!continueOnError) break;
      continue;
    }

    console.log(`\n=== ${app.id} (${app.name}) :: ${task} ===`);

    let result;
    if (app.type === 'node') {
      result = runNodeTask(app, task, taskSpec, cwd);
    } else {
      result = runShellTask(taskSpec, cwd);
    }

    if ((result.status ?? 1) !== 0) {
      failures += 1;
      console.error(`[${app.id}] failed with exit code ${result.status ?? 'unknown'}`);
      if (!continueOnError) break;
    }
  }

  if (failures > 0) {
    process.exit(1);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  const registry = await loadRegistry();

  if (command === 'list') {
    printRegistry(registry);
    return;
  }

  if (command === 'verify') {
    await verifyRegistry(registry);
    return;
  }

  if (command === 'run') {
    const selector = args[0];
    const task = args[1];
    const continueOnError = args.includes('--continue-on-error');
    if (!selector || !task) {
      throw new Error('run requires <app|all> and <task> arguments');
    }
    await runTask(registry, selector, task, continueOnError);
    return;
  }

  throw new Error(`Unknown command '${command}'`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
