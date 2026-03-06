#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  let bundlePath = '';
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--bundle') {
      bundlePath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!bundlePath) {
    throw new Error('Missing required --bundle <path>');
  }

  return path.resolve(bundlePath);
}

function assertExists(targetPath, label) {
  if (!existsSync(targetPath)) {
    throw new Error(`${label} missing: ${targetPath}`);
  }
}

function runBundleSmoke(bundleRoot) {
  const launchScript = path.join(bundleRoot, 'bin', 'opta.js');
  const command = process.execPath;
  const args = [launchScript, 'daemon', '--help'];
  const result = spawnSync(command, args, {
    cwd: bundleRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Daemon smoke command failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main() {
  const bundleRoot = parseArgs(process.argv.slice(2));
  assertExists(bundleRoot, 'Bundle directory');
  assertExists(path.join(bundleRoot, 'package.json'), 'package.json');
  assertExists(path.join(bundleRoot, 'bin', 'opta.js'), 'CLI launcher');
  assertExists(path.join(bundleRoot, 'dist', 'index.js'), 'Compiled entrypoint');
  assertExists(path.join(bundleRoot, 'node_modules'), 'Runtime node_modules');
  runBundleSmoke(bundleRoot);
  process.stdout.write(`Verified daemon bundle: ${bundleRoot}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
