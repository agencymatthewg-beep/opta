/**
 * agent-streaming.ts — Stream collection + retry logic.
 *
 * Extracted from agent.ts to isolate the streaming response collection,
 * retry-with-backoff for transient errors, and tool call accumulation.
 */

import type OpenAI from 'openai';
import { debug } from './debug.js';
import { estimateTokens } from '../utils/tokens.js';
import { sanitizeTerminalText } from '../utils/text.js';
import { ThinkingRenderer, stripThinkTags } from '../ui/thinking.js';
import { sleep } from '../utils/common.js';
import { errorMessage } from '../utils/errors.js';
import type { StatusBar } from '../ui/statusbar.js';
import type { OnStreamCallbacks } from './agent.js';
import type { OptaConfig } from './config.js';
import { isAbortError, streamLmxChatWebSocket } from '../lmx/connection.js';
import { resolveLmxEndpoint } from '../lmx/endpoints.js';

// --- Types ---

export interface ToolCallAccum {
  id: string;
  name: string;
  args: string;
}

/** Token usage reported by the API in the final streaming chunk. */
export interface StreamUsage {
  promptTokens: number;
  completionTokens: number;
}

/** Shorthand for the chunk iterable type produced by every streaming code path. */
type ChunkStream = AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

// --- Streaming Retry ---

/** LMX WebSocket-specific error message substrings that warrant a retry. */
const LMX_WS_RETRYABLE_MESSAGES = [
  'lmx websocket stream closed unexpectedly',
  'lmx websocket handshake timed out',
  'lmx websocket idle timeout',
] as const;

/** Generic network error message substrings that warrant a retry. */
const NETWORK_RETRYABLE_MESSAGES = [
  'econnrefused',
  'econnreset',
  'etimedout',
  'fetch failed',
  'network',
  'socket hang up',
  'premature close',
  'other side closed',
] as const;

/**
 * Returns true for transient errors that are safe to retry:
 * LMX WebSocket disconnects, network failures, and HTTP 5xx responses.
 * Always returns false for AbortErrors (user-initiated cancellations).
 */
function isRetryableError(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (LMX_WS_RETRYABLE_MESSAGES.some((fragment) => msg.includes(fragment))) return true;
    if (NETWORK_RETRYABLE_MESSAGES.some((fragment) => msg.includes(fragment))) return true;
  }
  // OpenAI SDK wraps HTTP errors with a status property
  const status = (err as { status?: number }).status;
  if (status !== undefined && status >= 500) return true;
  return false;
}

export interface StreamTransportOptions {
  config?: OptaConfig;
  /** Runtime provider identifier (e.g. lmx, anthropic, lmx+fallback). */
  providerName?: string;
  signal?: AbortSignal;
  /** Resolved LMX host cached across retries within a turn. */
  resolvedLmxHost?: string;
  /** Canonical WebSocket URL from server discovery, cached across retries. */
  resolvedLmxWsUrl?: string;
  /**
   * Set to true after a WebSocket connection failure that fell through to SSE.
   * Shared across all turns in the same agent session so subsequent turns skip
   * WS attempts entirely instead of repeating 3 failing connection attempts.
   */
  lmxWsUnavailable?: boolean;
}

/** Exponential-backoff retry parameters used by {@link createStreamWithRetry}. */
type RetryConfig = {
  /** Maximum number of retry attempts before surfacing the error. */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry. */
  backoffMs: number;
  /** Multiplier applied to the delay on each successive attempt. */
  backoffMultiplier: number;
};

/**
 * Opens an SSE-backed streaming chat completion via the OpenAI SDK.
 * `include_usage: true` ensures the final chunk carries token-count metadata.
 */
async function createSdkStream(
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  signal?: AbortSignal
): Promise<ChunkStream> {
  const payload = {
    ...params,
    stream: true,
    stream_options: { include_usage: true },
  };

  // OpenAI SDK supports passing AbortSignal via request options.
  // Call the bound method directly to preserve `this` context across providers.
  return client.chat.completions.create(payload, signal ? { signal } : undefined) as Promise<ChunkStream>;
}

/**
 * Eagerly reads the first chunk of a stream to verify it is live before
 * wiring up mid-stream recovery. Returns an equivalent iterable that
 * re-yields the consumed chunk so callers see an unmodified sequence.
 *
 * An immediately-done iterator (server closed before sending anything)
 * is surfaced as an empty iterable rather than silently blocking callers.
 */
async function primeStream(stream: ChunkStream): Promise<ChunkStream> {
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    return (async function* emptyStream(): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {})();
  }
  return (async function* prependFirstChunk(): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
    yield first.value;
    while (true) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  })();
}

