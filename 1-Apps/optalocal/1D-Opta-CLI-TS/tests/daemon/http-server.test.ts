import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHttpServer, type RunningHttpServer } from '../../src/daemon/http-server.js';
import type { SessionManager } from '../../src/daemon/session-manager.js';
import type { V3Envelope } from '../../src/protocol/v3/types.js';

const { loadConfigMock, lmxClientCtor, lmxClientInstance } = vi.hoisted(() => {
  const loadConfigMock = vi.fn(async () => ({
    connection: {
      host: '127.0.0.1',
      port: 1234,
      adminKey: 'test-admin-key',
      fallbackHosts: [],
    },
  }));

  const lmxClientInstance = {
    status: vi.fn(async () => ({ status: 'ok', version: 'test', models: [] })),
    models: vi.fn(async () => ({ models: [] })),
    memory: vi.fn(async () => ({
      total_unified_memory_gb: 64,
      used_gb: 8,
      available_gb: 56,
      models: {},
    })),
    available: vi.fn(async () => []),
    loadModel: vi.fn(async () => ({ model_id: 'demo/model', status: 'loaded' })),
    unloadModel: vi.fn(async () => ({ model_id: 'demo/model', status: 'unloaded' })),
    deleteModel: vi.fn(async () => ({ modelId: 'demo/model', freedBytes: 123 })),
    downloadModel: vi.fn(async () => ({
      downloadId: 'dl_123',
      repoId: 'demo/model',
      status: 'queued',
    })),
  };

  const lmxClientCtor = vi.fn(() => lmxClientInstance);

  return { loadConfigMock, lmxClientCtor, lmxClientInstance };
});

vi.mock('../../src/daemon/lifecycle.js', () => ({
  writeDaemonState: vi.fn(async () => {}),
}));

vi.mock('../../src/core/config.js', () => ({
  loadConfig: loadConfigMock,
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: lmxClientCtor,
}));

function makeEvent(seq: number): V3Envelope<'turn.token', { text: string }> {
  return {
    v: '3',
    event: 'turn.token',
    daemonId: 'daemon-test',
    sessionId: 'sess-1',
    seq,
    ts: new Date().toISOString(),
    payload: { text: `tok-${seq}` },
  };
}

function makeSessionManager(
  overrides?: Partial<Record<keyof SessionManager, unknown>>
): SessionManager {
  const base = {
    getRuntimeStats: vi.fn(() => ({
      sessionCount: 1,
      activeTurnCount: 0,
      queuedTurnCount: 0,
      subscriberCount: 0,
      ingressSeq: 7,
      toolWorkers: { workers: 1, busy: 0, queued: 0 },
    })),
    createSession: vi.fn(async () => ({
      sessionId: 'sess-1',
      model: 'test-model',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      queuedTurns: 0,
      toolCallCount: 0,
      writerCount: 0,
    })),
    getSession: vi.fn(async () => null),
    getSessionMessages: vi.fn(async () => []),
    submitTurn: vi.fn(async () => ({ turnId: 'turn-1', queued: 1 })),
    resolvePermission: vi.fn(() => ({ ok: true, conflict: false })),
    cancelSessionTurns: vi.fn(async () => 0),
    getEventsAfter: vi.fn(async () => []),
    subscribe: vi.fn((_sessionId: string, _cb: (event: V3Envelope) => void) => () => {}),
  } satisfies Partial<SessionManager>;
  return {
    ...base,
    ...(overrides ?? {}),
  } as SessionManager;
}

