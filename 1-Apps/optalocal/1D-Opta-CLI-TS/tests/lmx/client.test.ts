import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupContextLimit, LmxClient } from '../../src/lmx/client.js';

const realFetch = globalThis.fetch;

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = realFetch;
});

describe('lookupContextLimit', () => {
  it('returns known limit for glm-4.7-flash', () => {
    expect(lookupContextLimit('glm-4.7-flash')).toBe(128_000);
  });

  it('returns known limit for qwen2.5-72b', () => {
    expect(lookupContextLimit('qwen2.5-72b')).toBe(32_768);
  });

  it('matches case-insensitively', () => {
    expect(lookupContextLimit('GLM-4.7-Flash')).toBe(128_000);
    expect(lookupContextLimit('Qwen2.5-72B')).toBe(32_768);
  });

  it('matches partial model IDs', () => {
    expect(lookupContextLimit('some-prefix-qwen2.5-72b-q4')).toBe(32_768);
  });

  it('returns 32768 for unknown models', () => {
    expect(lookupContextLimit('unknown-model-xyz')).toBe(32_768);
  });

  it('returns known limit for wizardlm', () => {
    expect(lookupContextLimit('wizardlm')).toBe(4_096);
  });

  it('returns known limit for gemma-3-4b', () => {
    expect(lookupContextLimit('gemma-3-4b')).toBe(8_192);
  });
});