/**
 * Attempts to open an LMX WebSocket stream for the given request parameters.
 *
 * Returns `null` when the active provider is not LMX or no config is available,
 * allowing the caller to fall back to the SSE path without special-casing.
 * Caches the resolved host and WebSocket URL on `transport` across retries
 * to avoid redundant endpoint-discovery round-trips.
 */
async function maybeCreateLmxWsStream(
  transport: StreamTransportOptions | undefined,
  params: Parameters<OpenAI['chat']['completions']['create']>[0]
): Promise<ChunkStream | null> {
  if (!transport?.config) return null;
  const providerName = transport.providerName ?? transport.config.provider.active;
  if (providerName !== 'lmx') return null;
  let endpointHost = transport.resolvedLmxHost;
  if (!endpointHost) {
    const discoveredEndpoint = await resolveLmxEndpoint(
      {
        host: transport.config.connection.host,
        fallbackHosts: transport.config.connection.fallbackHosts,
        port: transport.config.connection.port,
        adminKey: transport.config.connection.adminKey,
      },
      { timeoutMs: 1_500 }
    );
    endpointHost = discoveredEndpoint.host;
    transport.resolvedLmxHost = endpointHost;
    if (discoveredEndpoint.wsUrl) {
      transport.resolvedLmxWsUrl = discoveredEndpoint.wsUrl;
    }
  }
  const { port, adminKey } = transport.config.connection;
  return streamLmxChatWebSocket(
    endpointHost,
    port,
    {
      model: params.model,
      messages: params.messages ?? [],
      temperature: params.temperature,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      stop: params.stop,
      tools: params.tools,
      tool_choice: params.tool_choice,
      response_format: params.response_format,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
    },
    {
      adminKey,
      signal: transport.signal,
      wsUrl: transport.resolvedLmxWsUrl,
    }
  );
}

/**
 * Tracks which portions of a partially-emitted response have already been
 * yielded to the caller, so that chunks received after a mid-stream reconnect
 * can be deduplicated before re-emission.
 */
interface RecoveryReplayState {
  /** Content text that has already been yielded; trimmed as matching chunks arrive. */
  remainingContentPrefix: string;
  /** Per tool-call-index argument prefix that has already been yielded. */
  remainingToolCallArgPrefixes: Map<number, string>;
}

/**
 * Removes the already-emitted prefix from a recovered content fragment.
 * Mutates `state.remainingContentPrefix` as matching bytes are consumed.
 * When the recovered stream diverges from the emitted prefix, trimming stops
 * and subsequent chunks are passed through unchanged.
 */
function trimRecoveredContentPrefix(contentFragment: string, state: RecoveryReplayState): string {
  if (!contentFragment || !state.remainingContentPrefix) return contentFragment;
  if (state.remainingContentPrefix.startsWith(contentFragment)) {
    state.remainingContentPrefix = state.remainingContentPrefix.slice(contentFragment.length);
    return '';
  }
  if (contentFragment.startsWith(state.remainingContentPrefix)) {
    const dedupedFragment = contentFragment.slice(state.remainingContentPrefix.length);
    state.remainingContentPrefix = '';
    return dedupedFragment;
  }
  // Diverged output: stop prefix trimming and pass the fragment through as-is.
  state.remainingContentPrefix = '';
  return contentFragment;
}

/**
 * Removes the already-emitted argument prefix for the tool call at `index`.
 * Mirrors {@link trimRecoveredContentPrefix} but operates on per-index Maps.
 * Mutates `state.remainingToolCallArgPrefixes` as matching bytes are consumed.
 */
function trimRecoveredToolCallArgsPrefix(
  index: number,
  argsFragment: string,
  state: RecoveryReplayState
): string {
  if (!argsFragment) return argsFragment;
  const emittedArgPrefix = state.remainingToolCallArgPrefixes.get(index);
  if (!emittedArgPrefix) return argsFragment;

  if (emittedArgPrefix.startsWith(argsFragment)) {
    const remainder = emittedArgPrefix.slice(argsFragment.length);
    if (remainder.length > 0) {
      state.remainingToolCallArgPrefixes.set(index, remainder);
    } else {
      state.remainingToolCallArgPrefixes.delete(index);
    }
    return '';
  }
  if (argsFragment.startsWith(emittedArgPrefix)) {
    state.remainingToolCallArgPrefixes.delete(index);
    return argsFragment.slice(emittedArgPrefix.length);
  }
  // Diverged output for this tool call index: stop prefix trimming and pass through.
  state.remainingToolCallArgPrefixes.delete(index);
  return argsFragment;
}

