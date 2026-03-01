import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { getDaemonDir } from '../platform/paths.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { debug } from '../core/debug.js';
import { daemonLogsPath } from './telemetry.js';
import { diskHeadroomMbToBytes, ensureDiskHeadroom } from '../utils/disk.js';
import { restrictFileToCurrentUser } from '../platform/index.js';

export interface DaemonState {
  pid: number;
  daemonId: string;
  host: string;
  port: number;
  token: string;
  startedAt: string;
  logsPath: string;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9999;

function envDiskHeadroomMb(): number | undefined {
  const raw = process.env['OPTA_DISK_HEADROOM_MB'];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function daemonDir(): string {
  return getDaemonDir();
}

function statePath(): string {
  return join(daemonDir(), 'state.json');
}

function tokenPath(): string {
  return join(daemonDir(), 'token');
}

function pidPath(): string {
  return join(daemonDir(), 'daemon.pid');
}

async function ensureDaemonDir(): Promise<void> {
  await ensureDiskHeadroom(daemonDir(), {
    minFreeBytes: diskHeadroomMbToBytes(envDiskHeadroomMb()),
  });
  await mkdir(daemonDir(), { recursive: true });
}

export async function readDaemonState(): Promise<DaemonState | null> {
  try {
    const raw = await readFile(statePath(), 'utf-8');
    return JSON.parse(raw) as DaemonState;
  } catch {
    return null;
  }
}

export async function writeDaemonState(state: DaemonState): Promise<void> {
  await ensureDaemonDir();
  await writeFile(statePath(), JSON.stringify(state, null, 2), 'utf-8');
  await writeFile(pidPath(), String(state.pid), 'utf-8');
}

export async function clearDaemonState(): Promise<void> {
  await Promise.all([rm(statePath(), { force: true }), rm(pidPath(), { force: true })]);
}

export async function readDaemonToken(): Promise<string | null> {
  try {
    return (await readFile(tokenPath(), 'utf-8')).trim();
  } catch {
    return null;
  }
}

export async function writeDaemonToken(token: string): Promise<void> {
  await ensureDaemonDir();
  await writeFile(tokenPath(), token, { encoding: 'utf-8', mode: 0o600 });
  await restrictFileToCurrentUser(tokenPath());
}

export async function createDaemonToken(): Promise<string> {
  const token = randomBytes(24).toString('hex');
  await writeDaemonToken(token);
  return token;
}

export function defaultDaemonHost(): string {
  return DEFAULT_HOST;
}

export function defaultDaemonPort(): number {
  return DEFAULT_PORT;
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pingDaemon(
  host: string,
  port: number,
  token: string,
  timeoutMs = 500
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();
  try {
    const tokenParam = encodeURIComponent(token);
    const res = await fetch(`http://${host}:${port}/v3/health?token=${tokenParam}`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function isDaemonRunning(state?: DaemonState | null): Promise<boolean> {
  const current = state ?? (await readDaemonState());
  if (!current) return false;
  if (!isProcessRunning(current.pid)) return false;
  return pingDaemon(current.host, current.port, current.token, 800);
}

function resolveCliEntrypoint(): string {
  // In source mode this module lives at src/daemon/lifecycle.ts and the CLI entry
  // is ../index.ts. In bundled mode this chunk lives in dist/ and the entry is
  // dist/index.js (sibling, not parent).
  const selfPath = fileURLToPath(import.meta.url);
  const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
  const baseDir = dirname(selfPath);

  const sibling = join(baseDir, `index${ext}`);
  if (existsSync(sibling)) return sibling;

  const parent = join(baseDir, '..', `index${ext}`);
  if (existsSync(parent)) return parent;

  // Final fallback keeps previous behavior if the filesystem check is inconclusive.
  return parent;
}

export async function startDaemonDetached(opts?: {
  host?: string;
  port?: number;
}): Promise<DaemonState> {
  const existing = await readDaemonState();
  if (await isDaemonRunning(existing)) {
    return existing!;
  }

  const host = opts?.host ?? DEFAULT_HOST;
  const port = opts?.port ?? DEFAULT_PORT;
  const token = await createDaemonToken();
  const entry = resolveCliEntrypoint();
  const nodeArgs: string[] = [];
  if (entry.endsWith('.ts')) {
    nodeArgs.push('--import', 'tsx');
  }
  nodeArgs.push(entry, 'daemon', 'run', '--host', host, '--port', String(port), '--token', token);

  const child = spawn(process.execPath, nodeArgs, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      OPTA_DAEMON_PROCESS: '1',
    },
  });
  child.unref();

  const started = await waitForDaemonReady(10_000);
  if (!started) {
    throw new Error('Timed out waiting for daemon to start');
  }

  const running = await readDaemonState();
  if (!running) {
    throw new Error('Daemon did not publish state');
  }
  return running;
}

async function waitForDaemonReady(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await readDaemonState();
    if (current && (await isDaemonRunning(current))) return true;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return false;
}

export async function ensureDaemonRunning(opts?: {
  host?: string;
  port?: number;
}): Promise<DaemonState> {
  const current = await readDaemonState();
  if (current) {
    const alive = await isDaemonRunning(current);
    if (alive) return current;
    // Crash guardian: state file exists but process is dead — clean up stale state
    debug(`Crash guardian: stale daemon state (pid=${current.pid}), restarting`);
    await clearDaemonState();
  }
  return startDaemonDetached(opts);
}

export async function stopDaemon(): Promise<boolean> {
  const state = await readDaemonState();
  if (!state) return false;

  if (!isProcessRunning(state.pid)) {
    await clearDaemonState();
    return true;
  }

  process.kill(state.pid, 'SIGTERM');
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (!isProcessRunning(state.pid)) {
      await clearDaemonState();
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Last resort
  process.kill(state.pid, 'SIGKILL');
  await clearDaemonState();
  return true;
}

export async function daemonStatus(): Promise<{
  running: boolean;
  state: DaemonState | null;
  logsPath: string;
}> {
  const state = await readDaemonState();
  const running = await isDaemonRunning(state);
  if (!running && state) {
    await clearDaemonState();
  }
  return {
    running,
    state: running ? state : null,
    logsPath: daemonLogsPath(),
  };
}
