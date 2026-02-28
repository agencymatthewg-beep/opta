import { nanoid } from 'nanoid';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from './session-manager.js';
import { startHttpServer } from './http-server.js';
import { clearDaemonState, createDaemonToken, defaultDaemonHost, defaultDaemonPort, writeDaemonToken } from './lifecycle.js';
import { logDaemonEvent } from './telemetry.js';
import { loadConfig } from '../core/config.js';
import { resolveLmxEndpoint } from '../lmx/endpoints.js';
import { diskHeadroomMbToBytes, ensureDiskHeadroom } from '../utils/disk.js';

export interface RunDaemonOptions {
  host?: string;
  port?: number;
  token?: string;
  model?: string;
}

export async function runDaemon(options?: RunDaemonOptions): Promise<void> {
  const startupConfig = await loadConfig();
  await ensureDiskHeadroom(join(homedir(), '.config', 'opta', 'daemon'), {
    minFreeBytes: diskHeadroomMbToBytes(startupConfig.safety?.diskHeadroomMb),
  });

  const host = options?.host ?? defaultDaemonHost();
  const preferredPort = options?.port ?? defaultDaemonPort();
  const token = options?.token ?? await createDaemonToken();
  if (options?.token) {
    await writeDaemonToken(options.token);
  }

  const daemonId = `daemon_${nanoid(8)}`;
  const sessionManager = new SessionManager(daemonId, async () => {
    const config = await loadConfig();
    if (!options?.model) return config;
    return {
      ...config,
      model: {
        ...config.model,
        default: options.model,
      },
    };
  });
  await sessionManager.hydrateFromDisk();

  // Pre-spawn 2 idle tool workers — eliminates ~30-80 ms cold-start on the first tool call.
  sessionManager.warmUpWorkers(2);

  // Prime the LMX endpoint cache so the first agent turn resolves immediately
  // instead of waiting for the ~1.5 s probe round-trip. Fire-and-forget.
  void resolveLmxEndpoint({
    host: startupConfig.connection.host,
    fallbackHosts: startupConfig.connection.fallbackHosts,
    port: startupConfig.connection.port,
    adminKey: startupConfig.connection.adminKey,
  }).catch(() => undefined);

  const running = await startHttpServer({
    daemonId,
    host,
    port: preferredPort,
    token,
    sessionManager,
  });

  await logDaemonEvent({
    level: 'info',
    daemonId,
    msg: 'daemon started',
    data: {
      host: running.host,
      port: running.port,
      pid: process.pid,
    },
  });

  const shutdown = async (signal: string) => {
    await logDaemonEvent({
      level: 'info',
      daemonId,
      msg: 'daemon shutting down',
      data: { signal },
    });
    try {
      await sessionManager.close();
      await running.close();
    } finally {
      await clearDaemonState();
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  // Process-level crash resilience: log but don't exit on unexpected errors.
  // Session-level errors are already isolated in session-manager.ts (try-catch
  // around processSessionQueue). These handlers catch errors that escape Fastify
  // internals or non-session codepaths.
  process.on('uncaughtException', (err) => {
    void logDaemonEvent({
      level: 'error',
      daemonId,
      msg: 'uncaught exception (daemon continuing)',
      data: { error: err.message, stack: err.stack },
    });
  });
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    void logDaemonEvent({
      level: 'error',
      daemonId,
      msg: 'unhandled rejection (daemon continuing)',
      data: { error: message },
    });
  });
}
