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

// --- Streaming Retry ---

/** Retryable errors: network failures, timeouts, 5xx server errors. */
function isRetryableError(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('lmx websocket stream closed unexpectedly') ||
      msg.includes('lmx websocket handshake timed out') ||
      msg.includes('lmx websocket idle timeout')
    ) {
      return true;
    }
    if (
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('socket hang up') ||
      msg.includes('premature close') ||
      msg.includes('other side closed')
    ) {
      return true;
    }
  }
  // OpenAI SDK wraps HTTP errors with a status property
  const status = (err as { status?: number }).status;
  if (status && status >= 500) return true;
  return false;
}

interface StreamTransportOptions {
  config?: OptaConfig;
  /** Runtime provider identifier (e.g. lmx, anthropic, lmx+fallback). */
  providerName?: string;
  signal?: AbortSignal;
  /** Resolved LMX host cached across retries within a turn. */
  resolvedLmxHost?: string;
  /** Canonical WebSocket URL from server discovery, cached across retries. */
  resolvedLmxWsUrl?: string;
}

type RetryConfig = { maxRetries: number; backoffMs: number; backoffMultiplier: number };

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function createSdkStream(
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  signal?: AbortSignal
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const payload = {
    ...params,
    stream: true,
    stream_options: { include_usage: true },
  };

  // OpenAI SDK supports passing AbortSignal via request options.
  // Call the bound method directly to preserve `this` context across providers.
  return client.chat.completions.create(payload, signal ? { signal } : undefined) as Promise<
    AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  >;
}

async function primeStream(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    return (async function* (): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {})();
  }
  return (async function* (): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
    yield first.value;
    while (true) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  })();
}

