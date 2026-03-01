import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHttpServer, type RunningHttpServer } from '../../src/daemon/http-server.js';
import type { SessionManager } from '../../src/daemon/session-manager.js';
import type { V3Envelope } from '../../src/protocol/v3/types.js';
import type {
  OperationExecuteErrorResponse,
  OperationExecuteSuccessResponse,
  OperationListResponse,
} from '../../src/protocol/v3/operations.js';

vi.mock('../../src/daemon/lifecycle.js', () => ({
  writeDaemonState: vi.fn(async () => {}),
}));

function makeSessionManager(
  overrides?: Partial<Record<keyof SessionManager, unknown>>
): SessionManager {
  const base = {
    getRuntimeStats: vi.fn(() => ({
      sessionCount: 0,
      activeTurnCount: 0,
      queuedTurnCount: 0,
      subscriberCount: 0,
      ingressSeq: 0,
      toolWorkers: { workers: 0, busy: 0, queued: 0 },
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
    submitTurn: vi.fn(async () => ({ turnId: 'turn-1', queued: 0 })),
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

describe('daemon operations routes', () => {
  let running: RunningHttpServer | null = null;

  afterEach(async () => {
    if (running) await running.close();
    running = null;
    vi.clearAllMocks();
  });

  it('lists registered operations with auth and rejects unauthorized callers', async () => {
    running = await startHttpServer({
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager: makeSessionManager(),
      listen: false,
    });

    const unauthorized = await running.app.inject({
      method: 'GET',
      url: '/v3/operations',
    });
    expect(unauthorized.statusCode).toBe(401);

    const response = await running.app.inject({
      method: 'GET',
      url: '/v3/operations',
      headers: { authorization: 'Bearer secret-token' },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as OperationListResponse;
    expect(body.operations.length).toBeGreaterThan(0);
    expect(body.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'doctor', safety: 'read' }),
        expect.objectContaining({ id: 'account.status', safety: 'read' }),
        expect.objectContaining({ id: 'account.logout', safety: 'write' }),
        expect.objectContaining({ id: 'sessions.list', safety: 'read' }),
        expect.objectContaining({ id: 'sessions.delete', safety: 'write' }),
        expect.objectContaining({ id: 'diff', safety: 'read' }),
        expect.objectContaining({ id: 'benchmark', safety: 'dangerous' }),
      ])
    );
  });

  it('executes a read operation, validates input, and enforces dangerous confirmation', async () => {
    running = await startHttpServer({
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 0,
      token: 'secret-token',
      sessionManager: makeSessionManager(),
      listen: false,
    });

    const unauthorized = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/env.list',
      payload: { input: {} },
    });
    expect(unauthorized.statusCode).toBe(401);

    const invalid = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/env.list',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: { unknown: true } },
    });
    expect(invalid.statusCode).toBe(400);

    const success = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/env.list',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(success.statusCode).toBe(200);
    const successBody = success.json() as OperationExecuteSuccessResponse;
    expect(successBody).toMatchObject({
      ok: true,
      id: 'env.list',
      safety: 'read',
    });
    expect(successBody.result).toMatchObject({
      profiles: expect.any(Array),
    });

    const accountStatus = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/account.status',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(accountStatus.statusCode).toBe(200);
    expect(accountStatus.json()).toMatchObject({
      ok: true,
      id: 'account.status',
      safety: 'read',
      result: {
        authenticated: expect.any(Boolean),
      },
    });

    const sessionsList = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/sessions.list',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(sessionsList.statusCode).toBe(200);
    expect(sessionsList.json()).toMatchObject({
      ok: true,
      id: 'sessions.list',
      safety: 'read',
      result: expect.any(Array),
    });

    const diffOp = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/diff',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(diffOp.statusCode).toBe(200);
    expect(diffOp.json()).toMatchObject({
      ok: true,
      id: 'diff',
      safety: 'read',
      result: {
        stdout: expect.any(String),
        stderr: expect.any(String),
      },
    });

    const sessionsDelete = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/sessions.delete',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: { id: 'missing-session' } },
    });
    expect(sessionsDelete.statusCode).toBe(200);
    expect(sessionsDelete.json()).toMatchObject({
      ok: true,
      id: 'sessions.delete',
      safety: 'write',
      result: {
        stdout: expect.any(String),
        stderr: expect.any(String),
      },
    });

    const accountLogout = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/account.logout',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(accountLogout.statusCode).toBe(200);
    expect(accountLogout.json()).toMatchObject({
      ok: true,
      id: 'account.logout',
      safety: 'write',
      result: {
        action: 'logout',
      },
    });

    const dangerousDenied = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/benchmark',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(dangerousDenied.statusCode).toBe(403);
    const deniedBody = dangerousDenied.json() as OperationExecuteErrorResponse;
    expect(deniedBody).toMatchObject({
      ok: false,
      id: 'benchmark',
      safety: 'dangerous',
      error: {
        code: 'dangerous_confirmation_required',
      },
    });

    const invalidOperation = await running.app.inject({
      method: 'POST',
      url: '/v3/operations/not-real',
      headers: { authorization: 'Bearer secret-token' },
      payload: { input: {} },
    });
    expect(invalidOperation.statusCode).toBe(400);
  });
});
