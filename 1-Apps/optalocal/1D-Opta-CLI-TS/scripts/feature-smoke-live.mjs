#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = {
    commands: resolve(REPO_ROOT, 'scripts/feature-smoke-commands.txt'),
    output: resolve(REPO_ROOT, `docs/evidence/feature-smoke-${todayStamp()}.tsv`),
    timeoutMs: 8000,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--commands' && argv[i + 1]) {
      args.commands = resolve(REPO_ROOT, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--output' && argv[i + 1]) {
      args.output = resolve(REPO_ROOT, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--timeout-ms' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout-ms value: ${argv[i + 1]}`);
      }
      args.timeoutMs = parsed;
      i += 1;
      continue;
    }
    if (arg === '--quiet') {
      args.quiet = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: node scripts/feature-smoke-live.mjs [options]',
          '',
          'Options:',
          '  --commands <path>    Command list file (default: scripts/feature-smoke-commands.txt)',
          '  --output <path>      Output TSV path (default: docs/evidence/feature-smoke-YYYY-MM-DD.tsv)',
          '  --timeout-ms <ms>    Per-command timeout in milliseconds (default: 8000)',
          '  --quiet              Suppress per-command progress output',
          '  -h, --help           Show help',
        ].join('\n')
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function summarizeOutput(stdout, stderr) {
  const merged = `${stdout}${stderr}`.replace(/\r/g, '').trim();
  if (!merged) return '';
  return merged.replace(/\s+/g, ' ').replace(/\t/g, ' ').slice(0, 240);
}

function runSmokeCommand(command, timeoutMs) {
  return new Promise((resolveResult) => {
    const child = spawn('/bin/zsh', ['-lc', `node dist/index.js ${command}`], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let finished = false;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 500).unref();
    }, timeoutMs);

    const finalize = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      resolveResult({
        code: timedOut ? 124 : (code ?? 1),
        output: summarizeOutput(stdout, stderr),
      });
    };

    child.on('error', (error) => {
      stderr += `\n${error.message}`;
      finalize(1);
    });
    child.on('close', (code) => finalize(code));
  });
}

async function loadCommands(pathname) {
  const raw = await readFile(pathname, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const commands = await loadCommands(args.commands);

  const rows = [];
  let passCount = 0;
  let failCount = 0;

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    const result = await runSmokeCommand(command, args.timeoutMs);
    const ok = result.code === 0;
    if (ok) passCount += 1;
    else failCount += 1;

    rows.push(`${result.code}\t${command}\t${result.output}`);
    if (!args.quiet) {
      const marker = ok ? 'PASS' : 'FAIL';
      console.log(`[${index + 1}/${commands.length}] ${marker}  ${command}`);
    }
  }

  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, `${rows.join('\n')}\n`, 'utf8');

  console.log(`\nSmoke summary: ${passCount}/${commands.length} passed, ${failCount} failed`);
  console.log(`Evidence: ${args.output}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`feature-smoke-live failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
