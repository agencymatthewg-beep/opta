import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getDaemonDir } from '../platform/paths.js';

function daemonLogDir(): string {
  return getDaemonDir();
}

function daemonLogPath(): string {
  return join(daemonLogDir(), 'daemon.log');
}

export interface DaemonLogEvent {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  daemonId: string;
  sessionId?: string;
  traceId?: string;
  data?: Record<string, unknown>;
}

export async function logDaemonEvent(event: DaemonLogEvent): Promise<void> {
  try {
    await mkdir(daemonLogDir(), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...event,
    });
    await appendFile(daemonLogPath(), line + '\n', 'utf-8');
  } catch {
    // Logging must never crash daemon paths.
  }
}

export function daemonLogsPath(): string {
  return daemonLogPath();
}
