#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const DETERMINISTIC_SCRIPT = path.join(
  WORKSPACE_ROOT,
  'scripts/ops/run-deterministic-gates.mjs',
);

const WAVES = [
  {
    id: 'wave-1-control-plane',
    description: 'Accounts + Status',
    apps: ['1r', '1s'],
    sites: ['accounts', 'status'],
    endpoints: ['accounts', 'status-admin', 'status-lmx', 'status-daemon'],
  },
  {
    id: 'wave-2-onboarding',
    description: 'Init + LMX Dashboard',
    apps: ['1o', '1l'],
    sites: ['init', 'lmx'],
    endpoints: ['init', 'lmx'],
  },
  {
    id: 'wave-3-narrative',
    description: 'Home + Help + Learn',
    apps: ['1t', '1u', '1v'],
    sites: ['home', 'help', 'learn'],
    endpoints: ['home', 'help', 'learn'],
  },
  {
    id: 'wave-4-admin',
    description: 'Admin',
    apps: ['1x'],
    sites: ['admin'],
    endpoints: ['admin'],
  },
];

function parseOptions(argv) {
  const options = {
    fromWave: null,
    toWave: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      options.fromWave = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--to') {
      options.toWave = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
  }

  return options;
}

function runWave(wave) {
  console.log(`\n### ${wave.id}: ${wave.description}`);
  const args = [
    DETERMINISTIC_SCRIPT,
    '--apps',
    wave.apps.join(','),
    '--sites',
    wave.sites.join(','),
    '--endpoints',
    wave.endpoints.join(','),
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(`${wave.id} failed; rollout progression blocked`);
  }
}

function selectWaves(options) {
  const ids = WAVES.map((wave) => wave.id);
  const fromIndex = options.fromWave ? ids.indexOf(options.fromWave) : 0;
  const toIndex = options.toWave ? ids.indexOf(options.toWave) : ids.length - 1;

  if (fromIndex < 0) {
    throw new Error(`Unknown --from wave: ${options.fromWave}`);
  }
  if (toIndex < 0) {
    throw new Error(`Unknown --to wave: ${options.toWave}`);
  }
  if (fromIndex > toIndex) {
    throw new Error('--from must be before or equal to --to');
  }

  return WAVES.slice(fromIndex, toIndex + 1);
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const selectedWaves = selectWaves(options);

  console.log(
    `Phased release gate sequence: ${selectedWaves.map((wave) => wave.id).join(' -> ')}`,
  );

  for (const wave of selectedWaves) {
    runWave(wave);
  }

  console.log('\nPASS phased release gates');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
