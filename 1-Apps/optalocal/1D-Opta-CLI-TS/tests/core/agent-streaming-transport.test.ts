import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wsStreamSpy } = vi.hoisted(() => ({
  wsStreamSpy: vi.fn(),
}));
const { resolveEndpointSpy } = vi.hoisted(() => ({
  resolveEndpointSpy: vi.fn(),
}));

vi.mock('../../src/lmx/connection.js', () => ({
  isAbortError: () => false,
  streamLmxChatWebSocket: wsStreamSpy,
}));
vi.mock('../../src/lmx/endpoints.js', () => ({
  resolveLmxEndpoint: resolveEndpointSpy,
}));

import { createStreamWithRetry } from '../../src/core/agent-streaming.js';

function makeChunkStream() {
  return (async function* () {
    yield {
      choices: [
        {
          delta: { content: 'ok' },
          finish_reason: 'stop',
        },
      ],
    };
  })();
}

function makeFailingStream(message: string) {
  return (async function* () {
    throw new Error(message);
  })();
}

function makeTextStream(parts: string[]) {
  return (async function* () {
    for (const part of parts) {
      yield {
        choices: [
          {
            delta: { content: part },
            finish_reason: null,
          },
        ],
      };
    }
    yield {
      choices: [
        {
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  })();
}

function makeMidStreamFailingTextStream(part: string, message: string) {
  return (async function* () {
    yield {
      choices: [
        {
          delta: { content: part },
          finish_reason: null,
        },
      ],
    };
    throw new Error(message);
  })();
}

function makeToolCallArgsStream(parts: string[]) {
  return (async function* () {
    for (const [index, part] of parts.entries()) {
      const hasMetadata = index === 0;
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: hasMetadata ? 'call_1' : undefined,
                  function: {
                    name: hasMetadata ? 'get_weather' : undefined,
                    arguments: part,
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };
    }
    yield {
      choices: [
        {
          delta: {},
          finish_reason: 'tool_calls',
        },
      ],
    };
  })();
}

function makeMidStreamFailingToolCallArgsStream(part: string, message: string) {
  return (async function* () {
    yield {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                function: {
                  name: 'get_weather',
                  arguments: part,
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };
    throw new Error(message);
  })();
}

async function collectText(stream: AsyncIterable<any>): Promise<string> {
  let text = '';
  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (typeof content === 'string') {
      text += content;
    }
  }
  return text;
}

async function collectToolCallArgsByIndex(stream: AsyncIterable<any>): Promise<Record<string, string>> {
  const argsByIndex = new Map<number, string>();
  for await (const chunk of stream) {
    const toolCalls = chunk.choices?.[0]?.delta?.tool_calls;
    if (!Array.isArray(toolCalls)) continue;
    for (const toolCall of toolCalls) {
      const idx = toolCall?.index ?? 0;
      const fragment = toolCall?.function?.arguments;
      if (typeof fragment !== 'string' || fragment.length === 0) continue;
      argsByIndex.set(idx, (argsByIndex.get(idx) ?? '') + fragment);
    }
  }
  return Object.fromEntries([...argsByIndex.entries()].map(([idx, args]) => [String(idx), args]));
}

describe('createStreamWithRetry transport selection', () => {
  beforeEach(() => {
    wsStreamSpy.mockReset();
    resolveEndpointSpy.mockReset();
    resolveEndpointSpy.mockResolvedValue({
      host: '127.0.0.1',
      port: 1234,
      source: 'primary',
      state: 'connected',
    });
  });

  it('skips LMX websocket when runtime provider is fallback', async () => {
    const sdkCreate = vi.fn().mockResolvedValue(makeChunkStream());
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    await createStreamWithRetry(
      client,
      {
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 0, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx+fallback',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    expect(wsStreamSpy).not.toHaveBeenCalled();
    expect(resolveEndpointSpy).not.toHaveBeenCalled();
    expect(sdkCreate).toHaveBeenCalledTimes(1);
  });

  it('uses LMX websocket when runtime provider is plain lmx', async () => {
    resolveEndpointSpy.mockResolvedValueOnce({
      host: 'backup-host',
      port: 1234,
      source: 'fallback',
      state: 'connected',
    });
    wsStreamSpy.mockResolvedValue(makeChunkStream());
    const sdkCreate = vi.fn().mockResolvedValue(makeChunkStream());
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 0, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    expect(wsStreamSpy).toHaveBeenCalledTimes(1);
    expect(String(wsStreamSpy.mock.calls[0]?.[0])).toBe('backup-host');
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(1);
    expect(sdkCreate).not.toHaveBeenCalled();
  });

  it('clears cached resolved host when websocket stream fails and retries with re-resolve', async () => {
    wsStreamSpy
      .mockResolvedValueOnce(makeFailingStream('LMX websocket stream closed unexpectedly (code 1006)'))
      .mockResolvedValueOnce(makeChunkStream());
    resolveEndpointSpy.mockResolvedValueOnce({
      host: 're-resolved-host',
      port: 1234,
      source: 'fallback',
      state: 'connected',
    });
    const sdkCreate = vi.fn().mockResolvedValue(makeChunkStream());
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;
    const transport = {
      providerName: 'lmx',
      resolvedLmxHost: 'cached-host',
      config: {
        provider: { active: 'lmx' },
        connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
      } as any,
    };

    await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 1, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      transport,
    );

    expect(wsStreamSpy).toHaveBeenCalledTimes(2);
    expect(String(wsStreamSpy.mock.calls[0]?.[0])).toBe('cached-host');
    expect(String(wsStreamSpy.mock.calls[1]?.[0])).toBe('re-resolved-host');
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(1);
    expect(sdkCreate).not.toHaveBeenCalled();
  });

  it('falls back to SDK stream after retryable websocket failures exhaust retries', async () => {
    resolveEndpointSpy
      .mockResolvedValueOnce({
        host: 'primary-host',
        port: 1234,
        source: 'primary',
        state: 'connected',
      })
      .mockResolvedValueOnce({
        host: 'secondary-host',
        port: 1234,
        source: 'fallback',
        state: 'connected',
      });
    wsStreamSpy
      .mockResolvedValueOnce(makeFailingStream('LMX websocket stream closed unexpectedly (code 1006)'))
      .mockResolvedValueOnce(makeFailingStream('LMX websocket stream closed unexpectedly (code 1006)'));
    const sdkCreate = vi.fn().mockResolvedValue(makeChunkStream());
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 1, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    expect(wsStreamSpy).toHaveBeenCalledTimes(2);
    expect(String(wsStreamSpy.mock.calls[0]?.[0])).toBe('primary-host');
    expect(String(wsStreamSpy.mock.calls[1]?.[0])).toBe('secondary-host');
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(2);
    expect(sdkCreate).toHaveBeenCalledTimes(1);
  });

  it('retries websocket mid-stream and de-duplicates replayed text when retry succeeds', async () => {
    resolveEndpointSpy
      .mockResolvedValueOnce({
        host: 'primary-host',
        port: 1234,
        source: 'primary',
        state: 'connected',
      })
      .mockResolvedValueOnce({
        host: 'secondary-host',
        port: 1234,
        source: 'fallback',
        state: 'connected',
      });

    wsStreamSpy
      .mockResolvedValueOnce(makeMidStreamFailingTextStream('he', 'LMX websocket stream closed unexpectedly (code 1006)'))
      .mockResolvedValueOnce(makeTextStream(['hello']));

    const sdkCreate = vi.fn().mockResolvedValue(makeTextStream(['hello']));
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    const stream = await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 1, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    await expect(collectText(stream)).resolves.toBe('hello');
    expect(wsStreamSpy).toHaveBeenCalledTimes(2);
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(2);
    expect(sdkCreate).not.toHaveBeenCalled();
  });

  it('falls back to SDK when websocket mid-stream recovery retries fail', async () => {
    resolveEndpointSpy
      .mockResolvedValueOnce({
        host: 'primary-host',
        port: 1234,
        source: 'primary',
        state: 'connected',
      })
      .mockResolvedValueOnce({
        host: 'secondary-host',
        port: 1234,
        source: 'fallback',
        state: 'connected',
      });

    wsStreamSpy
      .mockResolvedValueOnce(makeMidStreamFailingTextStream('hel', 'LMX websocket idle timeout after 30000ms'))
      .mockResolvedValueOnce(makeFailingStream('LMX websocket stream closed unexpectedly (code 1006)'));

    const sdkCreate = vi.fn().mockResolvedValue(makeTextStream(['hello']));
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    const stream = await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 1, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    await expect(collectText(stream)).resolves.toBe('hello');
    expect(wsStreamSpy).toHaveBeenCalledTimes(2);
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(2);
    expect(sdkCreate).toHaveBeenCalledTimes(1);
  });

  it('retries websocket mid-stream after tool calls and de-duplicates replayed tool args', async () => {
    resolveEndpointSpy
      .mockResolvedValueOnce({
        host: 'primary-host',
        port: 1234,
        source: 'primary',
        state: 'connected',
      })
      .mockResolvedValueOnce({
        host: 'secondary-host',
        port: 1234,
        source: 'fallback',
        state: 'connected',
      });

    wsStreamSpy
      .mockResolvedValueOnce(makeMidStreamFailingToolCallArgsStream('{"city":"N', 'LMX websocket stream closed unexpectedly (code 1006)'))
      .mockResolvedValueOnce(makeToolCallArgsStream(['{"city":"NY"}']));

    const sdkCreate = vi.fn().mockResolvedValue(makeToolCallArgsStream(['{"city":"NY"}']));
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    const stream = await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 1, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    await expect(collectToolCallArgsByIndex(stream)).resolves.toEqual({ 0: '{"city":"NY"}' });
    expect(wsStreamSpy).toHaveBeenCalledTimes(2);
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(2);
    expect(sdkCreate).not.toHaveBeenCalled();
  });

  it('falls back to SDK mid-stream after tool calls and de-duplicates replayed tool args', async () => {
    resolveEndpointSpy
      .mockResolvedValueOnce({
        host: 'primary-host',
        port: 1234,
        source: 'primary',
        state: 'connected',
      })
      .mockResolvedValueOnce({
        host: 'secondary-host',
        port: 1234,
        source: 'fallback',
        state: 'connected',
      });

    wsStreamSpy
      .mockResolvedValueOnce(makeMidStreamFailingToolCallArgsStream('{"city":"N', 'LMX websocket idle timeout after 30000ms'))
      .mockResolvedValueOnce(makeFailingStream('LMX websocket stream closed unexpectedly (code 1006)'));

    const sdkCreate = vi.fn().mockResolvedValue(makeToolCallArgsStream(['{"city":"NY"}']));
    const client = {
      chat: {
        completions: {
          create: sdkCreate,
        },
      },
    } as any;

    const stream = await createStreamWithRetry(
      client,
      {
        model: 'inferencerlabs/GLM-5-MLX-4.8bit',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { maxRetries: 1, backoffMs: 1, backoffMultiplier: 2 },
      undefined,
      {
        providerName: 'lmx',
        config: {
          provider: { active: 'lmx' },
          connection: { host: '127.0.0.1', port: 1234, adminKey: '' },
        } as any,
      },
    );

    await expect(collectToolCallArgsByIndex(stream)).resolves.toEqual({ 0: '{"city":"NY"}' });
    expect(wsStreamSpy).toHaveBeenCalledTimes(2);
    expect(resolveEndpointSpy).toHaveBeenCalledTimes(2);
    expect(sdkCreate).toHaveBeenCalledTimes(1);
  });
});
