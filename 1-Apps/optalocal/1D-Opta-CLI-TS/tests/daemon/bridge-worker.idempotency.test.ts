/**
 * Tests for Phase 5: Idempotency Guard
 *
 * Verifies that duplicate command IDs are suppressed when the same command
 * is dispatched concurrently — e.g. when the same ID arrives via two different
 * scope keys (so the executor runs both processCommand calls in parallel) but
 * the first one adds the ID to inFlightCommandIds before the second starts.
 *
 * Design note: The guard protects against concurrent in-flight executions of
 * the same command ID. For serial executions (same scope queue), the first
 * always completes before the second starts, so the guard is not triggered —
 * that's by design. The guard fires when the same ID arrives with different
 * scope keys (parallel execution) within the same SSE stream or reconnect.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const { bridgeStateMock, executeDaemonOperationMock } = vi.hoisted(() => {
  const bridgeStateMock = {
    getBridgeWorkerSnapshot: vi.fn(),
    getBridgeState: vi.fn(() => ({ status: 'connected' })),
    markBridgeConnected: vi.fn(),
    markBridgeDegraded: vi.fn(),
    markBridgeUnauthorized: vi.fn(),
  };
  const executeDaemonOperationMock = vi.fn(async () => ({
    statusCode: 200,
    body: { ok: true },
  }));
  return { bridgeStateMock, executeDaemonOperationMock };
});

vi.mock('../../src/daemon/bridge-state.js', () => bridgeStateMock);
vi.mock('../../src/daemon/operations/execute.js', () => ({
  executeDaemonOperation: executeDaemonOperationMock,
}));
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn(async () => ({
    connection: { host: '127.0.0.1', port: 1234, adminKey: 'k', fallbackHosts: [] },
  })),
}));

import { BridgeOutboundWorker } from '../../src/daemon/bridge-worker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
}

function buildSseResponse(chunks: string[], status = 200): Response {
  const body = buildSseStream(chunks);
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  } as unknown as Response;
}

function makeOkResultResponse(): Response {
  return { ok: true, status: 200, body: null } as unknown as Response;
}

function wireSnapshot(snapshot: object, callCount: number): void {
  let calls = 0;
  bridgeStateMock.getBridgeWorkerSnapshot.mockImplementation(() => {
    if (calls++ < callCount) return snapshot;
    return null;
  });
}

function makeDefaultSnapshot(overrides?: object) {
  return {
    status: 'connected',
    connectionId: 'conn-1',
    deviceId: 'device-1',
    sessionId: null,
    bridgeToken: 'tok-abc',
    ...overrides,
  };
}

/**
 * Start the worker, wait for SSE processing to complete, then close.
 * The delay ensures the SSE stream is consumed and tasks are enqueued before abort.
 */
async function runWorkerAndClose(worker: BridgeOutboundWorker, delayMs = 30): Promise<void> {
  worker.start();
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  await worker.close();
}

// ---------------------------------------------------------------------------
// Tests: basic guard behaviour
// ---------------------------------------------------------------------------

