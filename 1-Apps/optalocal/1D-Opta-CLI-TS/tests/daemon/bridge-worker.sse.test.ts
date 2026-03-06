/**
 * Tests for Phase 2: SSE Consumer (subscribeCommandStream + parseSSEStream)
 *
 * These tests exercise the SSE parsing and stream subscription behaviour of
 * BridgeOutboundWorker without making real network calls.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — must be hoisted before any import of bridge-worker
// ---------------------------------------------------------------------------

const { bridgeStateMock, executeDaemonOperationMock } = vi.hoisted(() => {
  const bridgeStateMock = {
    getBridgeWorkerSnapshot: vi.fn(),
    getBridgeState: vi.fn(() => ({ status: 'connected' })),
    markBridgeConnected: vi.fn(),
    markBridgeDegraded: vi.fn(),
    markBridgeUnauthorized: vi.fn(),
  };
  const executeDaemonOperationMock = vi.fn(async () => ({ statusCode: 200, body: {} }));
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

/**
 * Build a fake ReadableStream from a sequence of SSE text chunks.
 * Each chunk is encoded to Uint8Array and streamed sequentially.
 */
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

/**
 * Build a minimal fake Response object with a streaming body.
 */
function buildSseResponse(chunks: string[], status = 200): Response {
  const body = buildSseStream(chunks);
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  } as unknown as Response;
}

function makeOkResponse(): Response {
  return { ok: true, status: 200, body: null } as unknown as Response;
}

/**
 * Make a snapshot object. start() reads snapshot once for the connectionId check,
 * then runLoop reads it again. Both should return the same snapshot.
 */
function makeSnapshot(overrides?: object) {
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
 * Wire up bridgeStateMock.getBridgeWorkerSnapshot to return `snapshot` for N
 * calls and then null. This drives start() + runLoop() termination cleanly.
 */
function wireSnapshot(snapshot: object, callCount: number): void {
  let calls = 0;
  bridgeStateMock.getBridgeWorkerSnapshot.mockImplementation(() => {
    if (calls++ < callCount) return snapshot;
    return null;
  });
}

// ---------------------------------------------------------------------------
// Tests: command events
// ---------------------------------------------------------------------------

describe('SSE stream — command events', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('yields commands from well-formed SSE command events', async () => {
    const command = { id: 'c1', command: 'models.skills', payload: {} };
    const sseChunks = [
      `event: command\ndata: ${JSON.stringify(command)}\n\n`,
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResponse(); // result post
    });

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 10);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    await worker.close();

    // Worker should have fetched the SSE stream with text/event-stream
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/device-commands/stream'),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'text/event-stream' }),
      })
    );
  });

  it('returns cleanly on SSE end event (server side close)', async () => {
    const sseChunks = ['event: end\ndata: {}\n\n'];
    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResponse();
    });

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 5);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    await worker.close();

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/device-commands/stream'),
      expect.any(Object)
    );
  });

  it('throws BridgeUnauthorizedError on 401', async () => {
    const unauthorizedResponse = { ok: false, status: 401, body: null } as unknown as Response;
    const fetchImpl = vi.fn(async () => unauthorizedResponse);

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 10);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    // Give the runLoop time to process the 401 and call markBridgeUnauthorized
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    await worker.close();

    expect(bridgeStateMock.markBridgeUnauthorized).toHaveBeenCalled();
  });

  it('throws BridgeUnauthorizedError on 403', async () => {
    const forbiddenResponse = { ok: false, status: 403, body: null } as unknown as Response;
    const fetchImpl = vi.fn(async () => forbiddenResponse);

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 10);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    await worker.close();

    expect(bridgeStateMock.markBridgeUnauthorized).toHaveBeenCalled();
  });

  it('skips malformed JSON in command events gracefully', async () => {
    const sseChunks = [
      'event: command\ndata: NOT_VALID_JSON\n\n',
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResponse();
    });

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 5);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    // Should not throw
    worker.start();
    await worker.close();

    // executeDaemonOperation should not have been called (no valid commands)
    expect(executeDaemonOperationMock).not.toHaveBeenCalled();
  });

  it('handles SSE keepalive comments without breaking', async () => {
    const command = { id: 'c-keepalive', command: 'models.skills', payload: {} };
    const sseChunks = [
      // Keepalive comment followed by a real command
      ': keepalive\n\n',
      `event: command\ndata: ${JSON.stringify(command)}\n\n`,
      'event: end\ndata: {}\n\n',
    ];

    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResponse();
    });

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 10);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    await worker.close();

    // Stream was consumed without error — fetch for stream was called
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/device-commands/stream'),
      expect.any(Object)
    );
  });

  it('stops the SSE generator when signal is aborted', async () => {
    // Stream that never closes — would block forever if signal is not respected
    const encoder = new TextEncoder();
    let pullCount = 0;
    const neverEndingStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount++;
        if (pullCount === 1) {
          // Give one keepalive, then wait (simulating a blocked connection)
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        }
        // Never close — rely on signal abort
      },
    });

    const longLivedResponse = { ok: true, status: 200, body: neverEndingStream } as unknown as Response;
    const fetchImpl = vi.fn(async () => longLivedResponse);

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 10);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();

    // Closing should resolve even though the stream never ends
    const closePromise = worker.close();
    await expect(closePromise).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: Accept header is text/event-stream (not application/json)
// ---------------------------------------------------------------------------

describe('SSE stream — request headers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends Accept: text/event-stream header', async () => {
    const sseChunks = ['event: end\ndata: {}\n\n'];
    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResponse();
    });

    const snapshot = makeSnapshot();
    wireSnapshot(snapshot, 5);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    await worker.close();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('text/event-stream');
  });

  it('sends Authorization header with bearer token', async () => {
    const sseChunks = ['event: end\ndata: {}\n\n'];
    const sseResponse = buildSseResponse(sseChunks);
    let fetchCall = 0;
    const fetchImpl = vi.fn(async () => {
      fetchCall++;
      if (fetchCall === 1) return sseResponse;
      return makeOkResponse();
    });

    // Use a custom bridge token — wireSnapshot ensures all calls see this token
    const snapshot = makeSnapshot({ bridgeToken: 'my-bridge-token' });
    wireSnapshot(snapshot, 5);

    const worker = new BridgeOutboundWorker({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      accountsBaseUrl: 'https://accounts.test',
    });

    worker.start();
    await worker.close();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-bridge-token');
  });
});