/**
 * Strips already-emitted content and tool-call argument prefixes from a chunk
 * received after a mid-stream reconnect, preventing duplicate output.
 *
 * Returns `null` when the entire chunk was already emitted (i.e. it carries
 * no new content, no new tool-call args, no finish reason, and no usage data).
 * Returns the original `chunk` reference when no deduplication was needed.
 */
function dedupeRecoveredChunk(
  chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
  state: RecoveryReplayState
): OpenAI.Chat.Completions.ChatCompletionChunk | null {
  // Fast path: nothing left to deduplicate.
  if (!state.remainingContentPrefix && state.remainingToolCallArgPrefixes.size === 0) return chunk;

  const choice = chunk.choices[0];
  const delta = choice?.delta;
  if (!delta) return chunk;

  let contentChanged = false;
  let dedupedContent = delta.content;
  if (typeof delta.content === 'string' && state.remainingContentPrefix) {
    const trimmed = trimRecoveredContentPrefix(delta.content, state);
    if (trimmed !== delta.content) {
      dedupedContent = trimmed;
      contentChanged = true;
    }
  }

  let toolCallsChanged = false;
  let dedupedToolCalls = delta.tool_calls;
  if (
    Array.isArray(delta.tool_calls) &&
    delta.tool_calls.length > 0 &&
    state.remainingToolCallArgPrefixes.size > 0
  ) {
    const survivingToolCalls: typeof delta.tool_calls = [];
    for (const toolCall of delta.tool_calls) {
      const rawArgsFragment = toolCall.function?.arguments;
      let dedupedToolCall = toolCall;

      if (typeof rawArgsFragment === 'string' && rawArgsFragment.length > 0) {
        const idx = toolCall.index ?? 0;
        const trimmedArgs = trimRecoveredToolCallArgsPrefix(idx, rawArgsFragment, state);
        if (trimmedArgs !== rawArgsFragment) {
          toolCallsChanged = true;
          dedupedToolCall = {
            ...toolCall,
            function: { ...toolCall.function, arguments: trimmedArgs },
          };
        }
      }

      // Drop tool-call deltas that carry nothing useful after deduplication.
      const isNoop =
        !dedupedToolCall.id &&
        !dedupedToolCall.type &&
        !dedupedToolCall.function?.name &&
        !dedupedToolCall.function?.arguments;
      if (isNoop) {
        toolCallsChanged = true;
        continue;
      }
      survivingToolCalls.push(dedupedToolCall);
    }

    if (toolCallsChanged || survivingToolCalls.length !== delta.tool_calls.length) {
      dedupedToolCalls = survivingToolCalls;
      toolCallsChanged = true;
    }
  }

  if (!contentChanged && !toolCallsChanged) return chunk;

  // If the entire delta is now empty and the chunk carries no terminal signal,
  // suppress it entirely to avoid yielding zero-content chunks.
  const hasOtherDeltaFields = Object.entries(delta).some(
    ([key, value]) =>
      key !== 'content' &&
      key !== 'tool_calls' &&
      value !== undefined &&
      value !== null &&
      (!Array.isArray(value) || value.length > 0)
  );
  const hasContent = typeof dedupedContent === 'string' && dedupedContent.length > 0;
  const hasToolCalls = Array.isArray(dedupedToolCalls) && dedupedToolCalls.length > 0;
  if (!hasContent && !hasToolCalls && !hasOtherDeltaFields && choice.finish_reason === null && !chunk.usage) {
    return null;
  }

  const choices = [...chunk.choices];
  choices[0] = {
    ...choice,
    delta: {
      ...delta,
      ...(contentChanged ? { content: dedupedContent } : {}),
      ...(toolCallsChanged ? { tool_calls: dedupedToolCalls } : {}),
    },
  };
  return { ...chunk, choices };
}

/**
 * Wraps a stream with automatic mid-stream reconnect logic for LMX connections.
 *
 * When a transient error interrupts the active stream, this generator:
 * 1. Attempts up to `retryConfig.maxRetries` WebSocket reconnects with backoff.
 * 2. Falls back to SSE via the OpenAI SDK if all WebSocket attempts fail.
 * 3. Deduplicates chunks on the recovered stream so the caller never sees
 *    content that was already yielded before the disconnect.
 *
 * AbortErrors and non-retryable errors propagate immediately without recovery.
 */
