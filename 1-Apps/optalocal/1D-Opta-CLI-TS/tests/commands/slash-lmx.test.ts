import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

type DispatchSlashCommand = typeof import('../../src/commands/slash/index.js').dispatchSlashCommand;

describe('/serve slash command parity', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let serveMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    serveMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/commands/serve.js', () => ({
      serve: serveMock,
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /serve --json to serve status JSON output', async () => {
    const result = await dispatchSlashCommand('/serve --json', makeCtx());
    expect(result).toBe('handled');
    expect(serveMock).toHaveBeenCalledWith(undefined, { json: true });
  });

  it('routes /serve start --json to serve start with JSON option', async () => {
    const result = await dispatchSlashCommand('/serve start --json', makeCtx());
    expect(result).toBe('handled');
    expect(serveMock).toHaveBeenCalledWith('start', { json: true });
  });

  it('routes /lmx start to the serve handler for backward compatibility', async () => {
    const result = await dispatchSlashCommand('/lmx start', makeCtx());
    expect(result).toBe('handled');
    expect(serveMock).toHaveBeenCalledWith('start', undefined);
  });
});

describe('/probe slash command', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let probeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    probeMock = vi.fn().mockResolvedValue({
      modelId: 'test/model',
      recommendedBackend: 'mlx-lm',
      candidates: [{ backend: 'mlx-lm', outcome: 'pass' }],
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        probeModel = probeMock;
      },
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('passes timeout and allow-unsupported flags to probeModel', async () => {
    const result = await dispatchSlashCommand('/probe test/model --timeout 120 --allow-unsupported', makeCtx());
    expect(result).toBe('handled');
    expect(probeMock).toHaveBeenCalledWith(
      { modelId: 'test/model', timeoutSec: 120, allowUnsupportedRuntime: true },
      { timeoutMs: 120000, maxRetries: 0 },
    );
  });
});

describe('/load advanced options', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let modelsMock: ReturnType<typeof vi.fn>;
  let availableMock: ReturnType<typeof vi.fn>;
  let ensureModelLoadedMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    modelsMock = vi.fn().mockResolvedValue({ models: [] });
    availableMock = vi.fn().mockResolvedValue([{ repo_id: 'test/model' }]);
    ensureModelLoadedMock = vi.fn().mockResolvedValue('test/model');

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        models = modelsMock;
        available = availableMock;
      },
    }));

    vi.doMock('../../src/lmx/model-lifecycle.js', () => ({
      findMatchingModelId: (target: string, candidates: string[]) => candidates.find((id) => id === target),
      ensureModelLoaded: ensureModelLoadedMock,
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('serializes advanced load options into loadModel payload', async () => {
    const command = '/load test/model --backend mlx-lm --auto-download --keep-alive 120 --allow-unsupported --kv-bits 4 --prefix-cache false';
    const result = await dispatchSlashCommand(command, makeCtx());
    expect(result).toBe('handled');
    expect(ensureModelLoadedMock).toHaveBeenCalledWith(
      expect.anything(),
      'test/model',
      expect.objectContaining({
        timeoutMs: 300000,
        loadOptions: {
          backend: 'mlx-lm',
          autoDownload: true,
          keepAliveSec: 120,
          allowUnsupportedRuntime: true,
          performanceOverrides: {
            kv_bits: 4,
            prefix_cache: false,
          },
        },
      }),
    );
  });
});

describe('/presets and /autotune slash commands', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let reloadPresetsMock: ReturnType<typeof vi.fn>;
  let autotuneModelMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    reloadPresetsMock = vi.fn().mockResolvedValue({ success: true, presets_loaded: 3 });
    autotuneModelMock = vi.fn().mockResolvedValue({
      modelId: 'test/model',
      backend: 'mlx-lm',
      backendVersion: 'v1',
      bestProfile: { kv_bits: 4 },
      bestMetrics: { avg_tokens_per_second: 40 },
      bestScore: 1.23,
      candidates: [{ profile: { kv_bits: 4 }, metrics: { avg_tokens_per_second: 40 }, score: 1.23 }],
    });

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        reloadPresets = reloadPresetsMock;
        autotuneModel = autotuneModelMock;
      },
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /presets reload to reloadPresets endpoint', async () => {
    const result = await dispatchSlashCommand('/presets reload', makeCtx());
    expect(result).toBe('handled');
    expect(reloadPresetsMock).toHaveBeenCalled();
  });

  it('parses autotune flags and profiles-json payload', async () => {
    const result = await dispatchSlashCommand('/autotune test/model --runs 2 --max-tokens 64 --temperature 0.1 --profiles-json \"[{\\\"kv_bits\\\":4}]\" --allow-unsupported', makeCtx());
    expect(result).toBe('handled');
    expect(autotuneModelMock).toHaveBeenCalledWith(
      {
        modelId: 'test/model',
        runs: 2,
        maxTokens: 64,
        temperature: 0.1,
        profiles: [{ kv_bits: 4 }],
        allowUnsupportedRuntime: true,
      },
      { timeoutMs: 180000, maxRetries: 0 },
    );
  });
});

