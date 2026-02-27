import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { registerWsServer } from '../../src/daemon/ws-server.js';
import type { SessionManager } from '../../src/daemon/session-manager.js';
import type { V3Envelope } from '../../src/protocol/v3/types.js';

function makeEvent(seq: number): V3Envelope<'turn.token', { text: string }> {
  return {
    v: '3',
    event: 'turn.token',
    daemonId: 'daemon-test',
    sessionId: 's1',
    seq,
    ts: new Date().toISOString(),
    payload: { text: `t${seq}` },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await sleep(10);
  }
  throw new Error('Timed out waiting for condition');
}

describe('ws-server replay semantics', () => {
  let app: FastifyInstance | null = null;
  let socket: WebSocket | null = null;

  afterEach(async () => {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
    socket = null;
    if (app) {
      await app.close();
    }
    app = null;
  });

  it('replays in order and de-duplicates buffered live events', async () => {
    let subscriber: ((event: V3Envelope) => void) | null = null;
    let resolveHistory: ((events: V3Envelope[]) => void) | null = null;

    const sessionManagerStub = {
      subscribe: (_sessionId: string, cb: (event: V3Envelope) => void) => {
        subscriber = cb;
        return () => {
          subscriber = null;
        };
      },
      getEventsAfter: async (_sessionId: string, _afterSeq: number) => {
        return await new Promise<V3Envelope[]>((resolve) => {
          resolveHistory = resolve;
        });
      },
      submitTurn: async () => ({ turnId: 't', queued: 1 }),
      resolvePermission: () => ({ ok: true, conflict: false }),
      cancelSessionTurns: async () => 0,
    } as unknown as SessionManager;

    app = Fastify({ logger: false });
    await app.register(websocket);
    await registerWsServer(app, {
      sessionManager: sessionManagerStub,
      token: 'token-123',
    });
    await app.listen({ host: '127.0.0.1', port: 0 });

    const addr = app.server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Expected TCP server address');
    }

    const receivedSeqs: number[] = [];
    socket = new WebSocket(
      `ws://127.0.0.1:${addr.port}/v3/ws?sessionId=s1&afterSeq=0`,
      {
        headers: { Authorization: 'Bearer token-123' },
      }
    );
    socket.on('message', (raw) => {
      const parsed = JSON.parse(String(raw)) as { seq?: number };
      if (typeof parsed.seq === 'number') {
        receivedSeqs.push(parsed.seq);
      }
    });

    await waitFor(() => subscriber !== null && resolveHistory !== null);

    // Live event arrives while replay is still pending.
    subscriber?.(makeEvent(3));
    // Replay contains the same seq=3 event; it must not be duplicated.
    resolveHistory?.([makeEvent(2), makeEvent(1), makeEvent(3)]);

    await waitFor(() => receivedSeqs.length === 3);
    expect(receivedSeqs).toEqual([1, 2, 3]);

    // Live stream should continue with monotonic order after replay.
    subscriber?.(makeEvent(4));
    await waitFor(() => receivedSeqs.length === 4);
    expect(receivedSeqs).toEqual([1, 2, 3, 4]);
  });

  it('continues live streaming when replay lookup fails during reconnect', async () => {
    let subscriber: ((event: V3Envelope) => void) | null = null;
    let rejectHistory: ((err: Error) => void) | null = null;

    const sessionManagerStub = {
      subscribe: (_sessionId: string, cb: (event: V3Envelope) => void) => {
        subscriber = cb;
        return () => {
          subscriber = null;
        };
      },
      getEventsAfter: async (_sessionId: string, _afterSeq: number) => {
        return await new Promise<V3Envelope[]>((_resolve, reject) => {
          rejectHistory = reject;
        });
      },
      submitTurn: async () => ({ turnId: 't', queued: 1 }),
      resolvePermission: () => ({ ok: true, conflict: false }),
      cancelSessionTurns: async () => 0,
    } as unknown as SessionManager;

    app = Fastify({ logger: false });
    await app.register(websocket);
    await registerWsServer(app, {
      sessionManager: sessionManagerStub,
      token: 'token-123',
    });
    await app.listen({ host: '127.0.0.1', port: 0 });

    const addr = app.server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Expected TCP server address');
    }

    const receivedSeqs: number[] = [];
    socket = new WebSocket(
      `ws://127.0.0.1:${addr.port}/v3/ws?sessionId=s1&afterSeq=1`,
      {
        headers: { Authorization: 'Bearer token-123' },
      }
    );
    socket.on('message', (raw) => {
      const parsed = JSON.parse(String(raw)) as { seq?: number };
      if (typeof parsed.seq === 'number') {
        receivedSeqs.push(parsed.seq);
      }
    });

    await waitFor(() => subscriber !== null && rejectHistory !== null);

    // Event arrives while reconnect replay is still pending.
    subscriber?.(makeEvent(2));
    // Replay fails; buffered live event should still flush and stream continue.
    rejectHistory?.(new Error('history unavailable'));

    await waitFor(() => receivedSeqs.length === 1);
    expect(receivedSeqs).toEqual([2]);

    subscriber?.(makeEvent(3));
    await waitFor(() => receivedSeqs.length === 2);
    expect(receivedSeqs).toEqual([2, 3]);
  });
});
