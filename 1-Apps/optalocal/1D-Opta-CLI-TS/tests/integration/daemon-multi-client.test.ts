/**
 * Integration: Daemon HTTP server with concurrent clients.
 *
 * Verifies that two independent clients can create sessions, submit turns,
 * and poll events concurrently without cross-contamination or race conditions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHttpServer, type RunningHttpServer } from '../../src/daemon/http-server.js';
import type { SessionManager } from '../../src/daemon/session-manager.js';
import type { V3Envelope } from '../../src/protocol/v3/types.js';

vi.mock('../../src/daemon/lifecycle.js', () => ({
  writeDaemonState: vi.fn(async () => {}),
}));

function makeEvent(
  sessionId: string,
  seq: number,
): V3Envelope<'turn.token', { text: string }> {
  return {
    v: '3',
    event: 'turn.token',
    daemonId: 'daemon-test',
    sessionId,
    seq,
    ts: new Date().toISOString(),
    payload: { text: `tok-${seq}` },
  };
}

function makeSessionManager(
  overrides?: Partial<Record<keyof SessionManager, unknown>>,
): SessionManager {
  const sessions = new Map<string, { sessionId: string; model: string }>();
  let sessionCounter = 0;
  let turnCounter = 0;

  const base: Partial<SessionManager> = {
    getRuntimeStats: vi.fn(() => ({
      sessionCount: sessions.size,
      activeTurnCount: 0,
      queuedTurnCount: 0,
      subscriberCount: 0,
      ingressSeq: 0,
      toolWorkers: { workers: 2, busy: 0, queued: 0 },
    })),
    createSession: vi.fn(async (opts: { sessionId?: string; model?: string }) => {
      const sessionId = opts.sessionId ?? `sess-${++sessionCounter}`;
      const model = opts.model ?? 'default';
      sessions.set(sessionId, { sessionId, model });
      return {
        sessionId,
        model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        queuedTurns: 0,
        toolCallCount: 0,
        writerCount: 0,
      };
    }),
    getSession: vi.fn(async (id: string) => sessions.get(id) ?? null),
    getSessionMessages: vi.fn(async () => []),
    submitTurn: vi.fn(async (_sessionId: string, _payload: unknown) => ({
      turnId: `turn-${++turnCounter}`,
      queued: 1,
    })),
    resolvePermission: vi.fn(() => ({ ok: true, conflict: false })),
    cancelSessionTurns: vi.fn(async () => 0),
    getEventsAfter: vi.fn(async (sessionId: string) => [makeEvent(sessionId, 1)]),
    subscribe: vi.fn((_sessionId: string, _cb: (event: V3Envelope) => void) => () => {}),
  };

  return { ...base, ...(overrides ?? {}) } as SessionManager;
}

describe('daemon multi-client concurrency', () => {
  let running: RunningHttpServer | null = null;

  afterEach(async () => {
    if (running) await running.close();
    running = null;
    vi.clearAllMocks();
  });

  it('allows two clients to create sessions concurrently without conflict', async () => {
    const sessionManager = makeSessionManager();
    running = await startHttpServer({
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 0,
      token: 'tok',
      sessionManager,
    });

    const [resA, resB] = await Promise.all([
      running.app.inject({
        method: 'POST',
        url: '/v3/sessions',
        headers: { authorization: 'Bearer tok' },
        payload: { clientId: 'client-a', model: 'test-model' },
      }),
      running.app.inject({
        method: 'POST',
        url: '/v3/sessions',
        headers: { authorization: 'Bearer tok' },
        payload: { clientId: 'client-b', model: 'test-model' },
      }),
    ]);

    expect(resA.statusCode).toBe(201);
    expect(resB.statusCode).toBe(201);

    const a = resA.json() as { sessionId: string };
    const b = resB.json() as { sessionId: string };

    // Each client gets a distinct session
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(sessionManager.createSession).toHaveBeenCalledTimes(2);
  });

  it('isolates events between two sessions', async () => {
    const eventsA = [makeEvent('sess-client-a', 1), makeEvent('sess-client-a', 2)];
    const eventsB = [makeEvent('sess-client-b', 1)];

    const getEventsAfter = vi.fn(async (sessionId: string) => {
      if (sessionId === 'sess-client-a') return eventsA;
      if (sessionId === 'sess-client-b') return eventsB;
      return [];
    });

    const sessionManager = makeSessionManager({ getEventsAfter });
    running = await startHttpServer({
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 0,
      token: 'tok',
      sessionManager,
    });

    const [resA, resB] = await Promise.all([
      running.app.inject({
        method: 'GET',
        url: '/v3/sessions/sess-client-a/events?afterSeq=0',
        headers: { authorization: 'Bearer tok' },
      }),
      running.app.inject({
        method: 'GET',
        url: '/v3/sessions/sess-client-b/events?afterSeq=0',
        headers: { authorization: 'Bearer tok' },
      }),
    ]);

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);

    expect(resA.json()).toEqual({ events: eventsA });
    expect(resB.json()).toEqual({ events: eventsB });

    // Verify no cross-contamination: A's events don't contain B's sessionId
    const aEvents = resA.json() as { events: V3Envelope[] };
    expect(aEvents.events.every((e) => e.sessionId === 'sess-client-a')).toBe(true);
  });

  it('submits turns from two clients concurrently and tracks them independently', async () => {
    const sessionManager = makeSessionManager();
    running = await startHttpServer({
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 0,
      token: 'tok',
      sessionManager,
    });

    const [resA, resB] = await Promise.all([
      running.app.inject({
        method: 'POST',
        url: '/v3/sessions/sess-client-a/turns',
        headers: { authorization: 'Bearer tok' },
        payload: { clientId: 'client-a', writerId: 'w-a', content: 'task from A', mode: 'chat' },
      }),
      running.app.inject({
        method: 'POST',
        url: '/v3/sessions/sess-client-b/turns',
        headers: { authorization: 'Bearer tok' },
        payload: { clientId: 'client-b', writerId: 'w-b', content: 'task from B', mode: 'chat' },
      }),
    ]);

    expect(resA.statusCode).toBe(202);
    expect(resB.statusCode).toBe(202);

    const a = resA.json() as { turnId: string };
    const b = resB.json() as { turnId: string };

    expect(a.turnId).not.toBe(b.turnId);
    expect(sessionManager.submitTurn).toHaveBeenCalledTimes(2);
  });

  it('rejects unauthenticated requests from both clients', async () => {
    const sessionManager = makeSessionManager();
    running = await startHttpServer({
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 0,
      token: 'tok',
      sessionManager,
    });

    const [resA, resB] = await Promise.all([
      running.app.inject({
        method: 'POST',
        url: '/v3/sessions',
        payload: { clientId: 'client-a', model: 'test-model' },
        // no auth header
      }),
      running.app.inject({
        method: 'POST',
        url: '/v3/sessions/sess-x/turns',
        payload: { clientId: 'client-b', writerId: 'w-b', content: 'hi', mode: 'chat' },
        // no auth header
      }),
    ]);

    expect(resA.statusCode).toBe(401);
    expect(resB.statusCode).toBe(401);
    expect(sessionManager.createSession).not.toHaveBeenCalled();
    expect(sessionManager.submitTurn).not.toHaveBeenCalled();
  });
});