describe('/compatibility and /autotune-status slash commands', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let modelCompatibilityMock: ReturnType<typeof vi.fn>;
  let autotuneRecordMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    modelCompatibilityMock = vi.fn().mockResolvedValue({
      total: 1,
      rows: [{ ts: 1738300000, backend: 'mlx-lm', outcome: 'pass', model_id: 'test/model' }],
      summary: { 'test/model': { ok: 1 } },
    });
    autotuneRecordMock = vi.fn().mockResolvedValue({
      model_id: 'test/model',
      backend: 'mlx-lm',
      backend_version: '0.20.0',
      score: 1.2,
      ts: 1738300000,
      profile: { kv_bits: 4 },
      metrics: { avg_tokens_per_second: 40 },
    });

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        modelCompatibility = modelCompatibilityMock;
        autotuneRecord = autotuneRecordMock;
      },
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /compatibility filters to modelCompatibility options', async () => {
    const result = await dispatchSlashCommand(
      '/compatibility --model test/model --backend mlx-lm --outcome ok --since 1738300000 --limit 20 --summary',
      makeCtx(),
    );
    expect(result).toBe('handled');
    expect(modelCompatibilityMock).toHaveBeenCalledWith(
      {
        modelId: 'test/model',
        backend: 'mlx-lm',
        outcome: 'ok',
        sinceTs: 1738300000,
        limit: 20,
        includeSummary: true,
      },
      { timeoutMs: 5000, maxRetries: 0 },
    );
  });

  it('routes /autotune-status flags to autotuneRecord query', async () => {
    const result = await dispatchSlashCommand(
      '/autotune-status test/model --backend mlx-lm --backend-version 0.20.0',
      makeCtx(),
    );
    expect(result).toBe('handled');
    expect(autotuneRecordMock).toHaveBeenCalledWith(
      'test/model',
      { backend: 'mlx-lm', backendVersion: '0.20.0' },
      { timeoutMs: 5000, maxRetries: 0 },
    );
  });
});

