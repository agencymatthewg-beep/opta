import WebSocket, { type RawData } from 'ws';
import type OpenAI from 'openai';

export type LmxConnectionState = 'connected' | 'degraded' | 'disconnected';

export interface LmxConnectionResult {
  state: LmxConnectionState;
  latencyMs: number;
  modelsLoaded?: number;
  reason?: string;
}

interface ProbeOptions {
  timeoutMs?: number;
  adminKey?: string;
}

interface LmxWsStreamOptions {
  adminKey?: string;
  signal?: AbortSignal;
  handshakeTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export interface LmxChatStreamRequest {
  model: string;
  messages: unknown[];
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  stop?: string | string[] | null;
  tools?: unknown;
  tool_choice?: unknown;
  response_format?: unknown;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
  num_ctx?: number | null;
}

type Chunk = OpenAI.Chat.Completions.ChatCompletionChunk;

const DEFAULT_WS_HANDSHAKE_TIMEOUT_MS = 5_000;
const DEFAULT_WS_IDLE_TIMEOUT_MS = 30_000;

interface LmxWsMessage {
  type?: string;
  request_id?: string;
  content?: unknown;
  model?: unknown;
  finish_reason?: unknown;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
  tool_call?: {
    index?: unknown;
    id?: unknown;
    name?: unknown;
    arguments?: unknown;
  };
  error?: unknown;
}

function makeAbortError(message: string): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  const lowered = err.message.toLowerCase();
  return lowered.includes('aborted') || lowered.includes('cancelled');
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

class AsyncChunkQueue implements AsyncIterable<Chunk> {
  private readonly items: Chunk[] = [];
  private readonly waiters: Array<{
    resolve: (value: IteratorResult<Chunk>) => void;
    reject: (err: Error) => void;
  }> = [];
  private done = false;
  private failure: Error | null = null;

  push(chunk: Chunk): void {
    if (this.done || this.failure) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ value: chunk, done: false });
      return;
    }
    this.items.push(chunk);
  }

  finish(): void {
    if (this.done || this.failure) return;
    this.done = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.resolve({ value: undefined as unknown as Chunk, done: true });
    }
  }

  fail(err: Error): void {
    if (this.done || this.failure) return;
    this.failure = err;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.reject(err);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<Chunk> {
    return {
      next: async () => {
        if (this.items.length > 0) {
          const value = this.items.shift()!;
          return { value, done: false };
        }
        if (this.failure) throw this.failure;
        if (this.done) return { value: undefined as unknown as Chunk, done: true };
        return new Promise<IteratorResult<Chunk>>((resolve, reject) => {
          this.waiters.push({ resolve, reject });
        });
      },
      return: async () => {
        this.finish();
        return { value: undefined as unknown as Chunk, done: true };
      },
    };
  }
}

function parseWsJson(raw: RawData): LmxWsMessage | null {
  try {
    return JSON.parse(String(raw)) as LmxWsMessage;
  } catch {
    return null;
  }
}

function makeChunkBase(requestId: string, model: string): Omit<Chunk, 'choices'> {
  return {
    id: requestId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
  };
}

function toContentChunk(requestId: string, model: string, content: string): Chunk {
  return {
    ...makeChunkBase(requestId, model),
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  };
}