async function maybeCreateLmxWsStream(
  transport: StreamTransportOptions | undefined,
  params: Parameters<OpenAI['chat']['completions']['create']>[0]
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null> {
  if (!transport?.config) return null;
  const providerName = transport.providerName ?? transport.config.provider.active;
  if (providerName !== 'lmx') return null;
  let endpointHost = transport.resolvedLmxHost;
  if (!endpointHost) {
    const endpoint = await resolveLmxEndpoint(
      {
        host: transport.config.connection.host,
        fallbackHosts: transport.config.connection.fallbackHosts,
        port: transport.config.connection.port,
        adminKey: transport.config.connection.adminKey,
      },
      {
        timeoutMs: 1_500,
      }
    );
    endpointHost = endpoint.host;
    transport.resolvedLmxHost = endpointHost;
    if (endpoint.wsUrl) {
      transport.resolvedLmxWsUrl = endpoint.wsUrl;
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

interface RecoveryReplayState {
  remainingContentPrefix: string;
  remainingToolCallArgPrefixes: Map<number, string>;
}

function trimRecoveredContentPrefix(content: string, state: RecoveryReplayState): string {
  if (!content || !state.remainingContentPrefix) return content;
  if (state.remainingContentPrefix.startsWith(content)) {
    state.remainingContentPrefix = state.remainingContentPrefix.slice(content.length);
    return '';
  }
  if (content.startsWith(state.remainingContentPrefix)) {
    const trimmed = content.slice(state.remainingContentPrefix.length);
    state.remainingContentPrefix = '';
    return trimmed;
  }
  // Diverged output: stop prefix trimming and continue with recovered stream as-is.
  state.remainingContentPrefix = '';
  return content;
}

function trimRecoveredToolCallArgsPrefix(
  index: number,
  args: string,
  state: RecoveryReplayState
): string {
  if (!args) return args;
  const remainingPrefix = state.remainingToolCallArgPrefixes.get(index);
  if (!remainingPrefix) return args;

  if (remainingPrefix.startsWith(args)) {
    const nextRemainingPrefix = remainingPrefix.slice(args.length);
    if (nextRemainingPrefix.length > 0) {
      state.remainingToolCallArgPrefixes.set(index, nextRemainingPrefix);
    } else {
      state.remainingToolCallArgPrefixes.delete(index);
    }
    return '';
  }
  if (args.startsWith(remainingPrefix)) {
    state.remainingToolCallArgPrefixes.delete(index);
    return args.slice(remainingPrefix.length);
  }
  // Diverged output for this tool call index: stop prefix trimming and continue as-is.
  state.remainingToolCallArgPrefixes.delete(index);
  return args;
}

function dedupeRecoveredChunk(
  chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
  state: RecoveryReplayState
): OpenAI.Chat.Completions.ChatCompletionChunk | null {
  if (!state.remainingContentPrefix && state.remainingToolCallArgPrefixes.size === 0) return chunk;
  const choice = chunk.choices[0];
  const delta = choice?.delta;
  if (!delta) return chunk;

  let contentChanged = false;
  let nextContent = delta.content;
  if (typeof delta.content === 'string' && state.remainingContentPrefix) {
    const trimmed = trimRecoveredContentPrefix(delta.content, state);
    if (trimmed !== delta.content) {
      nextContent = trimmed;
      contentChanged = true;
    }
  }

  let toolCallsChanged = false;
  let nextToolCalls = delta.tool_calls;
  if (
    Array.isArray(delta.tool_calls) &&
    delta.tool_calls.length > 0 &&
    state.remainingToolCallArgPrefixes.size > 0
  ) {
    const trimmedToolCalls: typeof delta.tool_calls = [];
    for (const toolCall of delta.tool_calls) {
      const argsFragment = toolCall.function?.arguments;
      let nextToolCall = toolCall;

      if (typeof argsFragment === 'string' && argsFragment.length > 0) {
        const idx = toolCall.index ?? 0;
        const trimmedArgsFragment = trimRecoveredToolCallArgsPrefix(idx, argsFragment, state);
        if (trimmedArgsFragment !== argsFragment) {
          toolCallsChanged = true;
          nextToolCall = {
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments: trimmedArgsFragment,
            },
          };
        }
      }

      const isNoopToolCall =
        !nextToolCall.id &&
        !nextToolCall.type &&
        !nextToolCall.function?.name &&
        !nextToolCall.function?.arguments;
      if (isNoopToolCall) {
        toolCallsChanged = true;
        continue;
      }
      trimmedToolCalls.push(nextToolCall);
    }

    if (toolCallsChanged || trimmedToolCalls.length !== delta.tool_calls.length) {
      nextToolCalls = trimmedToolCalls;
      toolCallsChanged = true;
    }
  }

  if (!contentChanged && !toolCallsChanged) return chunk;

  const hasOtherDeltaFields = Object.entries(delta).some(
    ([key, value]) =>
      key !== 'content' &&
      key !== 'tool_calls' &&
      value !== undefined &&
      value !== null &&
      (!Array.isArray(value) || value.length > 0)
  );
  const hasContent = typeof nextContent === 'string' && nextContent.length > 0;
  const hasToolCalls = Array.isArray(nextToolCalls) && nextToolCalls.length > 0;
  if (
    !hasContent &&
    !hasToolCalls &&
    !hasOtherDeltaFields &&
    choice.finish_reason === null &&
    !chunk.usage
  ) {
    return null;
  }

  const choices = [...chunk.choices];
  choices[0] = {
    ...choice,
    delta: {
      ...delta,
      ...(contentChanged ? { content: nextContent } : {}),
      ...(toolCallsChanged ? { tool_calls: nextToolCalls } : {}),
    },
  };
  return {
    ...chunk,
    choices,
  };
}

function withLmxMidStreamRecovery(
  initialStream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  retryConfig: RetryConfig,
  onStatus:
    | ((
        status: 'checking' | 'connected' | 'disconnected' | 'reconnecting',
        attempt?: number
      ) => void)
    | undefined,
  transport: StreamTransportOptions | undefined
): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
  return (async function* recoverableStream(): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
    let currentStream = initialStream;
    let emittedText = '';
    const emittedToolCallArgsByIndex = new Map<number, string>();
    const replayState: RecoveryReplayState = {
      remainingContentPrefix: '',
      remainingToolCallArgPrefixes: new Map<number, string>(),
    };
    let recoveryCycles = 0;
    const maxRecoveryCycles = Math.max(1, retryConfig.maxRetries + 1);

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
        if (recoveryCycles >= maxRecoveryCycles) {
          onStatus?.('disconnected');
          throw err;
        }

        recoveryCycles += 1;
        let recoveredStream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null =
          null;
        let reconnectError: unknown = err;
        const wsRecoveryAttempts = Math.max(0, retryConfig.maxRetries);

        for (let attempt = 1; attempt <= wsRecoveryAttempts; attempt += 1) {
          onStatus?.('reconnecting', attempt);
          const delay =
            retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
          debug(
            `LMX mid-stream recovery attempt ${attempt}/${wsRecoveryAttempts} after ${delay}ms`
          );
          await sleep(delay);

          if (transport) {
            transport.resolvedLmxHost = undefined;
          }

          try {
            const wsStream = await maybeCreateLmxWsStream(transport, params);
            if (!wsStream) break;
            recoveredStream = await primeStream(wsStream);
            onStatus?.('connected');
            break;
          } catch (reconnectErr) {
            if (isAbortError(reconnectErr)) throw reconnectErr;
            reconnectError = reconnectErr;
            if (!isRetryableError(reconnectErr)) break;
          }
        }

        if (!recoveredStream) {
          if (wsRecoveryAttempts === 0) {
            onStatus?.('reconnecting', 1);
          }
          debug(
            `LMX websocket mid-stream recovery falling back to SSE: ${describeError(reconnectError)}`
          );
          if (transport) {
            transport.resolvedLmxHost = undefined;
          }
          try {
            recoveredStream = await createSdkStream(client, params, transport?.signal);
          } catch (fallbackErr) {
            onStatus?.('disconnected');
            throw fallbackErr;
          }
          onStatus?.('connected');
        }

        replayState.remainingContentPrefix = emittedText;
        replayState.remainingToolCallArgPrefixes = new Map<number, string>(
          emittedToolCallArgsByIndex
        );
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
  const shouldTryLmxWs = Boolean(
    transport?.config && (transport.providerName ?? transport.config.provider.active) === 'lmx'
  );

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        onStatus?.('reconnecting', attempt);
        const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
        debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Preferred path for Opta LMX: bidirectional WebSocket stream with cancel.
      // If WS is unavailable, we transparently fall back to SDK/SSE.
      let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null = null;
      try {
        stream = await maybeCreateLmxWsStream(transport, params);
        if (stream) {
          stream = await primeStream(stream);
        }
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (shouldTryLmxWs && transport) {
          transport.resolvedLmxHost = undefined;
        }
        if (isRetryableError(err) && attempt < retryConfig.maxRetries) {
          throw err;
        }
        debug(`LMX websocket stream unavailable, falling back to SSE: ${describeError(err)}`);
        stream = null;
      }
      if (!stream) {
        stream = await createSdkStream(client, params, transport?.signal);
      }

      if (attempt > 0) {
        onStatus?.('connected');
      }

      // Apply mid-stream recovery for all LMX streams (WS and SSE fallback).
      // Without this, a "Premature close" during collectStream iteration escapes
      // the createStreamWithRetry retry loop entirely.
      if (shouldTryLmxWs) {
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

export async function collectStream(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
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
  const thinking = new ThinkingRenderer();
  let usage: StreamUsage | null = null;
  let finishReason: string | null = null;

  for await (const chunk of stream) {
    // Capture usage from the final chunk (sent when stream_options.include_usage is true)
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
      };
    }

    // Capture finish_reason from the final chunk (truncation detection)
    const choiceFinishReason = chunk.choices[0]?.finish_reason;
    if (choiceFinishReason) {
      finishReason = choiceFinishReason;
    }

    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      const safeDelta = sanitizeTerminalText(delta.content);
      text += safeDelta;
      statusBar?.markStart();

      // ThinkingRenderer handles <think> display and returns non-thinking content
      const visible = thinking.process(safeDelta);
      if (visible) {
        onVisibleText(visible);
        // Emit token event for TUI streaming
        onStream?.onToken?.(visible);
      }

      // Emit thinking content if we're still in thinking mode
      if (!visible && thinking.isThinking) {
        onStream?.onThinking?.(safeDelta);
      }

      // Update status bar with token estimate
      const tokenDelta = estimateTokens(safeDelta);
      statusBar?.update(tokenDelta);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const existing = toolCallMap.get(idx);
        if (!existing) {
          toolCallMap.set(idx, {
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            args: tc.function?.arguments ?? '',
          });
        } else {
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
        }
      }
    }
  }

  // Flush any remaining buffered text from thinking renderer
  const remaining = thinking.flush();
  if (remaining) {
    onVisibleText(remaining);
    onStream?.onToken?.(remaining);
  }

  // Strip <think> tags from the full collected text (for message history)
  text = stripThinkTags(text);

  return {
    text,
    toolCalls: [...toolCallMap.values()],
    thinkingRenderer: thinking,
    usage,
    finishReason,
  };
}
