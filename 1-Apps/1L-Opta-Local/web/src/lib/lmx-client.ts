/**
 * Opta LMX API Client
 *
 * Typed HTTP client for the Opta LMX server using native fetch.
 * Supports all core endpoints: status, models, chat (streaming + non-streaming),
 * model load/unload, and health check.
 */

import type {
  ServerStatus,
  LoadedModel,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelLoadRequest,
  ModelsResponse,
} from '@/types/lmx';
import { LMXError } from '@/types/lmx';

export class LMXClient {
  private readonly baseUrl: string;
  private readonly adminKey: string;

  constructor(baseUrl: string, adminKey: string) {
    // Strip trailing slash for consistent URL building
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.adminKey = adminKey;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.adminKey) {
      h['X-Admin-Key'] = this.adminKey;
    }
    return h;
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new LMXError(
        `LMX API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    return response.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // Admin endpoints
  // ---------------------------------------------------------------------------

  /** GET /admin/status -- Server health snapshot */
  async getStatus(): Promise<ServerStatus> {
    return this.request<ServerStatus>('/admin/status');
  }

  /** POST /admin/models/load -- Load a model into VRAM */
  async loadModel(req: ModelLoadRequest): Promise<LoadedModel> {
    return this.request<LoadedModel>('/admin/models/load', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /admin/models/unload -- Unload a model from VRAM */
  async unloadModel(modelId: string): Promise<void> {
    await this.request<unknown>('/admin/models/unload', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
  }

  /** GET /admin/status -- Returns true if server is reachable, false otherwise */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getStatus();
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // OpenAI-compatible endpoints
  // ---------------------------------------------------------------------------

  /** GET /v1/models -- List loaded models */
  async getModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('/v1/models');
  }

  /** POST /v1/chat/completions -- Non-streaming chat completion */
  async chatCompletion(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...req, stream: false }),
    });
  }

  /**
   * POST /v1/chat/completions (stream: true) -- Streaming chat completion.
   *
   * Uses async generator with ReadableStream (not EventSource) to support
   * custom headers (X-Admin-Key). Yields content delta strings.
   * Handles SSE `data: {...}` lines and the `[DONE]` sentinel.
   */
  async *streamChat(
    model: string,
    messages: ChatCompletionRequest['messages'],
    options?: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
    },
  ): AsyncGenerator<string, void, undefined> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...options,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new LMXError(
        `LMX streaming error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    if (!response.body) {
      throw new LMXError('Response body is null', 0, 'No readable stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from buffer
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and SSE comments
          if (!trimmed || trimmed.startsWith(':')) continue;

          // SSE data lines
          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();

            // Handle [DONE] sentinel
            if (data === '[DONE]') return;

            try {
              const chunk = JSON.parse(data) as ChatCompletionChunk;
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip malformed JSON lines (e.g., partial data)
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          if (data !== '[DONE]') {
            try {
              const chunk = JSON.parse(data) as ChatCompletionChunk;
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
