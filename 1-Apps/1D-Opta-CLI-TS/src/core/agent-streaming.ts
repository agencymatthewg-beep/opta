/**
 * agent-streaming.ts — Stream collection + retry logic.
 *
 * Extracted from agent.ts to isolate the streaming response collection,
 * retry-with-backoff for transient errors, and tool call accumulation.
 */

import type OpenAI from 'openai';
import { debug } from './debug.js';
import { estimateTokens } from '../utils/tokens.js';
import { ThinkingRenderer, stripThinkTags } from '../ui/thinking.js';
import type { StatusBar } from '../ui/statusbar.js';
import type { OnStreamCallbacks } from './agent.js';

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
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('etimedout') ||
        msg.includes('fetch failed') || msg.includes('network') || msg.includes('socket hang up')) {
      return true;
    }
  }
  // OpenAI SDK wraps HTTP errors with a status property
  const status = (err as { status?: number }).status;
  if (status && status >= 500) return true;
  return false;
}

export async function createStreamWithRetry(
  client: OpenAI,
  params: Parameters<OpenAI['chat']['completions']['create']>[0],
  retryConfig: { maxRetries: number; backoffMs: number; backoffMultiplier: number },
  onStatus?: (status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => void,
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        onStatus?.('reconnecting', attempt);
        const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
        debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const stream = await client.chat.completions.create({
        ...params,
        stream: true,
        stream_options: { include_usage: true },
      });

      if (attempt > 0) {
        onStatus?.('connected');
      }

      return stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
    } catch (err) {
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
): Promise<{ text: string; toolCalls: ToolCallAccum[]; thinkingRenderer: ThinkingRenderer; usage: StreamUsage | null }> {
  let text = '';
  const toolCallMap = new Map<number, ToolCallAccum>();
  const thinking = new ThinkingRenderer();
  let usage: StreamUsage | null = null;

  for await (const chunk of stream) {
    // Capture usage from the final chunk (sent when stream_options.include_usage is true)
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
      };
    }

    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      text += delta.content;
      statusBar?.markStart();

      // ThinkingRenderer handles <think> display and returns non-thinking content
      const visible = thinking.process(delta.content);
      if (visible) {
        onVisibleText(visible);
        // Emit token event for TUI streaming
        onStream?.onToken?.(visible);
      }

      // Emit thinking content if we're still in thinking mode
      if (!visible && thinking.isThinking) {
        onStream?.onThinking?.(delta.content);
      }

      // Update status bar with token estimate
      const tokenDelta = estimateTokens(delta.content);
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
  };
}