function withLmxMidStreamRecovery(
  initialStream: ChunkStream,
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  retryConfig: RetryConfig,
  onStatus:
    | ((status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => void)
    | undefined,
  transport: StreamTransportOptions | undefined
): ChunkStream {
  return (async function* recoverableStream(): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
    let currentStream = initialStream;
    let emittedText = '';
    const emittedToolCallArgsByIndex = new Map<number, string>();
    const replayState: RecoveryReplayState = {
      remainingContentPrefix: '',
      remainingToolCallArgPrefixes: new Map<number, string>(),
    };
    let reconnectAttempts = 0;
    const maxReconnectCycles = Math.max(1, retryConfig.maxRetries + 1);

    while (true) {
      try {
        for await (const rawChunk of currentStream) {
          const chunk = dedupeRecoveredChunk(rawChunk, replayState);
          if (!chunk) continue;

          const delta = chunk.choices[0]?.delta;
          if (typeof delta?.content === 'string' && delta.content.length > 0) {
            emittedText += delta.content;
          }
          if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
            for (const toolCall of delta.tool_calls) {
              const argsFragment = toolCall.function?.arguments;
              if (typeof argsFragment !== 'string' || argsFragment.length === 0) continue;
              const idx = toolCall.index ?? 0;
              emittedToolCallArgsByIndex.set(
                idx,
                (emittedToolCallArgsByIndex.get(idx) ?? '') + argsFragment
              );
            }
          }
          yield chunk;
        }
        return;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (!isRetryableError(err)) throw err;
        if (reconnectAttempts >= maxReconnectCycles) {
          onStatus?.('disconnected');
          throw err;
        }

        reconnectAttempts += 1;
        let recoveredStream: ChunkStream | null = null;
        let lastWsError: unknown = err;
        const maxWsReconnects = Math.max(0, retryConfig.maxRetries);

        for (let attempt = 1; attempt <= maxWsReconnects; attempt += 1) {
          onStatus?.('reconnecting', attempt);
          const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
          debug(`LMX mid-stream recovery attempt ${attempt}/${maxWsReconnects} after ${delay}ms`);
          await sleep(delay);

          if (transport) transport.resolvedLmxHost = undefined;

          try {
            const wsStream = await maybeCreateLmxWsStream(transport, params);
            if (!wsStream) break;
            recoveredStream = await primeStream(wsStream);
            onStatus?.('connected');
            break;
          } catch (wsErr) {
            if (isAbortError(wsErr)) throw wsErr;
            lastWsError = wsErr;
            if (!isRetryableError(wsErr)) break;
          }
        }

        if (!recoveredStream) {
          if (maxWsReconnects === 0) {
            onStatus?.('reconnecting', 1);
          }
          debug(`LMX WebSocket mid-stream recovery falling back to SSE: ${errorMessage(lastWsError)}`);
          if (transport) transport.resolvedLmxHost = undefined;
          try {
            recoveredStream = await createSdkStream(client, params, transport?.signal);
          } catch (sseErr) {
            onStatus?.('disconnected');
            throw sseErr;
          }
          onStatus?.('connected');
        }

        replayState.remainingContentPrefix = emittedText;
        replayState.remainingToolCallArgPrefixes = new Map<number, string>(emittedToolCallArgsByIndex);
        currentStream = recoveredStream;
      }
    }
  })();
}

export async function createStreamWithRetry(
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  retryConfig: RetryConfig,
  onStatus?: (
    status: 'checking' | 'connected' | 'disconnected' | 'reconnecting',
    attempt?: number
  ) => void,
  transport?: StreamTransportOptions
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  let lastError: unknown;
  // `isLmxProvider`: routing through Opta-LMX regardless of whether WS or SSE is used.
  // `shouldTryLmxWs`: only true when WS has not been established as unavailable this session.
  const isLmxProvider = Boolean(
    transport?.config &&
      (transport.providerName ?? transport.config.provider.active) === 'lmx'
  );
  const shouldTryLmxWs = isLmxProvider && !transport?.lmxWsUnavailable;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        onStatus?.('reconnecting', attempt);
        const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
        debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await sleep(delay);
      }

      // Preferred path for LMX: bidirectional WebSocket stream with server-side cancel.
      // `shouldTryLmxWs` is false once WS has been established as unavailable for this
      // session, so subsequent turns go straight to SSE without exhausting retries.
      let stream: ChunkStream | null = null;
      if (shouldTryLmxWs) {
        try {
          stream = await maybeCreateLmxWsStream(transport, params);
          if (stream) {
            stream = await primeStream(stream);
          }
        } catch (err) {
          if (isAbortError(err)) throw err;
          if (transport) transport.resolvedLmxHost = undefined;
          if (isRetryableError(err) && attempt < retryConfig.maxRetries) {
            throw err;
          }
          debug(`LMX WebSocket stream unavailable, falling back to SSE: ${errorMessage(err)}`);
          stream = null;
        }
      }
      if (!stream) {
        // WS was attempted and failed (or was already known unavailable) — mark it so
        // subsequent turns in this session skip WS entirely.
        if (shouldTryLmxWs && transport) {
          transport.lmxWsUnavailable = true;
        }
        stream = await createSdkStream(client, params, transport?.signal);
      }

      if (attempt > 0) {
        onStatus?.('connected');
      }

      // Mid-stream recovery applies to all LMX streams, including SSE fallback.
      // Keyed on `isLmxProvider` (not `shouldTryLmxWs`) so recovery stays active
      // even when `lmxWsUnavailable` is true and the SSE path is in use.
      if (isLmxProvider) {
        return withLmxMidStreamRecovery(stream, client, params, retryConfig, onStatus, transport);
      }
      return stream;
    } catch (err) {
      if (isAbortError(err)) throw err;
      lastError = err;
      if (!isRetryableError(err) || attempt === retryConfig.maxRetries) {
        if (attempt > 0) onStatus?.('disconnected');
        throw err;
      }
    }
  }

  throw lastError;
}

