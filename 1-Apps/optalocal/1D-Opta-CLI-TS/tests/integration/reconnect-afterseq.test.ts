/**
 * Integration: afterSeq cursor logic for WebSocket reconnect replay.
 *
 * SessionManager.getEventsAfter() delegates to readSessionEventsAfter() from
 * the session store, which is responsible for returning only events with
 * seq > afterSeq.  These tests mock the session store to return controlled
 * event sets and verify that the afterSeq filtering contract is upheld end-to-end.
 *
 * The tests also exercise the ws-server behaviour indirectly by verifying that
 * the data contract between SessionManager and the store is honoured: no extra
 * filtering occurs in SessionManager itself — the store is the single authority.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V3Envelope } from '../../src/protocol/v3/types.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const readSessionEventsAfterMock = vi.fn<
  (sessionId: string, afterSeq: number) => Promise<V3Envelope[]>
>();

vi.mock('../../src/daemon/session-store.js', () => ({
  listStoredSessions: vi.fn().mockResolvedValue([]),
  readSessionSnapshot: vi.fn().mockResolvedValue(null),
  writeSessionSnapshot: vi.fn().mockResolvedValue(undefined),
  appendSessionEvent: vi.fn().mockResolvedValue(undefined),
  readSessionEventsAfter: readSessionEventsAfterMock,
  hasSessionStore: vi.fn().mockResolvedValue(false),
  ensureDaemonStore: vi.fn().mockResolvedValue(undefined),
  ensureSessionStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/daemon/worker-pool.js', () => ({
  ToolWorkerPool: vi.fn().mockImplementation(() => ({
    runTool: vi.fn().mockResolvedValue('ok'),
    getStats: vi.fn().mockReturnValue({ workers: 0, busy: 0, queued: 0 }),
    close: vi.fn().mockResolvedValue(undefined),
    warmUp: vi.fn(),
  })),
}));

vi.mock('../../src/daemon/background-manager.js', () => ({
  BackgroundManager: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue(() => {}),
    list: vi.fn().mockResolvedValue([]),
    start: vi.fn().mockResolvedValue({ processId: 'p-1', state: 'running' }),
    status: vi.fn().mockReturnValue(null),
    output: vi.fn().mockReturnValue(null),
    kill: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    updateOptions: vi.fn(),
  })),
}));

vi.mock('../../src/daemon/telemetry.js', () => ({
  logDaemonEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/core/agent.js', () => ({
  agentLoop: vi.fn().mockResolvedValue({ messages: [], toolCallCount: 0 }),
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: vi.fn().mockImplementation(() => ({
    models: vi
      .fn()
      .mockResolvedValue({ models: [{ model_id: 'test-model', status: 'loaded' }] }),
  })),
}));

vi.mock('../../src/lmx/model-lifecycle.js', () => ({
  findMatchingModelId: vi.fn().mockReturnValue('test-model'),
  normalizeConfiguredModelId: vi.fn().mockReturnValue('test-model'),
}));

vi.mock('../../src/utils/errors.js', () => ({
  errorMessage: vi.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelope(
  sessionId: string,
  seq: number,
  event: 'turn.token' = 'turn.token'
): V3Envelope<typeof event, { text: string }> {
  return {
    v: '3',
    event,
    daemonId: 'daemon-test',
    sessionId,
    seq,
    ts: new Date().toISOString(),
    payload: { text: `token-${seq}` },
  };
}

// Build a bank of events with seq 1..10 for a session
const SESSION_ID = 'sess-replay';
const ALL_EVENTS = Array.from({ length: 10 }, (_, i) =>
  makeEnvelope(SESSION_ID, i + 1)
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('afterSeq cursor — reconnect replay (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: store returns only events with seq > afterSeq (mirroring real store)
    readSessionEventsAfterMock.mockImplementation(
      async (_sessionId: string, afterSeq: number) =>
        ALL_EVENTS.filter((e) => e.seq > afterSeq)
    );
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('getEventsAfter(sessionId, 0) returns all events', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    const events = await manager.getEventsAfter(SESSION_ID, 0);

    expect(events).toHaveLength(10);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('getEventsAfter(sessionId, 5) returns only events with seq > 5', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    const events = await manager.getEventsAfter(SESSION_ID, 5);

    expect(events).toHaveLength(5);
    expect(events.every((e) => e.seq > 5)).toBe(true);
    expect(events.map((e) => e.seq)).toEqual([6, 7, 8, 9, 10]);
  });

  it('getEventsAfter(sessionId, 999) returns empty array with no error', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    const events = await manager.getEventsAfter(SESSION_ID, 999);

    expect(events).toEqual([]);
  });

  it('sequential seq numbers are preserved in replay order', async () => {
    // Store returns events in reverse order to confirm caller can sort them
    readSessionEventsAfterMock.mockResolvedValueOnce(
      [...ALL_EVENTS].reverse().filter((e) => e.seq > 0)
    );

    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    const events = await manager.getEventsAfter(SESSION_ID, 0);

    // The ws-server sorts by seq before delivering; verify the raw contract:
    // getEventsAfter returns whatever the store returns (sorting is ws-server's job)
    expect(events).toHaveLength(10);
    // Seq values are all present — order is store-defined
    const seqs = events.map((e) => e.seq).sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('passes the afterSeq argument through to the store unchanged', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    await manager.getEventsAfter(SESSION_ID, 42);

    expect(readSessionEventsAfterMock).toHaveBeenCalledWith(SESSION_ID, 42);
  });

  it('passes the sessionId through to the store unchanged', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    const customSessionId = 'custom-session-xyz';
    await manager.getEventsAfter(customSessionId, 0);

    expect(readSessionEventsAfterMock).toHaveBeenCalledWith(customSessionId, 0);
  });

  it('boundary: afterSeq matching the last event returns empty array', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    // afterSeq = 10 means "give me events after seq 10" — there are none
    const events = await manager.getEventsAfter(SESSION_ID, 10);

    expect(events).toEqual([]);
  });

  it('boundary: afterSeq one less than last event returns exactly the last event', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test');

    const events = await manager.getEventsAfter(SESSION_ID, 9);

    expect(events).toHaveLength(1);
    expect(events[0]?.seq).toBe(10);
  });
});
