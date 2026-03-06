/**
 * Tests for the SSE hold path in device-commands/stream/route.ts
 * and the createCommandSSEStream helper in lib/control-plane/sse-hold.ts.
 *
 * Test runner: Node.js built-in test runner (node --test).
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { installRouteModuleHooks } from './support/route-module-hooks.ts';
import {
  resetRouteMockState,
  setMockUser,
} from './support/route-mocks.ts';
import {
  resetInMemoryControlPlaneStore,
  createBridgeToken,
  createDeviceCommand,
  revokeBridgeToken,
} from './support/control-plane-store-stub.ts';
import { createCommandSSEStream } from '../lib/control-plane/sse-hold.ts';
import type { DeviceCommandRecord } from '../lib/control-plane/types.ts';

installRouteModuleHooks();

const streamRoute = await import('../app/api/device-commands/stream/route.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads all chunks from a ReadableStream<Uint8Array> and returns them as a
 *  single decoded UTF-8 string.  Cancels the stream after `timeoutMs` if the
 *  stream does not close naturally (guards against runaway tests). */
async function drainStream(
  stream: ReadableStream<Uint8Array>,
  timeoutMs = 4_000,
): Promise<string> {
  const decoder = new TextDecoder();
  let result = '';
  const reader = stream.getReader();

  const drainPromise = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    return result;
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('drainStream timed out')), timeoutMs),
  );

  return Promise.race([drainPromise, timeoutPromise]);
}

/**
 * Reads from a ReadableStream until a sentinel string appears in the
 * accumulated output, then cancels the stream and returns the collected text.
 * This lets integration tests inspect the initial SSE burst from the route
 * without waiting for the full 25-second hold to expire.
 */
async function readUntil(
  stream: ReadableStream<Uint8Array>,
  sentinel: string,
  timeoutMs = 5_000,
): Promise<string> {
  const decoder = new TextDecoder();
  let result = '';
  const reader = stream.getReader();

  const readPromise = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        if (result.includes(sentinel)) break;
      }
    } finally {
      reader.releaseLock();
      // Cancel the underlying stream so timers inside createCommandSSEStream
      // are cleaned up promptly.
      try {
        await stream.cancel();
      } catch {
        // Already cancelled or closed.
      }
    }
    return result;
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`readUntil("${sentinel}") timed out`)), timeoutMs),
  );

  return Promise.race([readPromise, timeoutPromise]);
}

/** Parse raw SSE text into an array of {event, data} objects.
 *  Comment lines (": ...") are included with event='comment'. */
function parseSseEvents(raw: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = raw.split('\n\n').filter((b) => b.trim().length > 0);

  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6).trim();
      } else if (line.startsWith(': ')) {
        events.push({ event: 'comment', data: line.slice(2).trim() });
      }
    }

    // Only push if it has at least an event name from an event: line or data
    if (event !== 'message' || data.length > 0) {
      if (!lines.some((l) => l.startsWith(': '))) {
        events.push({ event, data });
      }
    }
  }

  return events;
}

