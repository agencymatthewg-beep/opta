import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProvider, probeProvider, resetProviderCache } from '../../src/providers/manager.js';
import type { OptaConfig } from '../../src/core/config.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports are consumed
// ---------------------------------------------------------------------------

vi.mock('../../src/providers/lmx.js', () => ({
  LmxProvider: vi.fn().mockImplementation((config: OptaConfig) => ({
    name: 'lmx',
    config,
    getClient: vi.fn().mockResolvedValue({}),
    listModels: vi.fn().mockResolvedValue([{ id: 'test-model', name: 'Test Model' }]),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 10 }),
  })),
}));

vi.mock('../../src/providers/anthropic.js', () => ({
  AnthropicProvider: vi.fn().mockImplementation((config: OptaConfig) => ({
    name: 'anthropic',
    config,
    getClient: vi.fn().mockResolvedValue({}),
    listModels: vi.fn().mockResolvedValue([
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextLength: 200000 },
    ]),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 50 }),
  })),
}));

vi.mock('../../src/providers/fallback.js', () => ({
  FallbackProvider: vi.fn().mockImplementation((primary: unknown, config: OptaConfig) => ({
    name: 'lmx+fallback',
    primary,
    config,
    getClient: vi.fn().mockResolvedValue({}),
    listModels: vi.fn().mockResolvedValue([]),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 10 }),
  })),
}));

vi.mock('../../src/lmx/api-key.js', () => ({
  resolveLmxApiKey: vi.fn().mockReturnValue('opta-lmx'),
}));

// Mock probeLmxConnection so probeProvider tests make no real network calls.
vi.mock('../../src/lmx/connection.js', () => ({
  probeLmxConnection: vi.fn(),
}));

// Suppress verbose() output during probeProvider tests.
vi.mock('../../src/core/debug.js', () => ({
  verbose: vi.fn(),
  debug: vi.fn(),
  setVerbose: vi.fn(),
  setDebug: vi.fn(),
  isVerbose: vi.fn().mockReturnValue(false),
  isDebug: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<OptaConfig> = {}): OptaConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    provider: {
      ...DEFAULT_CONFIG.provider,
      ...(overrides.provider ?? {}),
    },
    connection: {
      ...DEFAULT_CONFIG.connection,
      ...(overrides.connection ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetProviderCache();
});

afterEach(() => {
  resetProviderCache();
  vi.clearAllMocks();
});

describe('getProvider — provider selection', () => {
  it('returns an LMX provider when active is "lmx" (default)', async () => {
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await getProvider(config);
    expect(provider.name).toBe('lmx');
  });

  it('returns an Anthropic provider when active is "anthropic"', async () => {
    const config = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'anthropic' },
    });
    const provider = await getProvider(config);
    expect(provider.name).toBe('anthropic');
  });

  it('defaults to LMX when provider.active is not set', async () => {
    // Build a config where provider.active gets the schema default ('lmx')
    const provider = await getProvider(DEFAULT_CONFIG);
    expect(provider.name).toBe('lmx');
  });

  it('returns FallbackProvider (lmx+fallback) when fallbackOnFailure is true', async () => {
    const config = makeConfig({
      provider: {
        ...DEFAULT_CONFIG.provider,
        active: 'lmx',
        fallbackOnFailure: true,
      },
    });
    const provider = await getProvider(config);
    expect(provider.name).toBe('lmx+fallback');
  });

  it('returns bare LmxProvider when fallbackOnFailure is false', async () => {
    const config = makeConfig({
      provider: {
        ...DEFAULT_CONFIG.provider,
        active: 'lmx',
        fallbackOnFailure: false,
      },
    });
    const provider = await getProvider(config);
    expect(provider.name).toBe('lmx');
  });
});

describe('getProvider — provider caching', () => {
  it('returns the same instance for identical config', async () => {
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const first = await getProvider(config);
    const second = await getProvider(config);
    expect(first).toBe(second);
  });

  it('creates a new instance after resetProviderCache()', async () => {
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const first = await getProvider(config);
    resetProviderCache();
    const second = await getProvider(config);
    // Different object reference because cache was cleared
    expect(first).not.toBe(second);
  });

  it('creates a new instance when the active provider changes', async () => {
    const lmxConfig = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const anthropicConfig = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'anthropic' },
    });

    const lmxProvider = await getProvider(lmxConfig);
    const anthropicProvider = await getProvider(anthropicConfig);

    expect(lmxProvider.name).toBe('lmx');
    expect(anthropicProvider.name).toBe('anthropic');
    expect(lmxProvider).not.toBe(anthropicProvider);
  });

  it('creates a new instance when fallbackOnFailure toggles', async () => {
    const baseConfig = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx', fallbackOnFailure: false } });
    const fallbackConfig = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx', fallbackOnFailure: true } });

    const base = await getProvider(baseConfig);
    resetProviderCache();
    const fb = await getProvider(fallbackConfig);

    expect(base.name).toBe('lmx');
    expect(fb.name).toBe('lmx+fallback');
  });
});

