import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LmxProvider } from '../../src/providers/lmx.js';
import type { OptaConfig } from '../../src/core/config.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Module mocks — vi.mock() calls are hoisted by Vitest
// ---------------------------------------------------------------------------

// Mock the endpoint resolver to avoid real network probes.
// The default return value is re-applied in beforeEach so vi.clearAllMocks()
// does not strip the implementation between tests.
vi.mock('../../src/lmx/endpoints.js', () => ({
  resolveLmxEndpoint: vi.fn(),
}));

// Mock the connection prober used in health()
vi.mock('../../src/lmx/connection.js', () => ({
  probeLmxConnection: vi.fn(),
}));

// Mock api-key resolution
vi.mock('../../src/lmx/api-key.js', () => ({
  resolveLmxApiKey: vi.fn(),
  resolveLmxApiKeyAsync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// OpenAI mock factory
// ---------------------------------------------------------------------------

type MockOpenAIClient = {
  models: {
    list: ReturnType<typeof vi.fn>;
  };
};

function makeMockOpenAI(
  modelList: Array<{ id: string }> = [],
): MockOpenAIClient {
  async function* asyncIter() {
    for (const m of modelList) yield m;
  }
  return {
    models: {
      list: vi.fn().mockReturnValue(asyncIter()),
    },
  };
}

// Mock the openai package so getClient() doesn't do real I/O.
// Must be declared before vi.mock() to be used inside the factory.
const mockOpenAIConstructor = vi.fn();
vi.mock('openai', () => ({
  default: mockOpenAIConstructor,
}));

// ---------------------------------------------------------------------------
// Default mock implementations
// ---------------------------------------------------------------------------

const DEFAULT_ENDPOINT = {
  host: '192.168.188.11',
  port: 1234,
  source: 'primary' as const,
  state: 'connected' as const,
};

const DEFAULT_PROBE = {
  state: 'connected' as const,
  latencyMs: 12,
  modelsLoaded: 2,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<OptaConfig> = {}): OptaConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    connection: {
      ...DEFAULT_CONFIG.connection,
      ...(overrides.connection ?? {}),
    },
    provider: {
      ...DEFAULT_CONFIG.provider,
      ...(overrides.provider ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Test lifecycle — reset mocks and re-apply default implementations
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.clearAllMocks();

  // Re-apply default implementations so every test starts from a clean,
  // predictable state without relying on vi.mock() factory init.
  const { resolveLmxEndpoint } = await import('../../src/lmx/endpoints.js');
  vi.mocked(resolveLmxEndpoint).mockResolvedValue(DEFAULT_ENDPOINT);

  const { probeLmxConnection } = await import('../../src/lmx/connection.js');
  vi.mocked(probeLmxConnection).mockResolvedValue(DEFAULT_PROBE);

  const { resolveLmxApiKeyAsync } = await import('../../src/lmx/api-key.js');
  vi.mocked(resolveLmxApiKeyAsync).mockResolvedValue('opta-lmx');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LmxProvider — identity', () => {
  it('reports name as "lmx"', () => {
    const provider = new LmxProvider(makeConfig());
    expect(provider.name).toBe('lmx');
  });
});

describe('LmxProvider — baseURL', () => {
  it('constructs the base URL from config host and port before any resolution', () => {
    const config = makeConfig({
      connection: { ...DEFAULT_CONFIG.connection, host: '192.168.188.11', port: 1234 },
    });
    const provider = new LmxProvider(config);
    expect(provider.baseURL).toBe('http://192.168.188.11:1234/v1');
  });

  it('reflects localhost when configured as host', () => {
    const config = makeConfig({
      connection: { ...DEFAULT_CONFIG.connection, host: 'localhost', port: 9999 },
    });
    const provider = new LmxProvider(config);
    expect(provider.baseURL).toBe('http://localhost:9999/v1');
  });

  it('embeds a custom port in the base URL', () => {
    const config = makeConfig({
      connection: { ...DEFAULT_CONFIG.connection, host: '10.0.0.1', port: 8080 },
    });
    const provider = new LmxProvider(config);
    expect(provider.baseURL).toBe('http://10.0.0.1:8080/v1');
  });
});

describe('LmxProvider — getClient', () => {
  it('returns an OpenAI client instance', async () => {
    const fakeClient = makeMockOpenAI();
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    const client = await provider.getClient();

    expect(client).toBe(fakeClient);
    expect(mockOpenAIConstructor).toHaveBeenCalledOnce();
  });

  it('caches the client — constructor is only called once on repeated calls', async () => {
    const fakeClient = makeMockOpenAI();
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    const first = await provider.getClient();
    const second = await provider.getClient();

    expect(first).toBe(second);
    expect(mockOpenAIConstructor).toHaveBeenCalledOnce();
  });

  it('passes the resolved API key to the OpenAI constructor', async () => {
    const { resolveLmxApiKeyAsync } = await import('../../src/lmx/api-key.js');
    vi.mocked(resolveLmxApiKeyAsync).mockResolvedValue('my-test-api-key');

    const fakeClient = makeMockOpenAI();
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    await provider.getClient();

    const callArgs = mockOpenAIConstructor.mock.calls[0]?.[0] as { apiKey?: string };
    expect(callArgs?.apiKey).toBe('my-test-api-key');
  });

  it('passes the inferenceTimeout to the OpenAI constructor', async () => {
    const fakeClient = makeMockOpenAI();
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const config = makeConfig({
      connection: { ...DEFAULT_CONFIG.connection, inferenceTimeout: 60_000 },
    });
    const provider = new LmxProvider(config);
    await provider.getClient();

    const callArgs = mockOpenAIConstructor.mock.calls[0]?.[0] as { timeout?: number };
    expect(callArgs?.timeout).toBe(60_000);
  });

  it('calls resolveLmxEndpoint to obtain the active host', async () => {
    const { resolveLmxEndpoint } = await import('../../src/lmx/endpoints.js');
    const fakeClient = makeMockOpenAI();
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    await provider.getClient();

    expect(vi.mocked(resolveLmxEndpoint)).toHaveBeenCalledOnce();
  });

  it('updates baseURL to the resolved (fallback) host after getClient()', async () => {
    const { resolveLmxEndpoint } = await import('../../src/lmx/endpoints.js');
    vi.mocked(resolveLmxEndpoint).mockResolvedValueOnce({
      host: '10.99.0.5',
      port: 1234,
      source: 'fallback',
      state: 'connected',
    });

    const fakeClient = makeMockOpenAI();
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const config = makeConfig({
      connection: { ...DEFAULT_CONFIG.connection, host: '192.168.188.11', port: 1234 },
    });
    const provider = new LmxProvider(config);
    await provider.getClient();

    // After resolution, baseURL should use the resolved (fallback) host
    expect(provider.baseURL).toBe('http://10.99.0.5:1234/v1');
  });
});

describe('LmxProvider — listModels', () => {
  it('returns a list of ProviderModelInfo from the OpenAI models endpoint', async () => {
    const fakeClient = makeMockOpenAI([
      { id: 'llama-3-8b' },
      { id: 'qwen2.5-72b' },
    ]);
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    const models = await provider.listModels();

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({ id: 'llama-3-8b', name: 'llama-3-8b' });
    expect(models[1]).toEqual({ id: 'qwen2.5-72b', name: 'qwen2.5-72b' });
  });

  it('returns an empty list when no models are available', async () => {
    const fakeClient = makeMockOpenAI([]);
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    const models = await provider.listModels();

    expect(models).toHaveLength(0);
  });

  it('maps model.id to both id and name fields', async () => {
    const fakeClient = makeMockOpenAI([{ id: 'my-custom-model' }]);
    mockOpenAIConstructor.mockReturnValue(fakeClient);

    const provider = new LmxProvider(makeConfig());
    const models = await provider.listModels();

    expect(models[0]?.id).toBe('my-custom-model');
    expect(models[0]?.name).toBe('my-custom-model');
  });
});

describe('LmxProvider — health', () => {
  it('returns ok:true when the connection probe reports connected', async () => {
    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'connected',
      latencyMs: 8,
      modelsLoaded: 3,
    });

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBe(8);
    expect(result.loadedModels).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it('returns ok:true for degraded state (server reachable but no models)', async () => {
    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'degraded',
      latencyMs: 20,
      modelsLoaded: 0,
    });

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(true);
  });

  it('returns ok:false when the connection is disconnected', async () => {
    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'disconnected',
      latencyMs: 100,
      reason: 'ECONNREFUSED',
    });

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });

  it('returns ok:false with "LMX unreachable" when disconnected and reason is absent', async () => {
    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'disconnected',
      latencyMs: 50,
    });

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('LMX unreachable');
  });

  it('returns ok:false and captures the thrown error message when probe throws', async () => {
    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockRejectedValueOnce(new Error('Network failure'));

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network failure');
  });

  it('returns ok:false when resolveLmxEndpoint itself throws', async () => {
    const { resolveLmxEndpoint } = await import('../../src/lmx/endpoints.js');
    vi.mocked(resolveLmxEndpoint).mockRejectedValueOnce(new Error('Endpoint unreachable'));

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Endpoint unreachable');
  });

  it('reports loadedModels as 0 when the probe omits modelsLoaded', async () => {
    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'connected',
      latencyMs: 5,
      // modelsLoaded intentionally omitted
    });

    const provider = new LmxProvider(makeConfig());
    const result = await provider.health();

    expect(result.ok).toBe(true);
    expect(result.loadedModels).toBe(0);
  });

  it('forwards the resolved endpoint host to probeLmxConnection', async () => {
    const { resolveLmxEndpoint } = await import('../../src/lmx/endpoints.js');
    vi.mocked(resolveLmxEndpoint).mockResolvedValueOnce({
      host: '192.168.188.11',
      port: 1234,
      source: 'primary',
      state: 'connected',
    });

    const { probeLmxConnection } = await import('../../src/lmx/connection.js');
    vi.mocked(probeLmxConnection).mockResolvedValueOnce({
      state: 'connected',
      latencyMs: 5,
      modelsLoaded: 1,
    });

    const config = makeConfig({
      connection: { ...DEFAULT_CONFIG.connection, host: '192.168.188.11', port: 1234 },
    });
    const provider = new LmxProvider(config);
    await provider.health();

    expect(vi.mocked(probeLmxConnection)).toHaveBeenCalledWith(
      '192.168.188.11',
      1234,
      expect.objectContaining({ timeoutMs: 5000 }),
    );
  });
});
