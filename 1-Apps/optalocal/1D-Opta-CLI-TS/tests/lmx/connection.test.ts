import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { isAbortError, probeLmxConnection, streamLmxChatWebSocket } from '../../src/lmx/connection.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function drainStream(stream: AsyncIterable<unknown>): Promise<void> {
  for await (const _chunk of stream) {
    // no-op
  }
}

describe('probeLmxConnection', () => {
  it('returns connected when /healthz and /readyz succeed', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models_loaded: 2 }),
      }) as unknown as typeof fetch;

    const result = await probeLmxConnection('localhost', 1234, { timeoutMs: 1000 });
    expect(result.state).toBe('connected');
    expect(result.modelsLoaded).toBe(2);
  });

  it('returns degraded when /readyz reports 503 (no models loaded)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 503 }) as unknown as typeof fetch;

    const result = await probeLmxConnection('localhost', 1234, { timeoutMs: 1000 });
    expect(result.state).toBe('degraded');
    expect(result.modelsLoaded).toBe(0);
    expect(result.reason).toBe('no_models_loaded');
  });

  it('falls back to /v1/models when /readyz is unavailable', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('readyz missing'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-a' }] }),
      }) as unknown as typeof fetch;

    const result = await probeLmxConnection('localhost', 1234, { timeoutMs: 1000 });
    expect(result.state).toBe('connected');
    expect(result.modelsLoaded).toBe(1);
  });

  it('returns disconnected when /healthz fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const result = await probeLmxConnection('localhost', 1234, { timeoutMs: 1000 });
    expect(result.state).toBe('disconnected');
  });

  it('returns degraded when /healthz responds with non-OK status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const result = await probeLmxConnection('localhost', 1234, { timeoutMs: 1000 });
    expect(result.state).toBe('degraded');
    expect(result.reason).toBe('healthz_http_503');
  });

  it('marks fallback as degraded when /v1/models is empty', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('readyz missing'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }) as unknown as typeof fetch;

    const result = await probeLmxConnection('localhost', 1234, { timeoutMs: 1000 });
    expect(result.state).toBe('degraded');
    expect(result.modelsLoaded).toBe(0);
  });

  it('detects abort-style errors', () => {
    const err = new Error('request aborted by user');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
    expect(isAbortError(new Error('regular error'))).toBe(false);
  });

  it('fails fast if websocket stream starts with an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(streamLmxChatWebSocket('localhost', 1234, {
      model: 'test-model',
      messages: [],
    }, {
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('streamLmxChatWebSocket close handling', () => {
  async function startWsServer(
    handler: (socket: import('ws').WebSocket) => void,
  ): Promise<{ host: string; port: number; close: () => Promise<void> }> {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    server.on('connection', (socket) => handler(socket));
    const address = server.address() as AddressInfo;
    return {
      host: '127.0.0.1',
      port: address.port,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  }

  type StreamChunk = { choices: Array<{ finish_reason: string | null; delta?: { tool_calls?: unknown[] } }> };

  async function collect(stream: AsyncIterable<StreamChunk>): Promise<Array<{ finishReason: string | null; toolCallChunk: boolean }>> {
    const events: Array<{ finishReason: string | null; toolCallChunk: boolean }> = [];
    for await (const chunk of stream) {
      events.push({
        finishReason: chunk.choices[0]?.finish_reason ?? null,
        toolCallChunk: Array.isArray(chunk.choices[0]?.delta?.tool_calls),
      });
    }
    return events;
  }

  it('fails with handshake timeout when the websocket upgrade never completes', async () => {
    const sockets = new Set<Socket>();
    const deadServer = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => deadServer.listen(0, '127.0.0.1', () => resolve()));
    const address = deadServer.address() as AddressInfo;

    try {
      const stream = await streamLmxChatWebSocket('127.0.0.1', address.port, {
        model: 'test-model',
        messages: [],
      }, {
        handshakeTimeoutMs: 40,
        idleTimeoutMs: 500,
      });
      await expect(drainStream(stream)).rejects.toThrow('LMX websocket handshake timed out');
    } finally {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve) => deadServer.close(() => resolve()));
    }
  });

  it('fails with idle timeout after open when no stream frames arrive', async () => {
    const ws = await startWsServer((socket) => {
      socket.once('message', () => {
        // Keep socket open and send no chat frames.
      });
    });

    try {
      const stream = await streamLmxChatWebSocket(ws.host, ws.port, {
        model: 'test-model',
        messages: [],
      }, {
        handshakeTimeoutMs: 500,
        idleTimeoutMs: 40,
      });
      await expect(drainStream(stream)).rejects.toThrow('LMX websocket idle timeout');
    } finally {
      await ws.close();
    }
  });

  it('treats clean close after tool-call chunk as implicit done', async () => {
    const ws = await startWsServer((socket) => {
      socket.once('message', () => {
        socket.send(JSON.stringify({
          type: 'chat.tool_call',
          request_id: 'req-1',
          model: 'test-model',
          tool_call: {
            index: 0,
            id: 'call-1',
            name: 'read_file',
            arguments: '{"path":"README.md"}',
          },
        }));
        socket.close(1000, 'normal-close-no-done');
      });
    });

    try {
      const stream = await streamLmxChatWebSocket(ws.host, ws.port, {
        model: 'test-model',
        messages: [],
      });

      const events = await collect(stream);
      expect(events.some((event) => event.toolCallChunk)).toBe(true);
      expect(events[events.length - 1]?.finishReason).toBe('tool_calls');
    } finally {
      await ws.close();
    }
  });

  it('still errors on clean close when no stream payload was received', async () => {
    const ws = await startWsServer((socket) => {
      socket.once('message', () => {
        socket.close(1000, 'empty-stream');
      });
    });

    try {
      const stream = await streamLmxChatWebSocket(ws.host, ws.port, {
        model: 'test-model',
        messages: [],
      });
      await expect(drainStream(stream)).rejects.toThrow('LMX websocket stream closed unexpectedly');
    } finally {
      await ws.close();
    }
  });
});