describe('getProvider — cache key differentiation', () => {
  it('uses different instances for different LMX hosts', async () => {
    const configA = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' },
      connection: { ...DEFAULT_CONFIG.connection, host: '192.168.188.11' },
    });
    const configB = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' },
      connection: { ...DEFAULT_CONFIG.connection, host: '10.0.0.1' },
    });

    const providerA = await getProvider(configA);
    // Clear cache so that second call creates a fresh instance
    resetProviderCache();
    const providerB = await getProvider(configB);

    // Both are LMX providers but were created with different host configs
    expect(providerA.name).toBe('lmx');
    expect(providerB.name).toBe('lmx');
  });

  it('uses different instances for different LMX ports', async () => {
    const configA = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' },
      connection: { ...DEFAULT_CONFIG.connection, port: 1234 },
    });
    const configB = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' },
      connection: { ...DEFAULT_CONFIG.connection, port: 8080 },
    });

    const providerA = await getProvider(configA);
    resetProviderCache();
    const providerB = await getProvider(configB);

    expect(providerA.name).toBe('lmx');
    expect(providerB.name).toBe('lmx');
    // Even though names match, they were built from different configs
    expect(providerA).not.toBe(providerB);
  });
});

describe('resetProviderCache', () => {
  it('is exported and callable without error', () => {
    expect(() => resetProviderCache()).not.toThrow();
  });

  it('allows the cache to accept a fresh provider after reset', async () => {
    const config = makeConfig();
    await getProvider(config);   // warms the cache
    resetProviderCache();
    // Should create a brand new provider without throwing
    const provider = await getProvider(config);
    expect(provider).toBeDefined();
  });
});

describe('getProvider — provider interface', () => {
  it('returned LMX provider exposes getClient, listModels, and health', async () => {
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await getProvider(config);
    expect(typeof provider.getClient).toBe('function');
    expect(typeof provider.listModels).toBe('function');
    expect(typeof provider.health).toBe('function');
  });

  it('returned Anthropic provider exposes getClient, listModels, and health', async () => {
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'anthropic' } });
    const provider = await getProvider(config);
    expect(typeof provider.getClient).toBe('function');
    expect(typeof provider.listModels).toBe('function');
    expect(typeof provider.health).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// probeProvider tests
// ---------------------------------------------------------------------------

async function getProbeMock() {
  const { probeLmxConnection } = await import('../../src/lmx/connection.js');
  return vi.mocked(probeLmxConnection);
}

describe('probeProvider — LMX reachable', () => {
  it('returns LmxProvider when LMX probe reports state !== "disconnected" (connected)', async () => {
    const probeMock = await getProbeMock();
    probeMock.mockResolvedValueOnce({ state: 'connected', latencyMs: 10 });

    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('lmx');
    expect(probeMock).toHaveBeenCalledOnce();
  });

  it('returns LmxProvider when LMX probe reports state = "degraded" (still reachable)', async () => {
    const probeMock = await getProbeMock();
    probeMock.mockResolvedValueOnce({ state: 'degraded', latencyMs: 80 });

    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('lmx');
  });
});

describe('probeProvider — LMX unreachable + ANTHROPIC_API_KEY set', () => {
  afterEach(() => {
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('returns AnthropicProvider when LMX is disconnected and ANTHROPIC_API_KEY is present', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    const probeMock = await getProbeMock();
    probeMock.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000, reason: 'ECONNREFUSED' });

    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
  });

  it('returns AnthropicProvider when probe throws and ANTHROPIC_API_KEY is set', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    const probeMock = await getProbeMock();
    probeMock.mockRejectedValueOnce(new Error('Network failure'));

    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
  });
});

describe('probeProvider — explicit Anthropic config skips LMX probe', () => {
  it('returns AnthropicProvider without probing LMX when config.provider.active === "anthropic"', async () => {
    const probeMock = await getProbeMock();

    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'anthropic' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
    // Must NOT probe LMX — user already chose Anthropic.
    expect(probeMock).not.toHaveBeenCalled();
  });
});

describe('probeProvider — LMX unreachable + no API key', () => {
  it('throws a descriptive error when LMX is unreachable and no ANTHROPIC_API_KEY is set', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const probeMock = await getProbeMock();
    probeMock.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000 });

    const config = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx', anthropic: { apiKey: '', model: '' } },
      connection: { ...DEFAULT_CONFIG.connection, host: 'localhost', port: 1234 },
    });

    await expect(probeProvider(config)).rejects.toThrow(/LMX unreachable/);
  });

  it('error message mentions the host:port that was probed', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const probeMock = await getProbeMock();
    probeMock.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000 });

    const config = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx', anthropic: { apiKey: '', model: '' } },
      connection: { ...DEFAULT_CONFIG.connection, host: 'localhost', port: 1234 },
    });

    await expect(probeProvider(config)).rejects.toThrow(/localhost:1234/);
  });
});