describe('/predictor, /helpers, and /quantize slash commands', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let predictorStatsMock: ReturnType<typeof vi.fn>;
  let helpersHealthMock: ReturnType<typeof vi.fn>;
  let quantizeJobsMock: ReturnType<typeof vi.fn>;
  let quantizeStatusMock: ReturnType<typeof vi.fn>;
  let quantizeStartMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    predictorStatsMock = vi.fn().mockResolvedValue({ predicted_next: 'test/model', confidence: 0.9 });
    helpersHealthMock = vi.fn().mockResolvedValue({
      configured_count: 1,
      all_healthy: true,
      helpers: { embedding: { healthy: true } },
      live_checks: { embedding: true },
    });
    quantizeJobsMock = vi.fn().mockResolvedValue({ jobs: [], count: 0 });
    quantizeStatusMock = vi.fn().mockResolvedValue({ job_id: 'job-1', status: 'running' });
    quantizeStartMock = vi.fn().mockResolvedValue({
      job_id: 'job-1',
      source_model: 'test/model',
      output_path: '/tmp/model',
      bits: 4,
      mode: 'affine',
      status: 'queued',
    });

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        predictorStats = predictorStatsMock;
        helpersHealth = helpersHealthMock;
        quantizeJobs = quantizeJobsMock;
        quantizeStatus = quantizeStatusMock;
        quantizeStart = quantizeStartMock;
      },
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /predictor to predictorStats', async () => {
    const result = await dispatchSlashCommand('/predictor', makeCtx());
    expect(result).toBe('handled');
    expect(predictorStatsMock).toHaveBeenCalledWith({ timeoutMs: 5000, maxRetries: 0 });
  });

  it('routes /helpers to helpersHealth', async () => {
    const result = await dispatchSlashCommand('/helpers', makeCtx());
    expect(result).toBe('handled');
    expect(helpersHealthMock).toHaveBeenCalledWith({ timeoutMs: 5000, maxRetries: 0 });
  });

  it('routes /quantize list to quantizeJobs', async () => {
    const result = await dispatchSlashCommand('/quantize list', makeCtx());
    expect(result).toBe('handled');
    expect(quantizeJobsMock).toHaveBeenCalledWith({ timeoutMs: 5000, maxRetries: 0 });
  });

  it('routes /quantize status to quantizeStatus', async () => {
    const result = await dispatchSlashCommand('/quantize status job-1', makeCtx());
    expect(result).toBe('handled');
    expect(quantizeStatusMock).toHaveBeenCalledWith('job-1', { timeoutMs: 5000, maxRetries: 0 });
  });

  it('routes /quantize start flags to quantizeStart payload', async () => {
    const result = await dispatchSlashCommand(
      '/quantize start test/model --bits 8 --group-size 128 --mode symmetric --output "/tmp/out"',
      makeCtx(),
    );
    expect(result).toBe('handled');
    expect(quantizeStartMock).toHaveBeenCalledWith(
      {
        sourceModel: 'test/model',
        bits: 8,
        groupSize: 128,
        mode: 'symmetric',
        outputPath: '/tmp/out',
      },
      { timeoutMs: 60000, maxRetries: 0 },
    );
  });
});

describe('/benchmark results, /embed, and /rerank slash commands', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let benchmarkModelMock: ReturnType<typeof vi.fn>;
  let listBenchmarkResultsMock: ReturnType<typeof vi.fn>;
  let createEmbeddingsMock: ReturnType<typeof vi.fn>;
  let rerankDocumentsMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    benchmarkModelMock = vi.fn().mockResolvedValue({
      modelId: 'test/model',
      backendType: 'mlx-lm',
      prompt: 'hello',
      maxTokens: 128,
      runs: 3,
      results: [{ run: 1, tokensGenerated: 10, timeToFirstTokenMs: 50, totalTimeMs: 200, tokensPerSecond: 50 }],
      avgTokensPerSecond: 50,
      avgTimeToFirstTokenMs: 50,
      avgTotalTimeMs: 200,
    });
    listBenchmarkResultsMock = vi.fn().mockResolvedValue([
      {
        model_id: 'test/model',
        backend: 'mlx-lm',
        status: 'ok',
        timestamp: '2026-02-25T00:00:00Z',
        stats: { toks_per_sec_mean: 42.1, ttft_ms_mean: 120 },
      },
    ]);
    createEmbeddingsMock = vi.fn().mockResolvedValue({
      model: 'test-embedding-model',
      data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
      usage: { prompt_tokens: 3 },
    });
    rerankDocumentsMock = vi.fn().mockResolvedValue({
      model: 'test-reranker',
      results: [{ index: 1, relevance_score: 0.98, document: { text: 'doc two' } }],
      usage: { total_tokens: 12 },
    });

    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        benchmarkModel = benchmarkModelMock;
        listBenchmarkResults = listBenchmarkResultsMock;
        createEmbeddings = createEmbeddingsMock;
        rerankDocuments = rerankDocumentsMock;
      },
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /benchmark results to listBenchmarkResults wrapper', async () => {
    const result = await dispatchSlashCommand('/benchmark results --json', makeCtx());
    expect(result).toBe('handled');
    expect(listBenchmarkResultsMock).toHaveBeenCalledWith();
  });

  it('keeps /benchmark [model-id] behavior routed to benchmarkModel', async () => {
    const result = await dispatchSlashCommand('/benchmark test/model', makeCtx());
    expect(result).toBe('handled');
    expect(benchmarkModelMock).toHaveBeenCalledWith('test/model');
  });

  it('routes /embed flags to createEmbeddings payload', async () => {
    const result = await dispatchSlashCommand('/embed "hello world" --model test-embedding-model --json', makeCtx());
    expect(result).toBe('handled');
    expect(createEmbeddingsMock).toHaveBeenCalledWith({
      input: 'hello world',
      model: 'test-embedding-model',
    });
  });

  it('routes /rerank flags to rerankDocuments payload', async () => {
    const result = await dispatchSlashCommand(
      '/rerank "search query" --documents "doc one|doc two|doc three" --model test-reranker --top-k 2 --json',
      makeCtx(),
    );
    expect(result).toBe('handled');
    expect(rerankDocumentsMock).toHaveBeenCalledWith({
      query: 'search query',
      documents: ['doc one', 'doc two', 'doc three'],
      model: 'test-reranker',
      topK: 2,
    });
  });
});