describe('daemon http-server telemetry and routes', () => {
  let running: RunningHttpServer | null = null;

  afterEach(async () => {
    if (running) {
      await running.close();
    }
    running = null;
    vi.clearAllMocks();
    loadConfigMock.mockClear();
    lmxClientCtor.mockClear();
  });

  it('serves /v3/health and protects /v3/metrics with auth', async () => {
    const sessionManager = makeSessionManager();
    running = await startHttpServer({
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager,
    });

    const healthRes = await running.app.inject({
      method: 'GET',
      url: '/v3/health',
    });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json()).toMatchObject({
      status: 'ok',
      daemonId: 'daemon_test',
      contract: { name: 'opta-daemon-v3', version: 1 },
      runtime: sessionManager.getRuntimeStats(),
    });

    const unauthorizedMetrics = await running.app.inject({
      method: 'GET',
      url: '/v3/metrics',
    });
    expect(unauthorizedMetrics.statusCode).toBe(401);

    const metricsRes = await running.app.inject({
      method: 'GET',
      url: '/v3/metrics',
      headers: {
        authorization: 'Bearer secret-token',
      },
    });
    expect(metricsRes.statusCode).toBe(200);
    const metrics = metricsRes.json() as {
      daemonId: string;
      runtime: ReturnType<SessionManager['getRuntimeStats']>;
      ts: string;
    };
    expect(metrics.daemonId).toBe('daemon_test');
    expect(metrics.runtime).toEqual(sessionManager.getRuntimeStats());
    expect(Number.isNaN(Date.parse(metrics.ts))).toBe(false);
  });

  it('returns session events for the authorized background events route', async () => {
    const events = [makeEvent(6), makeEvent(7)];
    const getEventsAfter = vi.fn(async () => events);
    const sessionManager = makeSessionManager({ getEventsAfter });
    running = await startHttpServer({
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager,
    });

    const res = await running.app.inject({
      method: 'GET',
      url: '/v3/sessions/sess-1/events?afterSeq=5',
      headers: {
        authorization: 'Bearer secret-token',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ events });
    expect(getEventsAfter).toHaveBeenCalledWith('sess-1', 5);
  });

  it('serves authenticated /v3/lmx routes and maps download response shape', async () => {
    const sessionManager = makeSessionManager();
    running = await startHttpServer({
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager,
    });

    const unauthorized = await running.app.inject({
      method: 'GET',
      url: '/v3/lmx/status',
    });
    expect(unauthorized.statusCode).toBe(401);

    const statusRes = await running.app.inject({
      method: 'GET',
      url: '/v3/lmx/status',
      headers: { authorization: 'Bearer secret-token' },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(lmxClientInstance.status).toHaveBeenCalled();

    const loadRes = await running.app.inject({
      method: 'POST',
      url: '/v3/lmx/models/load',
      headers: { authorization: 'Bearer secret-token' },
      payload: { modelId: 'demo/model', autoDownload: true },
    });
    expect(loadRes.statusCode).toBe(200);
    expect(lmxClientInstance.loadModel).toHaveBeenCalledWith('demo/model', {
      backend: undefined,
      autoDownload: true,
    });

    const downloadRes = await running.app.inject({
      method: 'POST',
      url: '/v3/lmx/models/download',
      headers: { authorization: 'Bearer secret-token' },
      payload: { repoId: 'demo/model' },
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.json()).toMatchObject({
      download_id: 'dl_123',
      repo_id: 'demo/model',
      status: 'queued',
    });
  });

  it('maps permission race conflicts to HTTP 409', async () => {
    const sessionManager = makeSessionManager({
      resolvePermission: vi.fn(() => ({
        ok: false,
        conflict: true,
        message: 'Permission request already resolved',
      })),
    });

    running = await startHttpServer({
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager,
    });

    const res = await running.app.inject({
      method: 'POST',
      url: '/v3/sessions/sess-1/permissions/perm_1',
      headers: {
        authorization: 'Bearer secret-token',
      },
      payload: {
        requestId: 'perm_1',
        decision: 'allow',
        decidedBy: 'desktop-ui',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      ok: false,
      conflict: true,
    });
  });

  it('maps storage ENOSPC submit failures to HTTP 507', async () => {
    const storageError = Object.assign(new Error('ENOSPC: no space left on device'), {
      code: 'ENOSPC',
    });
    const sessionManager = makeSessionManager({
      submitTurn: vi.fn(async () => {
        throw storageError;
      }),
    });

    running = await startHttpServer({
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager,
    });

    const res = await running.app.inject({
      method: 'POST',
      url: '/v3/sessions/sess-1/turns',
      headers: {
        authorization: 'Bearer secret-token',
      },
      payload: {
        clientId: 'client-1',
        writerId: 'writer-1',
        content: 'hello',
        mode: 'chat',
      },
    });

    expect(res.statusCode).toBe(507);
    expect(res.json()).toMatchObject({
      error: expect.stringContaining('space'),
    });
  });

  it('maps legacy /v1/chat ENOSPC submit failures to HTTP 507', async () => {
    const storageError = Object.assign(new Error('ENOSPC: no space left on device'), {
      code: 'ENOSPC',
    });
    const sessionManager = makeSessionManager({
      submitTurn: vi.fn(async () => {
        throw storageError;
      }),
    });

    running = await startHttpServer({
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager,
    });

    const res = await running.app.inject({
      method: 'POST',
      url: '/v1/chat',
      payload: {
        message: 'hello',
      },
    });

    expect(res.statusCode).toBe(507);
    expect(res.json()).toMatchObject({
      error: expect.stringContaining('space'),
    });
  });
});