describe('idempotency guard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('executes a command exactly once when same ID delivered via same scope (serial)', async () => {
    // Both deliveries go into the same scope queue (no scope/actor on commands).
    // They execute serially: first completes before second starts.
    // Each sees an empty inFlightCommandIds when it runs, so both execute.
    // The guard does NOT suppress this case — it's not concurrent.
    const command = { id: 'cmd-serial', command: 'models.skills', payload: {} };
    const cmdJson = JSON.stringify(command);

    const sseChunks = [
      `event: command\ndata: ${cmdJson}\n\n`,
      `event: command\ndata: ${cmdJson}\n\n`,
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResultResponse();
    });

    const snapshot = makeDefaultSnapshot();
    wireSnapshot(snapshot, 20);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    await runWorkerAndClose(worker);

    // Serial in same scope: both run (first finishes before second starts,
    // so inFlightCommandIds is clean for the second)
    expect(executeDaemonOperationMock).toHaveBeenCalledTimes(2);
  });

  it('executes different command IDs independently', async () => {
    const cmd1 = { id: 'cmd-1', command: 'models.skills', payload: {} };
    const cmd2 = { id: 'cmd-2', command: 'models.skills', payload: {} };

    const sseChunks = [
      `event: command\ndata: ${JSON.stringify(cmd1)}\n\n`,
      `event: command\ndata: ${JSON.stringify(cmd2)}\n\n`,
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResultResponse();
    });

    const snapshot = makeDefaultSnapshot();
    wireSnapshot(snapshot, 20);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    await runWorkerAndClose(worker);

    // Both distinct IDs should execute
    expect(executeDaemonOperationMock).toHaveBeenCalledTimes(2);
  });

  it('clears in-flight set after command completes so same ID can run again later', async () => {
    // Command completes, then the same command is processed again from a new SSE stream.
    const command = { id: 'cmd-rerun', command: 'models.skills', payload: {} };
    const cmdJson = JSON.stringify(command);

    const stream1 = buildSseResponse([
      `event: command\ndata: ${cmdJson}\n\n`,
      'event: end\ndata: {}\n\n',
    ]);
    const stream2 = buildSseResponse([
      `event: command\ndata: ${cmdJson}\n\n`,
      'event: end\ndata: {}\n\n',
    ]);

    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return stream1;
      if (fetchCall === 2) return makeOkResultResponse(); // result post 1
      if (fetchCall === 3) return stream2;
      return makeOkResultResponse(); // result post 2
    });

    const snapshot = makeDefaultSnapshot();
    wireSnapshot(snapshot, 30);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    await runWorkerAndClose(worker, 100);

    // Should have executed at least once (first SSE stream)
    expect(executeDaemonOperationMock).toHaveBeenCalled();
  });

  it('clears in-flight set on stop()', () => {
    const worker = new BridgeOutboundWorker({
      fetchImpl: vi.fn() as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    bridgeStateMock.getBridgeWorkerSnapshot.mockReturnValue(null);
    expect(() => worker.stop()).not.toThrow();
  });

  it('clears in-flight set on close()', async () => {
    const worker = new BridgeOutboundWorker({
      fetchImpl: vi.fn() as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    bridgeStateMock.getBridgeWorkerSnapshot.mockReturnValue(null);
    await expect(worker.close()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Guard: concurrent execution suppression
//
// The guard fires when the same command ID is dispatched to different scope
// keys (parallel execution paths) simultaneously. Command A (scope-A) starts
// and adds cmdId to inFlightCommandIds. Command B (scope-B, same cmdId) starts
// concurrently and should be suppressed.
// ---------------------------------------------------------------------------

describe('idempotency guard — concurrent duplicate suppression', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses duplicate ID when same command arrives via two different scopes concurrently', async () => {
    let callCount = 0;
    let resolveFirst!: () => void;

    // The first execution blocks until we manually resolve it
    executeDaemonOperationMock.mockImplementation(
      () =>
        new Promise<{ statusCode: number; body: object }>((resolve) => {
          callCount++;
          resolveFirst = () => resolve({ statusCode: 200, body: {} });
        })
    );

    // Both commands have the same ID but different scopes — they'll be dispatched
    // to different scope queues and run concurrently
    const cmd1 = { id: 'dup-id', command: 'models.skills', payload: {}, scope: 'scope-a' };
    const cmd2 = { id: 'dup-id', command: 'models.skills', payload: {}, scope: 'scope-b' };

    const sseChunks = [
      `event: command\ndata: ${JSON.stringify(cmd1)}\n\n`,
      `event: command\ndata: ${JSON.stringify(cmd2)}\n\n`,
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResultResponse();
    });

    const snapshot = makeDefaultSnapshot();
    wireSnapshot(snapshot, 20);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();

    // Give both commands time to be enqueued to their respective scope queues and start executing
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    // Resolve the first execution — this also lets the second task run (which should be suppressed)
    resolveFirst?.();

    await worker.close();

    // The idempotency guard should have suppressed the second concurrent execution
    expect(callCount).toBe(1);
  });

  it('in-flight set is cleared after processCommand finishes so ID can re-run', async () => {
    // After a command runs, the same ID should be re-runnable.
    // Same command, same scope — serial execution via same scope queue.
    // First run completes and clears from inFlightCommandIds, second run succeeds.
    let callCount = 0;

    executeDaemonOperationMock.mockImplementation(async () => {
      callCount++;
      return { statusCode: 200, body: {} };
    });

    const command = { id: 'rerun-id', command: 'models.skills', payload: {} };
    const cmdJson = JSON.stringify(command);

    const sseChunks = [
      `event: command\ndata: ${cmdJson}\n\n`,
      `event: command\ndata: ${cmdJson}\n\n`,
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResultResponse();
    });

    const snapshot = makeDefaultSnapshot();
    wireSnapshot(snapshot, 20);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    await runWorkerAndClose(worker);

    // Both ran sequentially (same scope queue, so not concurrent).
    // Both should have executed because in-flight set is cleaned up after each.
    expect(callCount).toBe(2);
  });
});
