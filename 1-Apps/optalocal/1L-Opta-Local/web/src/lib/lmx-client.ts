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
  MemoryDetail,
  AdminHealth,
  DiagnosticsReport,
  AdminLoadedModel,
  AvailableModel,
  ModelLoadResponse,
  DownloadProgress,
  ModelPerformanceConfig,
  CompatibilityRecord,
  MetricsJson,
  Preset,
  StackInfo,
  BenchmarkRequest,
  BenchmarkResult,
  QuantizeRequest,
  QuantizeJob,
  PredictorStats,
  HelperNodeStatus,
  LogFileMeta,
  SessionSearchRequest,
  AgentRun,
  AgentRunCreate,
  Skill,
  SkillMcpTool,
  SkillExecuteResult,
  EmbeddingsRequest,
  EmbeddingsResponse,
  RerankRequest,
  RerankResponse,
} from "@/types/lmx";
import { LMXError } from "@/types/lmx";
import type {
  RagIngestRequest,
  RagIngestResponse,
  RagQueryRequest,
  RagQueryResponse,
  RagContextRequest,
  RagContextResponse,
  RagCollectionsResponse,
} from "@/types/rag";

export class LMXClient {
  private readonly baseUrl: string;
  private readonly adminKey: string;

  constructor(baseUrl: string, adminKey: string) {
    // Strip trailing slash for consistent URL building
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.adminKey = adminKey;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.adminKey) {
      h["X-Admin-Key"] = this.adminKey;
    }
    return h;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
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
    return this.request<ServerStatus>("/admin/status");
  }

  /** POST /admin/models/load -- Load a model into VRAM */
  async loadModel(req: ModelLoadRequest): Promise<LoadedModel> {
    return this.request<LoadedModel>("/admin/models/load", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** POST /admin/models/unload -- Unload a model from VRAM */
  async unloadModel(modelId: string): Promise<void> {
    await this.request<unknown>("/admin/models/unload", {
      method: "POST",
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
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.offset != null) params.set("offset", String(options.offset));
    if (options?.model) params.set("model", options.model);
    if (options?.tag) params.set("tag", options.tag);
    if (options?.since) params.set("since", options.since);
    const qs = params.toString();
    return this.request<SessionListResponse>(
      `/admin/sessions${qs ? `?${qs}` : ""}`,
    );
  }

  /** GET /admin/sessions/:id -- Get full session with all messages */
  async getSession(sessionId: string): Promise<SessionFull> {
    return this.request<SessionFull>(`/admin/sessions/${sessionId}`);
  }

  /** DELETE /admin/sessions/:id -- Delete a session */
  async deleteSession(sessionId: string): Promise<void> {
    await this.request<unknown>(`/admin/sessions/${sessionId}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // OpenAI-compatible endpoints
  // ---------------------------------------------------------------------------

  /** GET /v1/models -- List loaded models */
  async getModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>("/v1/models");
  }

  /** POST /v1/chat/completions -- Non-streaming chat completion */
  async chatCompletion(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>("/v1/chat/completions", {
      method: "POST",
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
    messages: ChatCompletionRequest["messages"],
    options?: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      signal?: AbortSignal;
    },
  ): AsyncGenerator<string, void, undefined> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
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
      const body = await response.text().catch(() => "");
      throw new LMXError(
        `LMX streaming error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    if (!response.body) {
      throw new LMXError("Response body is null", 0, "No readable stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from buffer
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and SSE comments
          if (!trimmed || trimmed.startsWith(":")) continue;

          // SSE data lines
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();

            // Handle [DONE] sentinel
            if (data === "[DONE]") return;

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
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          if (data !== "[DONE]") {
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
  // RAG endpoints
  // ---------------------------------------------------------------------------

  /** POST /v1/rag/ingest -- Ingest documents into a RAG collection */
  async ragIngest(req: RagIngestRequest): Promise<RagIngestResponse> {
    return this.request<RagIngestResponse>("/v1/rag/ingest", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/rag/query -- Query a RAG collection for relevant context */
  async ragQuery(req: RagQueryRequest): Promise<RagQueryResponse> {
    return this.request<RagQueryResponse>("/v1/rag/query", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/rag/context -- Assemble context from multiple collections */
  async ragContext(req: RagContextRequest): Promise<RagContextResponse> {
    return this.request<RagContextResponse>("/v1/rag/context", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** GET /v1/rag/collections -- List all RAG collections and stats */
  async ragListCollections(): Promise<RagCollectionsResponse> {
    return this.request<RagCollectionsResponse>("/v1/rag/collections");
  }

  /** DELETE /v1/rag/collections/:name -- Delete a RAG collection */
  async ragDeleteCollection(collection: string): Promise<void> {
    await this.request<unknown>(
      `/v1/rag/collections/${encodeURIComponent(collection)}`,
      { method: "DELETE" },
    );
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Memory & Health
  // ---------------------------------------------------------------------------

  async getMemory(): Promise<MemoryDetail> {
    return this.request<MemoryDetail>("/admin/memory");
  }

  async getAdminHealth(): Promise<AdminHealth> {
    return this.request<AdminHealth>("/admin/health");
  }

  async getDiagnostics(): Promise<DiagnosticsReport> {
    return this.request<DiagnosticsReport>("/admin/diagnostics");
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Model Management
  // ---------------------------------------------------------------------------

  async getAdminModels(): Promise<AdminLoadedModel[]> {
    return this.request<AdminLoadedModel[]>("/admin/models");
  }

  async getAvailableModels(): Promise<AvailableModel[]> {
    return this.request<AvailableModel[]>("/admin/models/available");
  }

  /** Load with full options — may return 202 download_required */
  async loadModelFull(req: {
    model_path: string;
    quantization?: string;
    auto_download?: boolean;
    backend?: string;
    keep_alive_sec?: number;
    performance_overrides?: Record<string, unknown>;
    allow_unsupported_runtime?: boolean;
    max_context_length?: number;
  }): Promise<ModelLoadResponse> {
    const url = `${this.baseUrl}/admin/models/load`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!response.ok && response.status !== 202) {
      const body = await response.text().catch(() => "");
      throw new LMXError(
        `LMX API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }
    return response.json() as Promise<ModelLoadResponse>;
  }

  async confirmModelDownload(
    confirmationToken: string,
  ): Promise<ModelLoadResponse> {
    return this.request<ModelLoadResponse>("/admin/models/load/confirm", {
      method: "POST",
      body: JSON.stringify({ confirmation_token: confirmationToken }),
    });
  }

  async downloadModel(req: {
    repo_id: string;
    revision?: string;
  }): Promise<{ download_id: string }> {
    return this.request<{ download_id: string }>("/admin/models/download", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async getDownloadProgress(downloadId: string): Promise<DownloadProgress> {
    return this.request<DownloadProgress>(
      `/admin/models/download/${encodeURIComponent(downloadId)}/progress`,
    );
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.request<unknown>(
      `/admin/models/${encodeURIComponent(modelId)}`,
      {
        method: "DELETE",
      },
    );
  }

  async getModelPerformance(modelId: string): Promise<ModelPerformanceConfig> {
    return this.request<ModelPerformanceConfig>(
      `/admin/models/${encodeURIComponent(modelId)}/performance`,
    );
  }

  async getCompatibilityRecords(opts?: {
    model_id?: string;
    backend?: string;
    since?: string;
  }): Promise<CompatibilityRecord[]> {
    const params = new URLSearchParams();
    if (opts?.model_id) params.set("model_id", opts.model_id);
    if (opts?.backend) params.set("backend", opts.backend);
    if (opts?.since) params.set("since", opts.since);
    const qs = params.toString();
    return this.request<CompatibilityRecord[]>(
      `/admin/models/compatibility${qs ? `?${qs}` : ""}`,
    );
  }

  async autotuneModel(
    modelId: string,
    backend?: string,
  ): Promise<BenchmarkResult> {
    return this.request<BenchmarkResult>("/admin/models/autotune", {
      method: "POST",
      body: JSON.stringify({
        model_id: modelId,
        ...(backend ? { backend } : {}),
      }),
    });
  }

  async getAutotuneResult(modelId: string): Promise<ModelPerformanceConfig> {
    return this.request<ModelPerformanceConfig>(
      `/admin/models/${encodeURIComponent(modelId)}/autotune`,
    );
  }

  /** Probe candidate backends for a model without fully loading it. */
  async probeModel(req: {
    model_path: string;
    backends?: string[];
  }): Promise<{
    results: Array<{ backend: string; supported: boolean; reason?: string }>;
  }> {
    return this.request<{
      results: Array<{ backend: string; supported: boolean; reason?: string }>;
    }>("/admin/models/probe", { method: "POST", body: JSON.stringify(req) });
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Metrics
  // ---------------------------------------------------------------------------

  async getMetricsJson(): Promise<MetricsJson> {
    return this.request<MetricsJson>("/admin/metrics/json");
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Config & Presets
  // ---------------------------------------------------------------------------

  async reloadConfig(): Promise<{ reloaded: boolean; message?: string }> {
    return this.request<{ reloaded: boolean; message?: string }>(
      "/admin/config/reload",
      { method: "POST" },
    );
  }

  async getPresets(): Promise<Preset[]> {
    return this.request<Preset[]>("/admin/presets");
  }

  async getPreset(name: string): Promise<Preset> {
    return this.request<Preset>(`/admin/presets/${encodeURIComponent(name)}`);
  }

  async reloadPresets(): Promise<void> {
    await this.request<unknown>("/admin/presets/reload", { method: "POST" });
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Stack
  // ---------------------------------------------------------------------------

  async getStack(): Promise<StackInfo> {
    return this.request<StackInfo>("/admin/stack");
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Benchmarking
  // ---------------------------------------------------------------------------

  async runBenchmark(req: BenchmarkRequest): Promise<BenchmarkResult> {
    return this.request<BenchmarkResult>("/admin/benchmark/run", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async getBenchmarkResults(modelId?: string): Promise<BenchmarkResult[]> {
    const qs = modelId ? `?model_id=${encodeURIComponent(modelId)}` : "";
    return this.request<BenchmarkResult[]>(`/admin/benchmark/results${qs}`);
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Quantization
  // ---------------------------------------------------------------------------

  async startQuantize(req: QuantizeRequest): Promise<QuantizeJob> {
    return this.request<QuantizeJob>("/admin/quantize", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async getQuantizeJob(jobId: string): Promise<QuantizeJob> {
    return this.request<QuantizeJob>(
      `/admin/quantize/${encodeURIComponent(jobId)}`,
    );
  }

  async listQuantizeJobs(): Promise<QuantizeJob[]> {
    return this.request<QuantizeJob[]>("/admin/quantize");
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Predictor & Helpers
  // ---------------------------------------------------------------------------

  async getPredictorStats(): Promise<PredictorStats> {
    return this.request<PredictorStats>("/admin/predictor");
  }

  async getHelpers(): Promise<HelperNodeStatus[]> {
    return this.request<HelperNodeStatus[]>("/admin/helpers");
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Logs
  // ---------------------------------------------------------------------------

  async listSessionLogs(): Promise<LogFileMeta[]> {
    return this.request<LogFileMeta[]>("/admin/logs/sessions");
  }

  async getSessionLog(filename: string): Promise<string> {
    const url = `${this.baseUrl}/admin/logs/sessions/${encodeURIComponent(filename)}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new LMXError(
        `LMX API error: ${response.status}`,
        response.status,
        body,
      );
    }
    return response.text();
  }

  async listUpdateLogs(): Promise<LogFileMeta[]> {
    return this.request<LogFileMeta[]>("/admin/logs/updates");
  }

  async getUpdateLog(filename: string): Promise<string> {
    const url = `${this.baseUrl}/admin/logs/updates/${encodeURIComponent(filename)}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new LMXError(
        `LMX API error: ${response.status}`,
        response.status,
        body,
      );
    }
    return response.text();
  }

  // ---------------------------------------------------------------------------
  // Extended Admin — Session Search
  // ---------------------------------------------------------------------------

  async searchSessions(
    req: SessionSearchRequest,
  ): Promise<SessionListResponse> {
    const params = new URLSearchParams({ query: req.query });
    if (req.model) params.set("model", req.model);
    if (req.tags?.length) req.tags.forEach((t) => params.append("tag", t));
    if (req.limit != null) params.set("limit", String(req.limit));
    return this.request<SessionListResponse>(
      `/admin/sessions/search?${params.toString()}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Agent Runs
  // ---------------------------------------------------------------------------

  /** GET /admin/agents/runs — List agent run records with optional filters */
  async listAgentRuns(opts?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentRun[]> {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return this.request<AgentRun[]>(`/admin/agents/runs${qs ? `?${qs}` : ""}`);
  }

  /** POST /admin/agents/runs — Create and enqueue a new agent run */
  async createAgentRun(payload: AgentRunCreate): Promise<AgentRun> {
    return this.request<AgentRun>("/admin/agents/runs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /** GET /admin/agents/runs/:id — Fetch a single agent run by ID */
  async getAgentRun(runId: string): Promise<AgentRun> {
    return this.request<AgentRun>(
      `/admin/agents/runs/${encodeURIComponent(runId)}`,
    );
  }

  /** POST /admin/agents/runs/:id/cancel — Cancel an in-progress agent run */
  async cancelAgentRun(runId: string): Promise<AgentRun> {
    return this.request<AgentRun>(
      `/admin/agents/runs/${encodeURIComponent(runId)}/cancel`,
      { method: "POST" },
    );
  }

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------

  /** GET /admin/skills — List all registered skills */
  async listSkills(): Promise<Skill[]> {
    return this.request<Skill[]>("/admin/skills");
  }

  /** GET /admin/skills/:name — Get a skill by name with its tool definitions */
  async getSkill(name: string): Promise<Skill> {
    return this.request<Skill>(`/admin/skills/${encodeURIComponent(name)}`);
  }

  /** GET /admin/skills/mcp/tools — List all MCP tools across all skill servers */
  async listSkillMcpTools(): Promise<SkillMcpTool[]> {
    return this.request<SkillMcpTool[]>("/admin/skills/mcp/tools");
  }

  /** POST /admin/skills/:name/execute — Execute a skill with optional arguments */
  async executeSkill(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<SkillExecuteResult> {
    return this.request<SkillExecuteResult>(
      `/admin/skills/${encodeURIComponent(name)}/execute`,
      {
        method: "POST",
        body: JSON.stringify(args ?? {}),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // ML — Embeddings & Rerank
  // ---------------------------------------------------------------------------

  /** POST /v1/embeddings — Generate embedding vectors for an array of texts */
  async createEmbeddings(
    texts: string[],
    model?: string,
  ): Promise<EmbeddingsResponse> {
    const req: EmbeddingsRequest = { input: texts };
    if (model) req.model = model;
    return this.request<EmbeddingsResponse>("/v1/embeddings", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** POST /v1/rerank — Rerank documents by relevance to a query */
  async rerankDocuments(
    query: string,
    docs: string[],
    topK?: number,
  ): Promise<RerankResponse> {
    const req: RerankRequest = { query, documents: docs };
    if (topK != null) req.top_k = topK;
    return this.request<RerankResponse>("/v1/rerank", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }
}
