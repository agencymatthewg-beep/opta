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
  SessionListResponse,
  SessionFull,
  ResponsesCreateRequest,
  ResponsesCreateResponse,
  MessagesCreateRequest,
  MessagesCreateResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
  RerankRequest,
  RerankResponse,
  AdminMemoryResponse,
  AdminDiagnosticsResponse,
} from '@/types/lmx';
import { LMXError } from '@/types/lmx';
import type {
  RagIngestRequest,
  RagIngestResponse,
  RagQueryRequest,
  RagQueryResponse,
  RagContextRequest,
  RagContextResponse,
  RagCollectionsResponse,
} from '@/types/rag';
import type {
  AgentRunCreateRequest,
  AgentRun,
  AgentRunListResponse,
  AgentRunListOptions,
  AgentRunEvent,
} from '@/types/agents';
import type {
  SkillsListResponse,
  SkillDefinition,
  SkillExecuteRequest,
  SkillExecuteResponse,
  SkillsMcpListResponse,
  SkillsMcpReadRequest,
  SkillsMcpReadResponse,
  SkillsMcpCallRequest,
  SkillsMcpCallResponse,
} from '@/types/skills';

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

  /** GET /admin/memory -- Runtime memory breakdown */
  async getMemory(): Promise<AdminMemoryResponse> {
    return this.request<AdminMemoryResponse>('/admin/memory');
  }

  /** GET /admin/diagnostics -- Deep diagnostics report */
  async getDiagnostics(): Promise<AdminDiagnosticsResponse> {
    return this.request<AdminDiagnosticsResponse>('/admin/diagnostics');
  }

  // ---------------------------------------------------------------------------
  // Session endpoints (CLI sessions served by LMX)
  // ---------------------------------------------------------------------------

  /** GET /admin/sessions -- List session summaries with pagination and filters */
  async getSessions(options?: {
    limit?: number;
    offset?: number;
    model?: string;
    tag?: string;
    since?: string;
  }): Promise<SessionListResponse> {
    const params = new URLSearchParams();
    if (options?.limit != null) params.set('limit', String(options.limit));
    if (options?.offset != null) params.set('offset', String(options.offset));
    if (options?.model) params.set('model', options.model);
    if (options?.tag) params.set('tag', options.tag);
    if (options?.since) params.set('since', options.since);
    const qs = params.toString();
    return this.request<SessionListResponse>(
      `/admin/sessions${qs ? `?${qs}` : ''}`,
    );
  }

  /** GET /admin/sessions/:id -- Get full session with all messages */
  async getSession(sessionId: string): Promise<SessionFull> {
    return this.request<SessionFull>(`/admin/sessions/${sessionId}`);
  }

  /** DELETE /admin/sessions/:id -- Delete a session */
  async deleteSession(sessionId: string): Promise<void> {
    await this.request<unknown>(`/admin/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // ---------------------------------------------------------------------------
  // OpenAI-compatible endpoints
  // ---------------------------------------------------------------------------

  /** GET /v1/models -- List loaded models */
  async getModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('/v1/models');
  }

  /** GET /v1/models/:id -- Get model metadata */
  async getModelById(modelId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/v1/models/${encodeURIComponent(modelId)}`,
    );
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

  /** POST /v1/responses -- Unified response API */
  async createResponse(
    req: ResponsesCreateRequest,
  ): Promise<ResponsesCreateResponse> {
    return this.request<ResponsesCreateResponse>('/v1/responses', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/messages -- Message-style API */
  async createMessage(
    req: MessagesCreateRequest,
  ): Promise<MessagesCreateResponse> {
    return this.request<MessagesCreateResponse>('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/embeddings -- Embedding vectors */
  async createEmbeddings(
    req: EmbeddingsRequest,
  ): Promise<EmbeddingsResponse> {
    return this.request<EmbeddingsResponse>('/v1/embeddings', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/rerank -- Relevance reranking */
  async rerank(req: RerankRequest): Promise<RerankResponse> {
    return this.request<RerankResponse>('/v1/rerank', {
      method: 'POST',
      body: JSON.stringify(req),
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
      signal?: AbortSignal;
    },
  ): AsyncGenerator<string, void, undefined> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      signal: options?.signal,
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

  // ---------------------------------------------------------------------------
  // Agent runs endpoints
  // ---------------------------------------------------------------------------

  /** POST /v1/agents/runs -- Create a new agent run */
  async createAgentRun(req: AgentRunCreateRequest): Promise<AgentRun> {
    return this.request<AgentRun>('/v1/agents/runs', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** GET /v1/agents/runs -- List agent runs */
  async listAgentRuns(options?: AgentRunListOptions): Promise<AgentRunListResponse> {
    const params = new URLSearchParams();
    if (options?.limit != null) params.set('limit', String(options.limit));
    if (options?.offset != null) params.set('offset', String(options.offset));
    if (options?.status) params.set('status', options.status);
    const qs = params.toString();
    return this.request<AgentRunListResponse>(
      `/v1/agents/runs${qs ? `?${qs}` : ''}`,
    );
  }

  /** GET /v1/agents/runs/:id -- Get run details */
  async getAgentRun(runId: string): Promise<AgentRun> {
    return this.request<AgentRun>(
      `/v1/agents/runs/${encodeURIComponent(runId)}`,
    );
  }

  /** POST /v1/agents/runs/:id/cancel -- Cancel a running job */
  async cancelAgentRun(runId: string): Promise<AgentRun> {
    return this.request<AgentRun>(
      `/v1/agents/runs/${encodeURIComponent(runId)}/cancel`,
      { method: 'POST' },
    );
  }

  /**
   * GET /v1/agents/runs/:id/events -- Stream run events as SSE payloads.
   *
   * Returns parsed JSON event bodies. Non-JSON event payloads are ignored.
   */
  async *streamAgentRunEvents(
    runId: string,
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<AgentRunEvent, void, undefined> {
    const url = `${this.baseUrl}/v1/agents/runs/${encodeURIComponent(runId)}/events`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: options?.signal,
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
    let pendingEvent: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('event:')) {
            pendingEvent = trimmed.slice(6).trim();
            continue;
          }

          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as AgentRunEvent;
            yield pendingEvent
              ? { ...parsed, event: parsed.event ?? pendingEvent }
              : parsed;
          } catch {
            // Ignore malformed chunks and continue stream consumption.
          } finally {
            pendingEvent = undefined;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ---------------------------------------------------------------------------
  // Skills endpoints
  // ---------------------------------------------------------------------------

  /** GET /v1/skills -- List registered skills */
  async listSkills(): Promise<SkillsListResponse> {
    return this.request<SkillsListResponse>('/v1/skills');
  }

  /** GET /v1/skills/:id -- Get a skill definition */
  async getSkill(skillId: string): Promise<SkillDefinition> {
    return this.request<SkillDefinition>(
      `/v1/skills/${encodeURIComponent(skillId)}`,
    );
  }

  /** POST /v1/skills/:id/execute -- Execute a skill */
  async executeSkill(
    skillId: string,
    req: SkillExecuteRequest,
  ): Promise<SkillExecuteResponse> {
    return this.request<SkillExecuteResponse>(
      `/v1/skills/${encodeURIComponent(skillId)}/execute`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
    );
  }

  /** GET /v1/skills/mcp/resources -- MCP list basics */
  async skillsMcpList(): Promise<SkillsMcpListResponse> {
    return this.request<SkillsMcpListResponse>('/v1/skills/mcp/resources');
  }

  /** POST /mcp/resources/read -- MCP read basics */
  async skillsMcpRead(
    req: SkillsMcpReadRequest,
  ): Promise<SkillsMcpReadResponse> {
    return this.request<SkillsMcpReadResponse>('/mcp/resources/read', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/skills/mcp/call -- MCP call basics */
  async skillsMcpCall(
    req: SkillsMcpCallRequest,
  ): Promise<SkillsMcpCallResponse> {
    return this.request<SkillsMcpCallResponse>('/v1/skills/mcp/call', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // ---------------------------------------------------------------------------
  // RAG endpoints
  // ---------------------------------------------------------------------------

  /** POST /v1/rag/ingest -- Ingest documents into a RAG collection */
  async ragIngest(req: RagIngestRequest): Promise<RagIngestResponse> {
    return this.request<RagIngestResponse>('/v1/rag/ingest', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/rag/query -- Query a RAG collection for relevant context */
  async ragQuery(req: RagQueryRequest): Promise<RagQueryResponse> {
    return this.request<RagQueryResponse>('/v1/rag/query', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/rag/context -- Assemble context from multiple collections */
  async ragContext(req: RagContextRequest): Promise<RagContextResponse> {
    return this.request<RagContextResponse>('/v1/rag/context', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /** GET /v1/rag/collections -- List all RAG collections and stats */
  async ragListCollections(): Promise<RagCollectionsResponse> {
    return this.request<RagCollectionsResponse>('/v1/rag/collections');
  }

  /** DELETE /v1/rag/collections/:name -- Delete a RAG collection */
  async ragDeleteCollection(collection: string): Promise<void> {
    await this.request<unknown>(
      `/v1/rag/collections/${encodeURIComponent(collection)}`,
      { method: 'DELETE' },
    );
  }
}