describe('/agents, /lmx-skills, /rag, and /models proxy routing', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let modelsMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    modelsMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../../src/commands/models/index.js', () => ({
      models: modelsMock,
    }));

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('routes /agents flags through proxy to models agents action', async () => {
    const result = await dispatchSlashCommand('/agents list --status running --limit 12 --json', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalledWith(
      'agents',
      'list --status running --limit 12',
      undefined,
      { json: true },
    );
  });

  it('routes /lmx-skills tools to models skills action', async () => {
    const result = await dispatchSlashCommand('/lmx-skills tools', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalledWith(
      'skills',
      'tools',
      undefined,
      { json: false },
    );
  });

  it('routes /rag collections to models rag action', async () => {
    const result = await dispatchSlashCommand('/rag collections', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalledWith(
      'rag',
      'collections',
      undefined,
      { json: false },
    );
  });

  it('routes /agents start payload flags through proxy to models agents action', async () => {
    const result = await dispatchSlashCommand('/agents start --prompt "hello" --roles planner,executor --json', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalledWith(
      'agents',
      'start --prompt hello --roles planner,executor',
      undefined,
      { json: true },
    );
  });

  it('routes /lmx-skills run through proxy to models skills action', async () => {
    const result = await dispatchSlashCommand('/lmx-skills run ai26-3c-productivity-writing-plans --args "{\"topic\":\"routing\"}"', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalled();
    const call = modelsMock.mock.calls[0] as [string, string, undefined, { json: boolean }];
    expect(call[0]).toBe('skills');
    expect(call[1]).toContain('run ai26-3c-productivity-writing-plans --args');
    expect(call[3]).toEqual({ json: false });
  });

  it('routes /rag context through proxy to models rag action', async () => {
    const result = await dispatchSlashCommand('/rag context "what changed" --collections docs,notes --rerank', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalledWith(
      'rag',
      'context what changed --collections docs,notes --rerank',
      undefined,
      { json: false },
    );
  });

  it('allows nested flags in /models quantize passthrough', async () => {
    const result = await dispatchSlashCommand('/models quantize start test/model --bits 8 --mode symmetric --json', makeCtx());
    expect(result).toBe('handled');
    expect(modelsMock).toHaveBeenCalledWith(
      'quantize',
      'start test/model --bits 8 --mode symmetric',
      undefined,
      { json: true },
    );
  });
});

describe('/metrics --prom and /events slash commands', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.doMock('../../src/lmx/client.js', () => ({
      LmxClient: class {
        metricsJson = vi.fn().mockResolvedValue({ total_requests: 1 });
      },
    }));
    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  it('fetches prometheus text endpoint for /metrics --prom', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('opta_requests_total 5\n', { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await dispatchSlashCommand('/metrics --prom', makeCtx());
    expect(result).toBe('handled');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/metrics');
  });

  it('streams /admin/events for /events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('event: heartbeat\ndata: {"timestamp":1}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await dispatchSlashCommand('/events --limit 1 --timeout 1', makeCtx());
    expect(result).toBe('handled');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/events');
  });
});