function makeCommandRecord(overrides: Partial<DeviceCommandRecord> = {}): DeviceCommandRecord {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    deviceId: randomUUID(),
    command: 'test.command',
    payload: {},
    scope: null,
    idempotencyKey: null,
    status: 'queued',
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    completedAt: null,
    resultHash: null,
    result: null,
    error: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests for createCommandSSEStream helper
// ---------------------------------------------------------------------------

test('createCommandSSEStream: sends connected event first', async () => {
  const stream = createCommandSSEStream({
    initialCommands: [],
    pollIntervalMs: 100,
    holdDurationMs: 200,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async () => [],
  });

  const raw = await drainStream(stream, 3_000);
  assert.ok(raw.includes('event: connected'), 'connected event missing');
  assert.ok(raw.includes('"ok":true'), 'connected data missing ok:true');
});

test('createCommandSSEStream: flushes initial commands immediately', async () => {
  const cmd1 = makeCommandRecord({ command: 'cmd.one' });
  const cmd2 = makeCommandRecord({ command: 'cmd.two' });

  const stream = createCommandSSEStream({
    initialCommands: [cmd1, cmd2],
    pollIntervalMs: 100,
    holdDurationMs: 200,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async () => [],
  });

  const raw = await drainStream(stream, 3_000);

  assert.ok(raw.includes(cmd1.id), `cmd1 id (${cmd1.id}) not found in SSE stream`);
  assert.ok(raw.includes(cmd2.id), `cmd2 id (${cmd2.id}) not found in SSE stream`);

  const events = parseSseEvents(raw);
  const commandEvents = events.filter((e) => e.event === 'command');
  assert.equal(commandEvents.length, 2, 'expected exactly 2 command events for initial flush');
});

test('createCommandSSEStream: sends end event with reason=timeout on close', async () => {
  const stream = createCommandSSEStream({
    initialCommands: [],
    pollIntervalMs: 100,
    holdDurationMs: 250,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async () => [],
  });

  const raw = await drainStream(stream, 3_000);

  assert.ok(raw.includes('event: end'), 'end event missing');
  assert.ok(raw.includes('"reason":"timeout"'), 'end reason should be timeout');
  assert.ok(raw.includes('"ok":true'), 'end ok should be true');
});

test('createCommandSSEStream: sends keepalive comments at the configured interval', async () => {
  const stream = createCommandSSEStream({
    initialCommands: [],
    pollIntervalMs: 500,
    holdDurationMs: 600,
    keepaliveIntervalMs: 200,
    fetchNewCommands: async () => [],
  });

  const raw = await drainStream(stream, 3_000);

  // At least one keepalive should appear within a 600ms hold with 200ms interval.
  assert.ok(raw.includes(': keepalive'), 'expected at least one keepalive comment');
});

test('createCommandSSEStream: pushes commands arriving after initial flush via polling', async () => {
  const laterCmd = makeCommandRecord({ command: 'cmd.later' });
  let pollCount = 0;

  const stream = createCommandSSEStream({
    initialCommands: [],
    pollIntervalMs: 100,
    holdDurationMs: 500,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async (_since) => {
      pollCount++;
      // Return the later command only on the second poll to simulate a new arrival.
      if (pollCount === 2) return [laterCmd];
      return [];
    },
  });

  const raw = await drainStream(stream, 3_000);

  assert.ok(raw.includes(laterCmd.id), 'later command not found in SSE output');
  const events = parseSseEvents(raw);
  const commandEvents = events.filter((e) => e.event === 'command');
  assert.equal(commandEvents.length, 1, 'expected exactly 1 command event for the late arrival');
});

test('createCommandSSEStream: cursor advances — already-seen commands are not re-delivered', async () => {
  const earlyCmd = makeCommandRecord({
    command: 'cmd.early',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const laterCmd = makeCommandRecord({
    command: 'cmd.later',
    createdAt: '2026-01-01T00:01:00.000Z',
  });

  const seenSince: string[] = [];
  let pollCount = 0;

  const stream = createCommandSSEStream({
    initialCommands: [earlyCmd],
    pollIntervalMs: 100,
    holdDurationMs: 400,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async (since) => {
      seenSince.push(since);
      pollCount++;
      if (pollCount === 1) return [laterCmd];
      return [];
    },
  });

  const raw = await drainStream(stream, 3_000);

  // The since cursor passed to fetchNewCommands must be at least earlyCmd.createdAt.
  assert.ok(
    seenSince.length > 0,
    'fetchNewCommands was never called',
  );
  assert.ok(
    seenSince[0]! >= earlyCmd.createdAt,
    `cursor should be >= earlyCmd.createdAt; got ${seenSince[0]}`,
  );

  // Both commands should appear exactly once.
  const events = parseSseEvents(raw);
  const commandEvents = events.filter((e) => e.event === 'command');
  const ids = commandEvents.map((e) => (JSON.parse(e.data) as { id: string }).id);
  assert.equal(ids.filter((id) => id === earlyCmd.id).length, 1, 'earlyCmd should appear once');
  assert.equal(ids.filter((id) => id === laterCmd.id).length, 1, 'laterCmd should appear once');

  assert.ok(raw.includes(earlyCmd.id));
  assert.ok(raw.includes(laterCmd.id));
});

test('createCommandSSEStream: event ordering — connected comes before commands', async () => {
  const cmd = makeCommandRecord();

  const stream = createCommandSSEStream({
    initialCommands: [cmd],
    pollIntervalMs: 100,
    holdDurationMs: 300,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async () => [],
  });

  const raw = await drainStream(stream, 3_000);

  const connectedIdx = raw.indexOf('event: connected');
  const commandIdx = raw.indexOf('event: command');
  assert.ok(connectedIdx !== -1, 'connected event not found');
  assert.ok(commandIdx !== -1, 'command event not found');
  assert.ok(connectedIdx < commandIdx, 'connected must appear before command events');
});

test('createCommandSSEStream: end event appears last after hold duration', async () => {
  const stream = createCommandSSEStream({
    initialCommands: [makeCommandRecord()],
    pollIntervalMs: 50,
    holdDurationMs: 200,
    keepaliveIntervalMs: 5_000,
    fetchNewCommands: async () => [],
  });

  const raw = await drainStream(stream, 3_000);

  const endIdx = raw.lastIndexOf('event: end');
  assert.ok(endIdx !== -1, 'end event not found');
  // end should come after all command events
  const lastCommandIdx = raw.lastIndexOf('event: command');
  if (lastCommandIdx !== -1) {
    assert.ok(endIdx > lastCommandIdx, 'end event must come after last command event');
  }
});

// ---------------------------------------------------------------------------
// Integration tests for the route handler
// ---------------------------------------------------------------------------

test.beforeEach(() => {
  resetRouteMockState();
  resetInMemoryControlPlaneStore();
});

test('route GET SSE: returns 200 with text/event-stream content type', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: { accept: 'text/event-stream' },
    }),
  );

  assert.equal(response.status, 200);
  const ct = response.headers.get('content-type');
  assert.ok(ct?.includes('text/event-stream'), `expected text/event-stream, got: ${ct}`);
});

