#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const binDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(binDir, '..');
const distEntrypoint = resolve(packageRoot, 'dist/index.js');
const sourceEntrypoint = resolve(packageRoot, 'src/index.ts');

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function tsxCommand() {
  const tsxPath = resolve(
    packageRoot,
    process.platform === 'win32' ? 'node_modules/.bin/tsx.cmd' : 'node_modules/.bin/tsx',
  );
  return existsSync(tsxPath) ? tsxPath : null;
}

function runWithInheritedIo(command, args, cwd) {
  const child = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (child.error) {
    return 1;
  }
  if (typeof child.status === 'number') {
    return child.status;
  }
  return 1;
}

function trySelfHealBuild(cwd) {
  const firstBuildExit = runWithInheritedIo(npmCommand(), ['run', '-s', 'build'], cwd);
  if (firstBuildExit === 0) return 0;

  // Local linked installs frequently lose node_modules after clean operations.
  // Reinstall deps once, then retry build before giving up.
  const installExit = runWithInheritedIo(
    npmCommand(),
    ['install', '--no-fund', '--no-audit'],
    cwd,
  );
  if (installExit !== 0) return firstBuildExit;

  return runWithInheritedIo(npmCommand(), ['run', '-s', 'build'], cwd);
}

async function launchBuiltCli() {
  const url = pathToFileURL(distEntrypoint).href;
  await import(url);
}

if (existsSync(distEntrypoint)) {
  // dist/index.js is responsible for parsing argv and controlling process exit.
  // Exiting here truncates async command execution/output.
  await launchBuiltCli();
} else if (existsSync(sourceEntrypoint)) {
  // Linked/local developer checkout: build on-demand so `opta` never hard-fails
  // with a raw MODULE_NOT_FOUND when dist was cleaned.
  const buildExit = trySelfHealBuild(packageRoot);
  if (buildExit === 0 && existsSync(distEntrypoint)) {
    await launchBuiltCli();
  } else {
    const tsx = tsxCommand();
    if (tsx) {
      const tsxExit = runWithInheritedIo(tsx, [sourceEntrypoint, ...process.argv.slice(2)], packageRoot);
      process.exit(tsxExit);
    }

    console.error('Opta CLI bootstrap failed: dist/index.js is missing and fallback launch failed.');
    console.error('Try: npm run build');
    console.error('If this is a linked install, re-link after build: npm link');
    process.exit(1);
  }
} else {
  console.error('Opta CLI installation is incomplete: dist/index.js is missing.');
  console.error('Repair by reinstalling: npm i -g @opta/opta-cli');
  process.exit(1);
}