describe('LmxClient', () => {
  it('constructs with host and port', () => {
    const client = new LmxClient({ host: '192.168.188.11', port: 8000 });
    expect(client).toBeDefined();
  });

  it('constructs with optional adminKey', () => {
    const client = new LmxClient({
      host: '192.168.188.11',
      port: 8000,
      adminKey: 'test-key',
    });
    expect(client).toBeDefined();
  });

  it('rejects health check against unreachable host', async () => {
    const client = new LmxClient({ host: '127.0.0.1', port: 1 });
    await expect(client.health()).rejects.toThrow();
  });

  it('formats nested API error payloads without [object Object]', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: {
            message: 'Model is not compatible with current backend',
          },
        }),
        { status: 400, statusText: 'Bad Request', headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const client = new LmxClient({
      host: 'localhost',
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.loadModel('bad-model')).rejects.toMatchObject({
      message: expect.stringContaining('not compatible'),
    });
  });

  it('retries transient transport errors before failing', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'localhost',
      port: 1234,
      maxRetries: 1,
      backoffMs: 1,
      backoffMultiplier: 1,
    });

    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries retryable HTTP status responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('server busy', { status: 503, statusText: 'Service Unavailable' }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'localhost',
      port: 1234,
      maxRetries: 1,
      backoffMs: 1,
      backoffMultiplier: 1,
    });

    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses per-request timeout overrides for long-running load calls', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException('Timeout', 'TimeoutError')) as unknown as typeof fetch;

    const client = new LmxClient({
      host: 'localhost',
      port: 1234,
      maxRetries: 0,
    });

    await expect(
      client.loadModel('inferencerlabs/GLM-5-MLX-4.8bit', { timeoutMs: 42_000 }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('request timed out after 42s'),
    });
  });

  it('serializes advanced loadModel payload config fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        model_id: 'inferencerlabs/GLM-5-MLX-4.8bit',
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.loadModel('inferencerlabs/GLM-5-MLX-4.8bit', {
      backend: 'mlx',
      autoDownload: true,
      performanceOverrides: { use_batching: true, batch_size: 8 },
      keepAliveSec: 180,
      allowUnsupportedRuntime: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/admin/models/load');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      model_id: 'inferencerlabs/GLM-5-MLX-4.8bit',
      backend: 'mlx',
      auto_download: true,
      performance_overrides: { use_batching: true, batch_size: 8 },
      keep_alive_sec: 180,
      allow_unsupported_runtime: true,
    });
  });

  it('maps download-required load responses without forcing loaded status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'download_required',
          model_id: 'test/model',
          confirmation_token: 'token-123',
          estimated_size_bytes: 1024,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    const result = await client.loadModel('test/model');
    expect(result).toEqual({
      model_id: 'test/model',
      status: 'download_required',
      memory_bytes: undefined,
      load_time_seconds: undefined,
      estimated_size_bytes: 1024,
      estimated_size_human: undefined,
      confirmation_token: 'token-123',
      download_id: undefined,
      message: undefined,
      confirm_url: undefined,
      progress_url: undefined,
    });
  });

  it('maps confirmLoad payload to API shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      status: 'downloading',
      model_id: 'test/model',
      download_id: 'dl-1',
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    const result = await client.confirmLoad('token-123');

    expect(result.status).toBe('downloading');
    expect(result.download_id).toBe('dl-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/admin/models/load/confirm');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ confirmation_token: 'token-123' });
  });

  it('maps quantize, predictor, and helpers endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ job_id: 'job-1', status: 'queued' }))
      .mockResolvedValueOnce(jsonResponse({ jobs: [], count: 0 }))
      .mockResolvedValueOnce(jsonResponse({ predicted_next: 'test/model' }))
      .mockResolvedValueOnce(jsonResponse({ configured_count: 0, all_healthy: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.quantizeStart({ sourceModel: 'test/model', bits: 4, mode: 'affine' });
    await client.quantizeJobs();
    await client.predictorStats();
    await client.helpersHealth();

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:1234/admin/quantize');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('http://localhost:1234/admin/quantize');
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe('http://localhost:1234/admin/predictor');
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe('http://localhost:1234/admin/helpers');
  });

  it('maps agents, skills, and rag endpoint routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'run-0', status: 'queued' }))
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [], total: 0 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'run-1', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'run-1', status: 'cancelled' }))
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [] }))
      .mockResolvedValueOnce(jsonResponse({ name: 'skill-a', reference: 'skill-a' }))
      .mockResolvedValueOnce(jsonResponse({ tools: [] }))
      .mockResolvedValueOnce(jsonResponse({ skill: 'skill-a', ok: true }))
      .mockResolvedValueOnce(jsonResponse({ skill_name: 'tool-a', ok: true }))
      .mockResolvedValueOnce(jsonResponse({ tool: 'tool-a', ok: true }))
      .mockResolvedValueOnce(jsonResponse({ total_documents: 0, collection_count: 0, collections: [] }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ collection: 'docs', query: 'hello', results: [] }))
      .mockResolvedValueOnce(jsonResponse({ collection: 'docs', documents_ingested: 1, chunks_created: 2 }))
      .mockResolvedValueOnce(jsonResponse({ context: 'ctx', sources: [], total_chunks: 1 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.createAgentRun({
      request: {
        strategy: 'handoff',
        prompt: 'hello',
        roles: ['default'],
      },
    }, { idempotencyKey: 'idem-1' });
    await client.agentRuns({ limit: 10, offset: 2, status: 'running' });
    await client.agentRun('run-1');
    await client.cancelAgentRun('run-1');
    await client.skillsList({ latestOnly: false });
    await client.skillDetail('skill/a');
    await client.skillMcpTools();
    await client.skillExecute('skill/a', { arguments: { foo: 'bar' }, approved: true, timeoutSec: 45 });
    await client.skillMcpCall({ name: 'tool-a', arguments: { q: 1 }, approved: true });
    await client.skillOpenClawInvoke({ name: 'tool-a', arguments: { q: 2 }, timeoutSec: 30 });
    await client.ragCollections();
    await client.ragDeleteCollection('docs');
    await client.ragQuery({
      collection: 'docs',
      query: 'hello',
      topK: 3,
      minScore: 0.2,
      includeEmbeddings: true,
      searchMode: 'hybrid',
      rerank: true,
      rerankTopK: 5,
    });
    await client.ragIngest({
      collection: 'docs',
      documents: ['hello world'],
      chunking: 'text',
      chunkSize: 256,
      chunkOverlap: 16,
    });
    await client.ragContext({
      query: 'hello',
      collections: ['docs'],
      topKPerCollection: 2,
      maxContextTokens: 1024,
      rerank: true,
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:1234/v1/agents/runs');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'idem-1' });
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      request: {
        strategy: 'handoff',
        prompt: 'hello',
        roles: ['default'],
      },
    });

    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'http://localhost:1234/v1/agents/runs?limit=10&offset=2&status=running',
    );
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe('http://localhost:1234/v1/agents/runs/run-1');
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe('http://localhost:1234/v1/agents/runs/run-1/cancel');
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('POST');
    expect(String(fetchMock.mock.calls[4]?.[0])).toBe('http://localhost:1234/v1/skills?latest_only=false');
    expect(String(fetchMock.mock.calls[5]?.[0])).toBe('http://localhost:1234/v1/skills/skill%2Fa');
    expect(String(fetchMock.mock.calls[6]?.[0])).toBe('http://localhost:1234/v1/skills/mcp/tools');
    expect(String(fetchMock.mock.calls[7]?.[0])).toBe('http://localhost:1234/v1/skills/skill%2Fa/execute');
    expect((fetchMock.mock.calls[7]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[7]?.[1] as RequestInit).body))).toEqual({
      arguments: { foo: 'bar' },
      approved: true,
      timeout_sec: 45,
    });
    expect(String(fetchMock.mock.calls[8]?.[0])).toBe('http://localhost:1234/v1/skills/mcp/call');
    expect(String(fetchMock.mock.calls[9]?.[0])).toBe('http://localhost:1234/v1/skills/openclaw/invoke');
    expect(String(fetchMock.mock.calls[10]?.[0])).toBe('http://localhost:1234/v1/rag/collections');
    expect(String(fetchMock.mock.calls[11]?.[0])).toBe('http://localhost:1234/v1/rag/collections/docs');
    expect((fetchMock.mock.calls[11]?.[1] as RequestInit).method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[12]?.[0])).toBe('http://localhost:1234/v1/rag/query');
    expect((fetchMock.mock.calls[12]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[12]?.[1] as RequestInit).body))).toEqual({
      collection: 'docs',
      query: 'hello',
      top_k: 3,
      min_score: 0.2,
      include_embeddings: true,
      search_mode: 'hybrid',
      rerank: true,
      rerank_top_k: 5,
    });
    expect(String(fetchMock.mock.calls[13]?.[0])).toBe('http://localhost:1234/v1/rag/ingest');
    expect(String(fetchMock.mock.calls[14]?.[0])).toBe('http://localhost:1234/v1/rag/context');
  });

  it('maps presetDetail and reloadPresets to the expected routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ name: 'dev/default', model: 'qwen2.5-72b' }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.presetDetail('dev/default');
    await client.reloadPresets();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:1234/admin/presets/dev%2Fdefault',
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.method).toBeUndefined();
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('http://localhost:1234/admin/presets/reload');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('POST');
  });

  it('maps sessions, embeddings, rerank, benchmark persisted, and anthropic routes', async () => {
    const benchmarkResult = {
      model_id: 'qwen2.5-72b',
      backend: 'mlx',
      timestamp: '2026-02-01T12:00:00Z',
      status: 'ok',
      hardware: 'Apple Silicon',
      lmx_version: '0.1.0',
      prompt_preview: 'Explain attention.',
      stats: {
        ttft_p50_sec: 0.5,
        ttft_p95_sec: 0.6,
        ttft_mean_sec: 0.55,
        toks_per_sec_p50: 20.0,
        toks_per_sec_p95: 24.0,
        toks_per_sec_mean: 22.0,
        prompt_tokens: 8,
        output_tokens: 300,
        runs_completed: 4,
        warmup_runs_discarded: 2,
        output_text: 'Attention is a mechanism...',
        output_token_count: 300,
        completed_naturally: false,
        repetition_ratio: 0.0,
        coherence_flag: 'truncated',
        tool_call: null,
        skills: [],
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sessions: [], total: 0 }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({
        id: 'session-1',
        title: 'Session 1',
        model: 'qwen2.5-72b',
        tags: ['work'],
        created: '2026-02-01T00:00:00Z',
        updated: '2026-02-01T00:10:00Z',
        cwd: '/tmp',
        messages: [],
        tool_call_count: 0,
        compacted: false,
      }))
      .mockResolvedValueOnce(jsonResponse({ deleted: true }))
      .mockResolvedValueOnce(jsonResponse({
        object: 'list',
        data: [{ object: 'embedding', embedding: [0.1, 0.2], index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{ index: 0, relevance_score: 0.9, document: { text: 'alpha' } }],
        model: 'rerank-v1',
        usage: { total_tokens: 12 },
      }))
      .mockResolvedValueOnce(jsonResponse(benchmarkResult))
      .mockResolvedValueOnce(jsonResponse([benchmarkResult]))
      .mockResolvedValueOnce(jsonResponse({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'qwen2.5-72b',
        content: [{ type: 'text', text: 'Hello there.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 3 },
      }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });

    await client.listSessions({
      limit: 25,
      offset: 5,
      model: 'qwen2.5',
      tag: 'work',
      since: '2026-01-01',
    });
    await client.searchSessions({ query: 'attention', limit: 7 });
    await client.getSession('session/1');
    await client.deleteSession('session/1');
    await client.createEmbeddings({
      input: ['alpha', 'beta'],
      model: 'text-embedding-3-small',
      encodingFormat: 'base64',
    });
    await client.rerankDocuments({
      model: 'rerank-v1',
      query: 'alpha',
      documents: ['alpha', 'beta'],
      topN: 1,
    });
    await client.runBenchmarkAndPersist({
      modelId: 'qwen2.5-72b',
      prompt: 'Explain attention.',
      numOutputTokens: 300,
      runs: 4,
      temperature: 0.2,
      warmupRuns: 2,
    });
    await client.listBenchmarkResults({ modelId: 'qwen2.5-72b' });
    await client.anthropicMessages({
      model: 'qwen2.5-72b',
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 128,
      system: 'Be concise',
      temperature: 0.3,
      topP: 0.9,
      stream: false,
      stopSequences: ['END'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:1234/admin/sessions?limit=25&offset=5&model=qwen2.5&tag=work&since=2026-01-01',
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'http://localhost:1234/admin/sessions/search?q=attention&limit=7',
    );
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(
      'http://localhost:1234/admin/sessions/session%2F1',
    );
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe(
      'http://localhost:1234/admin/sessions/session%2F1',
    );
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('DELETE');

    expect(String(fetchMock.mock.calls[4]?.[0])).toBe('http://localhost:1234/v1/embeddings');
    expect((fetchMock.mock.calls[4]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[4]?.[1] as RequestInit).body))).toEqual({
      input: ['alpha', 'beta'],
      model: 'text-embedding-3-small',
      encoding_format: 'base64',
    });

    expect(String(fetchMock.mock.calls[5]?.[0])).toBe('http://localhost:1234/v1/rerank');
    expect((fetchMock.mock.calls[5]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[5]?.[1] as RequestInit).body))).toEqual({
      model: 'rerank-v1',
      query: 'alpha',
      documents: ['alpha', 'beta'],
      top_n: 1,
    });

    expect(String(fetchMock.mock.calls[6]?.[0])).toBe('http://localhost:1234/admin/benchmark/run');
    expect((fetchMock.mock.calls[6]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[6]?.[1] as RequestInit).body))).toEqual({
      model_id: 'qwen2.5-72b',
      prompt: 'Explain attention.',
      num_output_tokens: 300,
      runs: 4,
      temperature: 0.2,
      warmup_runs: 2,
    });

    expect(String(fetchMock.mock.calls[7]?.[0])).toBe(
      'http://localhost:1234/admin/benchmark/results?model_id=qwen2.5-72b',
    );

    expect(String(fetchMock.mock.calls[8]?.[0])).toBe('http://localhost:1234/v1/messages');
    expect((fetchMock.mock.calls[8]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[8]?.[1] as RequestInit).body))).toEqual({
      model: 'qwen2.5-72b',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 128,
      system: 'Be concise',
      temperature: 0.3,
      top_p: 0.9,
      stream: false,
      stop_sequences: ['END'],
    });
  });

  it('maps probeModel payload fields to API shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.probeModel({
      modelId: 'qwen2.5-72b',
      timeoutSec: 25,
      allowUnsupportedRuntime: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/admin/models/probe');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      model_id: 'qwen2.5-72b',
      timeout_sec: 25,
      allow_unsupported_runtime: true,
    });
  });

  it('serializes modelCompatibility query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], summary: {} }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.modelCompatibility({
      modelId: 'qwen2.5-72b',
      backend: 'mlx',
      outcome: 'compatible',
      sinceTs: 1_738_300_000,
      limit: 25,
      includeSummary: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:1234/admin/models/compatibility?model_id=qwen2.5-72b&backend=mlx&outcome=compatible&since_ts=1738300000&limit=25&include_summary=false',
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.method).toBeUndefined();
  });

  it('maps autotuneModel payload fields to API shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.autotuneModel({
      modelId: 'qwen2.5-72b',
      prompt: 'Write a concise summary.',
      maxTokens: 128,
      temperature: 0.1,
      runs: 5,
      profiles: ['latency', 'quality'],
      allowUnsupportedRuntime: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/admin/models/autotune');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      model_id: 'qwen2.5-72b',
      prompt: 'Write a concise summary.',
      max_tokens: 128,
      temperature: 0.1,
      runs: 5,
      profiles: ['latency', 'quality'],
      allow_unsupported_runtime: true,
    });
  });

  it('serializes autotuneRecord query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ model_id: 'm', runs: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new LmxClient({ host: 'localhost', port: 1234, maxRetries: 0 });
    await client.autotuneRecord('model/with/slash', {
      backend: 'mlx',
      backendVersion: '0.20.0',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:1234/admin/models/model%2Fwith%2Fslash/autotune?backend=mlx&backend_version=0.20.0',
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.method).toBeUndefined();
  });

  it('fails over to fallback hosts on connection errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'primary-host',
      fallbackHosts: ['backup-host'],
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://primary-host:1234/healthz');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(client.getActiveHost()).toBe('backup-host');
  });

  it('reports all attempted hosts when every candidate fails', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError')) as unknown as typeof fetch;

    const client = new LmxClient({
      host: 'primary-host',
      fallbackHosts: ['backup-host'],
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.health()).rejects.toMatchObject({
      message: expect.stringMatching(/primary-host[\s\S]*backup-host/),
    });
  });

  it('deprioritizes a cooled-down active host in favor of healthy fallback', async () => {
    let nowMs = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(
        new Response('bad request', { status: 400, statusText: 'Bad Request' }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'primary-host',
      fallbackHosts: ['backup-host'],
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.health()).rejects.toBeInstanceOf(Error);
    nowMs += 1_000;
    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://primary-host:1234/healthz');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('http://backup-host:1234/healthz');
  });

  it('avoids repeated primary stalls during cooldown so fallback succeeds quickly', async () => {
    let nowMs = 5_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    const fetchMock = vi.fn(async (url: string | URL) => {
      const text = String(url);
      if (text.includes('primary-host')) {
        throw new Error('ECONNREFUSED');
      }
      return new Response(
        JSON.stringify({
          status: 'ok',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'primary-host',
      fallbackHosts: ['backup-host'],
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    nowMs += 500;
    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://primary-host:1234/healthz');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(client.getActiveHost()).toBe('backup-host');
  });

  it('half-open probes preferred primary after cooldown even when fallback remains active', async () => {
    let nowMs = 20_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    const okResponse = new Response(
      JSON.stringify({
        status: 'ok',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(okResponse.clone())
      .mockResolvedValueOnce(okResponse.clone())
      .mockResolvedValueOnce(okResponse.clone());

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'primary-host',
      fallbackHosts: ['backup-host'],
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    expect(client.getActiveHost()).toBe('backup-host');

    nowMs += 1_000;
    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    expect(client.getActiveHost()).toBe('backup-host');

    nowMs += 30_000;
    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });
    expect(client.getActiveHost()).toBe('primary-host');

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://primary-host:1234/healthz');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain('http://primary-host:1234/healthz');
  });

  it('retries a cooled host after cooldown expires', async () => {
    let nowMs = 10_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(
        new Response('bad request', { status: 400, statusText: 'Bad Request' }),
      )
      .mockResolvedValueOnce(
        new Response('bad request', { status: 400, statusText: 'Bad Request' }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LmxClient({
      host: 'primary-host',
      fallbackHosts: ['backup-host'],
      port: 1234,
      maxRetries: 0,
    });

    await expect(client.health()).rejects.toBeInstanceOf(Error);
    nowMs += 1_000;
    await expect(client.health()).rejects.toBeInstanceOf(Error);
    nowMs += 30_000;
    await expect(client.health()).resolves.toMatchObject({ status: 'ok' });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('http://primary-host:1234/healthz');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('http://backup-host:1234/healthz');
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain('http://primary-host:1234/healthz');
  });
});