test('route GET SSE: sends connected event and initial commands then end event', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);

  // Create a command in the store before opening the stream.
  await createDeviceCommand({
    userId,
    request: {
      deviceId,
      command: 'lmx.http.request',
      payload: { path: '/admin/status', method: 'GET' },
      scope: null,
      idempotencyKey: randomUUID(),
    },
  });

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: { accept: 'text/event-stream' },
    }),
  );

  assert.equal(response.status, 200);
  assert.ok(response.body, 'response body should be a ReadableStream');

  // Read just until the initial command event arrives — no need to wait for
  // the full 25-second hold to expire.
  const raw = await readUntil(
    response.body as ReadableStream<Uint8Array>,
    'event: command',
    3_000,
  );

  assert.ok(raw.includes('event: connected'), 'connected event missing');
  assert.ok(raw.includes('event: command'), 'command event missing for pre-queued command');
  assert.ok(raw.includes('lmx.http.request'), 'command payload not found in stream');
});

test('route GET SSE: no commands → connected event is emitted, no command events in initial burst', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: { accept: 'text/event-stream' },
    }),
  );

  assert.equal(response.status, 200);
  // Read until we see the connected event, then stop — no need to wait for the
  // 25-second hold.
  const raw = await readUntil(
    response.body as ReadableStream<Uint8Array>,
    'event: connected',
    3_000,
  );

  assert.ok(raw.includes('event: connected'), 'connected event should be the first event');
  assert.ok(!raw.includes('event: command'), 'no commands queued — should not see command events');
});

test('route GET SSE: 401 when no bearer and no session user', async () => {
  const deviceId = randomUUID();
  setMockUser(null);

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: { accept: 'text/event-stream' },
    }),
  );

  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'unauthenticated');
});

test('route GET SSE: 401 when bearer is an invalid / unknown token', async () => {
  const deviceId = randomUUID();
  setMockUser(null);

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer notarealtoken',
      },
    }),
  );

  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'unauthenticated');
});

