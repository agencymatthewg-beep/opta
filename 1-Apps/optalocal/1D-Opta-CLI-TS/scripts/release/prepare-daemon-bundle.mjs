#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ALLOWED_PLATFORMS = new Set(['macos', 'windows']);
const ALLOWED_ARCH = new Set(['x64', 'arm64', 'universal']);

function parseArgs(argv) {
  const args = {
    platform: '',
    arch: '',
    outputDir: 'dist-release',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    switch (token) {
      case '--platform':
        args.platform = value ?? '';
        index += 1;
        break;
      case '--arch':
        args.arch = value ?? '';
        index += 1;
        break;
      case '--output-dir':
        args.outputDir = value ?? '';
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!ALLOWED_PLATFORMS.has(args.platform)) {
    throw new Error(`--platform must be one of: ${[...ALLOWED_PLATFORMS].join(', ')}`);
  }
  if (!ALLOWED_ARCH.has(args.arch)) {
    throw new Error(`--arch must be one of: ${[...ALLOWED_ARCH].join(', ')}`);
  }

  return args;
}

function requirePathExists(pathToCheck, description) {
  if (!existsSync(pathToCheck)) {
    throw new Error(`${description} missing: ${pathToCheck}`);
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(scriptDir, '..', '..');
  const options = parseArgs(process.argv.slice(2));

  const distDir = path.join(packageRoot, 'dist');
  const binDir = path.join(packageRoot, 'bin');
  const modulesDir = path.join(packageRoot, 'node_modules');
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageLockPath = path.join(packageRoot, 'package-lock.json');
  const readmePath = path.join(packageRoot, 'README.md');

  requirePathExists(path.join(distDir, 'index.js'), 'Compiled daemon entrypoint');
  requirePathExists(path.join(binDir, 'opta.js'), 'CLI launcher');
  requirePathExists(modulesDir, 'Runtime dependencies');
  requirePathExists(packageJsonPath, 'package.json');

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
  const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';

  const outputRoot = path.resolve(packageRoot, options.outputDir);
  const bundleName = `opta-daemon-${options.platform}-${options.arch}`;
  const bundleRoot = path.join(outputRoot, bundleName);

  await rm(bundleRoot, { recursive: true, force: true });
  await mkdir(bundleRoot, { recursive: true });

  await cp(distDir, path.join(bundleRoot, 'dist'), { recursive: true });
  await cp(binDir, path.join(bundleRoot, 'bin'), { recursive: true });
  await cp(modulesDir, path.join(bundleRoot, 'node_modules'), { recursive: true });
  await cp(packageJsonPath, path.join(bundleRoot, 'package.json'));

  if (existsSync(packageLockPath)) {
    await cp(packageLockPath, path.join(bundleRoot, 'package-lock.json'));
  }
  if (existsSync(readmePath)) {
    await cp(readmePath, path.join(bundleRoot, 'README.md'));
  }

  const launcherSh = `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec node "\${SCRIPT_DIR}/bin/opta.js" daemon run "$@"
`;
  await writeFile(path.join(bundleRoot, 'run-daemon.sh'), launcherSh, 'utf-8');
  await chmod(path.join(bundleRoot, 'run-daemon.sh'), 0o755);

  const launcherCmd = `@echo off
setlocal
set SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%bin\\opta.js" daemon run %*
`;
  await writeFile(path.join(bundleRoot, 'run-daemon.cmd'), launcherCmd, 'utf-8');

  const metadata = {
    component: 'opta-daemon',
    version,
    platform: options.platform,
    arch: options.arch,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(bundleRoot, 'release-bundle.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf-8',
  );

  process.stdout.write(`${bundleRoot}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