// --- Stream Collector ---

/**
 * Iterates a streaming chat completion, dispatching content to the caller
 * via `onVisibleText` and accumulating the full response for return.
 *
 * @param stream - The chunk iterable produced by {@link createStreamWithRetry}.
 * @param onVisibleText - Called with each non-thinking content fragment as it arrives.
 * @param statusBar - Optional status bar to update with token-rate telemetry.
 * @param onStream - Optional TUI streaming callbacks (onToken, onThinking).
 * @returns Accumulated text (think-tags stripped), tool calls, usage, and finish reason.
 */
export async function collectStream(
  stream: ChunkStream,
  onVisibleText: (chunk: string) => void,
  statusBar?: StatusBar | null,
  onStream?: OnStreamCallbacks
): Promise<{
  text: string;
  toolCalls: ToolCallAccum[];
  thinkingRenderer: ThinkingRenderer;
  usage: StreamUsage | null;
  finishReason: string | null;
}> {
  let text = '';
  const toolCallMap = new Map<number, ToolCallAccum>();
  const thinkingRenderer = new ThinkingRenderer();
  let usage: StreamUsage | null = null;
  let finishReason: string | null = null;

  for await (const chunk of stream) {
    // Usage is reported on the final chunk when stream_options.include_usage is true.
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
      };
    }

    // finish_reason signals truncation ('length') or tool dispatch ('tool_calls').
    const choiceFinishReason = chunk.choices[0]?.finish_reason;
    if (choiceFinishReason) {
      finishReason = choiceFinishReason;
    }

    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content && delta.content.length > 0) {
      const safeDelta = sanitizeTerminalText(delta.content);
      text += safeDelta;
      statusBar?.markStart();

      // ThinkingRenderer filters <think> blocks and returns only visible content.
      const visible = thinkingRenderer.process(safeDelta);
      if (visible) {
        onVisibleText(visible);
        onStream?.onToken?.(visible);
      }

      // Forward raw thinking content to the TUI thinking panel when inside a <think> block.
      if (!visible && thinkingRenderer.isThinking) {
        onStream?.onThinking?.(safeDelta);
      }

      statusBar?.update(estimateTokens(safeDelta));
    }

    // Accumulate tool-call deltas streamed across multiple chunks into complete calls.
    if (delta.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const idx = toolCallDelta.index ?? 0;
        const existing = toolCallMap.get(idx);
        if (!existing) {
          toolCallMap.set(idx, {
            id: toolCallDelta.id ?? '',
            name: toolCallDelta.function?.name ?? '',
            args: toolCallDelta.function?.arguments ?? '',
          });
        } else {
          if (toolCallDelta.id) existing.id = toolCallDelta.id;
          if (toolCallDelta.function?.name) existing.name = toolCallDelta.function.name;
          if (toolCallDelta.function?.arguments) existing.args += toolCallDelta.function.arguments;
        }
      }
    }
  }

  // Flush any content still buffered inside the thinking renderer (e.g. unclosed <think>).
  const remainingVisible = thinkingRenderer.flush();
  if (remainingVisible) {
    onVisibleText(remainingVisible);
    onStream?.onToken?.(remainingVisible);
  }

  // Remove <think> tags from the full text before storing in message history.
  text = stripThinkTags(text);

  return {
    text,
    toolCalls: [...toolCallMap.values()],
    thinkingRenderer,
    usage,
    finishReason,
  };
}