test('route GET SSE: 403 when bridge token device mismatch', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  const wrongDeviceId = randomUUID();
  setMockUser(null);

  // Mint a token tied to `deviceId` but request stream for `wrongDeviceId`.
  const { token } = await createBridgeToken({
    userId,
    deviceId,
    scopes: ['device.commands.consume'],
    ttlSeconds: 300,
  });

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${wrongDeviceId}`, {
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
      },
    }),
  );

  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'bridge_token_device_mismatch');
});

test('route GET SSE: 401 when bridge token is revoked', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(null);

  const { token, claims } = await createBridgeToken({
    userId,
    deviceId,
    scopes: ['device.commands.consume'],
    ttlSeconds: 300,
  });

  await revokeBridgeToken(claims.tokenId);

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
      },
    }),
  );

  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'unauthenticated');
});

test('route GET SSE: valid bridge token delivers queued commands', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(null);

  const { token } = await createBridgeToken({
    userId,
    deviceId,
    scopes: ['device.commands.consume'],
    ttlSeconds: 300,
  });

  await createDeviceCommand({
    userId,
    request: {
      deviceId,
      command: 'models.skills',
      payload: { args: 'list' },
      scope: 'telegram:dm:peer-123',
      idempotencyKey: randomUUID(),
    },
  });

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
      },
    }),
  );

  assert.equal(response.status, 200);
  // Read until the command event arrives — no need to wait 25 s.
  const raw = await readUntil(
    response.body as ReadableStream<Uint8Array>,
    'event: command',
    3_000,
  );

  assert.ok(raw.includes('event: connected'));
  assert.ok(raw.includes('event: command'));
  assert.ok(raw.includes('models.skills'));
});

test('route GET SSE: 400 for invalid deviceId', async () => {
  const userId = randomUUID();
  setMockUser(userId);

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=not-a-uuid`, {
      headers: { accept: 'text/event-stream' },
    }),
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'invalid_device_id');
});

test('route GET SSE: rate limiting returns 429', async () => {
  // Create a separate route import context is not possible in this runner without
  // additional complexity, so we verify the rate limiter behaviour by making many
  // requests from the same IP that bypass auth (they hit rate check first).
  // We use a deviceId that will fail validation so auth is never reached — the
  // rate limiter is checked before parsing params.
  const userId = randomUUID();
  setMockUser(userId);

  // The in-process rate limiter uses the x-forwarded-for header; forge a single IP.
  const fakeIp = `10.99.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

  let rateLimited = false;
  // 241 requests should exceed the 240/min limit for this IP.
  for (let i = 0; i < 241; i++) {
    const response = await streamRoute.GET(
      new Request(`http://localhost:3002/api/device-commands/stream?deviceId=invalid`, {
        headers: {
          accept: 'application/json',
          'x-forwarded-for': fakeIp,
        },
      }),
    );
    if (response.status === 429) {
      rateLimited = true;
      break;
    }
  }

  assert.ok(rateLimited, 'expected at least one 429 after exceeding rate limit');
});

// ---------------------------------------------------------------------------
// JSON path — unchanged behaviour
// ---------------------------------------------------------------------------

test('route GET JSON: returns commands as JSON when Accept is application/json', async () => {
  const userId = randomUUID();
  const deviceId = randomUUID();
  setMockUser(userId);

  await createDeviceCommand({
    userId,
    request: {
      deviceId,
      command: 'daemon.ping',
      payload: {},
      scope: null,
      idempotencyKey: randomUUID(),
    },
  });

  const response = await streamRoute.GET(
    new Request(`http://localhost:3002/api/device-commands/stream?deviceId=${deviceId}`, {
      headers: { accept: 'application/json' },
    }),
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    delivered: number;
    commands: Array<{ command: string }>;
  };
  assert.equal(body.ok, true);
  assert.equal(body.delivered, 1);
  assert.equal(body.commands[0]?.command, 'daemon.ping');
});