function toToolChunk(
  requestId: string,
  model: string,
  toolCall: NonNullable<LmxWsMessage['tool_call']>
): Chunk {
  const index = coerceNumber(toolCall.index, 0);
  const hasId = typeof toolCall.id === 'string' && toolCall.id.length > 0;
  const hasName = typeof toolCall.name === 'string' && toolCall.name.length > 0;
  const hasArgs = typeof toolCall.arguments === 'string';
  const fn: { name?: string; arguments?: string } = {};
  if (hasName) fn.name = toolCall.name as string;
  if (hasArgs) fn.arguments = toolCall.arguments as string;

  return {
    ...makeChunkBase(requestId, model),
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index,
              ...(hasId ? { id: toolCall.id as string, type: 'function' as const } : {}),
              ...(hasName || hasArgs ? { function: fn } : {}),
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

function toDoneChunk(
  requestId: string,
  model: string,
  finishReason: 'length' | 'stop' | 'tool_calls' | 'content_filter' | 'function_call' | null,
  usage?: LmxWsMessage['usage']
): Chunk {
  const promptTokens = coerceNumber(usage?.prompt_tokens, 0);
  const completionTokens = coerceNumber(usage?.completion_tokens, 0);
  const totalTokens = coerceNumber(usage?.total_tokens, promptTokens + completionTokens);
  return {
    ...makeChunkBase(requestId, model),
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
  };
}

function normalizeFinishReason(
  value: unknown
): 'length' | 'stop' | 'tool_calls' | 'content_filter' | 'function_call' | null {
  if (value === null) return null;
  if (value === 'length' || value === 'tool_calls' || value === 'content_filter' || value === 'function_call') {
    return value;
  }
  return 'stop';
}

function buildSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  if (!external) return AbortSignal.timeout(timeoutMs);
  return AbortSignal.any([external, AbortSignal.timeout(timeoutMs)]);
}

/**
 * Probe Opta LMX reachability using the lightweight health endpoints first.
 *
 * Order:
 * 1) /healthz (liveness, unauthenticated)
 * 2) /readyz (readiness + loaded model count)
 * 3) /v1/models (fallback for older servers without /readyz)
 */
export async function probeLmxConnection(
  host: string,
  port: number,
  options?: ProbeOptions
): Promise<LmxConnectionResult> {
  const timeoutMs = options?.timeoutMs ?? 2000;
  const base = `http://${host}:${port}`;
  const started = Date.now();

  // 1) Liveness
  try {
    const res = await fetch(`${base}/healthz`, {
      signal: buildSignal(timeoutMs),
    });
    if (!res.ok) {
      return {
        state: 'degraded',
        latencyMs: Date.now() - started,
        reason: `healthz_http_${res.status}`,
      };
    }
  } catch (err) {
    return {
      state: 'disconnected',
      latencyMs: Date.now() - started,
      reason: err instanceof Error ? err.message : 'healthz_failed',
    };
  }

  // 2) Readiness (best signal for UX status)
  try {
    const readyRes = await fetch(`${base}/readyz`, {
      signal: buildSignal(timeoutMs),
    });
    if (readyRes.ok) {
      const data = (await readyRes.json()) as { models_loaded?: number };
      return {
        state: 'connected',
        latencyMs: Date.now() - started,
        modelsLoaded: data.models_loaded,
      };
    }
    // No models loaded = alive but not ready
    if (readyRes.status === 503) {
      return {
        state: 'degraded',
        latencyMs: Date.now() - started,
        modelsLoaded: 0,
        reason: 'no_models_loaded',
      };
    }
  } catch {
    // Ignore and fall back to /v1/models for compatibility.
  }

  // 3) Fallback for older LMX versions
  try {
    const headers: Record<string, string> = {};
    if (options?.adminKey) headers['X-Admin-Key'] = options.adminKey;
    const modelsRes = await fetch(`${base}/v1/models`, {
      signal: buildSignal(timeoutMs),
      headers,
    });
    if (!modelsRes.ok) {
      return {
        state: 'degraded',
        latencyMs: Date.now() - started,
        reason: `models_http_${modelsRes.status}`,
      };
    }
    const data = (await modelsRes.json()) as { data?: unknown[] };
    const count = Array.isArray(data.data) ? data.data.length : undefined;
    return {
      state: count && count > 0 ? 'connected' : 'degraded',
      latencyMs: Date.now() - started,
      modelsLoaded: count,
    };
  } catch (err) {
    return {
      state: 'degraded',
      latencyMs: Date.now() - started,
      reason: err instanceof Error ? err.message : 'models_failed',
    };
  }
}

/**
 * Preferred low-latency transport for daemon-side LMX streaming.
 *
 * Uses /v1/chat/stream (WebSocket) and emits OpenAI-compatible chunks so the
 * existing stream collector can remain provider-agnostic.
 */
export async function streamLmxChatWebSocket(
  host: string,
  port: number,
  request: LmxChatStreamRequest,
  options?: LmxWsStreamOptions
): Promise<AsyncIterable<Chunk>> {
  if (options?.signal?.aborted) {
    throw makeAbortError('LMX stream aborted before start');
  }

  const queue = new AsyncChunkQueue();
  const protocol = 'ws';
  const url = `${protocol}://${host}:${port}/v1/chat/stream`;
  const headers: Record<string, string> = {};
  if (options?.adminKey) {
    headers['X-Admin-Key'] = options.adminKey;
  }
  const handshakeTimeoutMs = Math.max(0, options?.handshakeTimeoutMs ?? DEFAULT_WS_HANDSHAKE_TIMEOUT_MS);
  const idleTimeoutMs = Math.max(0, options?.idleTimeoutMs ?? DEFAULT_WS_IDLE_TIMEOUT_MS);

  const socket = new WebSocket(url, { headers });
  let requestId: string | null = null;
  let model = request.model;
  let completed = false;
  let cleaned = false;
  let sawContentChunk = false;
  let sawToolChunk = false;
  let handshakeTimer: NodeJS.Timeout | null = null;
  let idleTimer: NodeJS.Timeout | null = null;

  const closeSocket = () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.once('error', () => {
        // Suppress ws close races during teardown.
      });
      try {
        socket.close();
      } catch {
        // Ignore close races while cleaning up failure/abort paths.
      }
    }
  };

  const clearHandshakeTimer = () => {
    if (!handshakeTimer) return;
    clearTimeout(handshakeTimer);
    handshakeTimer = null;
  };

  const clearIdleTimer = () => {
    if (!idleTimer) return;
    clearTimeout(idleTimer);
    idleTimer = null;
  };

  const restartIdleTimer = () => {
    if (idleTimeoutMs <= 0) return;
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      if (completed) return;
      fail(new Error(`LMX websocket idle timeout after ${idleTimeoutMs}ms`));
    }, idleTimeoutMs);
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearHandshakeTimer();
    clearIdleTimer();
    socket.removeAllListeners();
    options?.signal?.removeEventListener('abort', onAbort);
  };

  const fail = (err: Error) => {
    cleanup();
    queue.fail(err);
    closeSocket();
  };

  const finish = () => {
    cleanup();
    queue.finish();
    closeSocket();
  };

  const onAbort = () => {
    const abortErr = makeAbortError('LMX stream aborted');
    if (requestId && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'chat.cancel',
        request_id: requestId,
      }));
    }
    fail(abortErr);
  };

  socket.once('open', () => {
    clearHandshakeTimer();
    restartIdleTimer();
    if (options?.signal?.aborted) {
      onAbort();
      return;
    }
    socket.send(JSON.stringify({
      type: 'chat.request',
      stream: true,
      ...request,
    }));
  });

  socket.on('message', (raw: RawData) => {
    if (completed) return;
    restartIdleTimer();
    const data = parseWsJson(raw);
    if (!data || typeof data.type !== 'string') return;
    if (typeof data.request_id === 'string' && data.request_id) {
      requestId = data.request_id;
    }
    if (typeof data.model === 'string' && data.model) {
      model = data.model;
    }

    if (data.type === 'chat.token') {
      if (typeof data.content !== 'string' || !data.content) return;
      sawContentChunk = true;
      queue.push(toContentChunk(requestId ?? 'chatcmpl-lmx', model, data.content));
      return;
    }

    if (data.type === 'chat.tool_call' && data.tool_call) {
      sawToolChunk = true;
      queue.push(toToolChunk(requestId ?? 'chatcmpl-lmx', model, data.tool_call));
      return;
    }

    if (data.type === 'chat.done' || data.type === 'chat.complete' || data.type === 'chat.completed' || data.type === 'done') {
      completed = true;
      const finishReason = normalizeFinishReason(data.finish_reason);
      queue.push(toDoneChunk(requestId ?? 'chatcmpl-lmx', model, finishReason, data.usage));
      finish();
      return;
    }

    if (data.type === 'chat.error') {
      completed = true;
      const message = typeof data.error === 'string' && data.error ? data.error : 'LMX websocket error';
      fail(new Error(message));
    }
  });

  socket.once('error', (err) => {
    if (completed) return;
    fail(err instanceof Error ? err : new Error(String(err)));
  });

  socket.once('close', (code, reasonBuf) => {
    if (completed) return;
    if (options?.signal?.aborted) {
      fail(makeAbortError('LMX stream aborted'));
      return;
    }

    // Some LMX builds close cleanly (1000) immediately after final token/tool-call
    // without emitting an explicit chat.done frame.
    if (code === 1000 && (sawContentChunk || sawToolChunk)) {
      completed = true;
      queue.push(toDoneChunk(
        requestId ?? 'chatcmpl-lmx',
        model,
        sawToolChunk ? 'tool_calls' : 'stop',
      ));
      finish();
      return;
    }

    const reason = Buffer.isBuffer(reasonBuf) ? reasonBuf.toString('utf-8') : String(reasonBuf ?? '');
    const details = reason ? ` (code ${code}: ${reason})` : ` (code ${code})`;
    fail(new Error(`LMX websocket stream closed unexpectedly${details}`));
  });

  if (handshakeTimeoutMs > 0) {
    handshakeTimer = setTimeout(() => {
      if (completed) return;
      fail(new Error(`LMX websocket handshake timed out after ${handshakeTimeoutMs}ms`));
    }, handshakeTimeoutMs);
  }
  options?.signal?.addEventListener('abort', onAbort, { once: true });
  return queue;
}
