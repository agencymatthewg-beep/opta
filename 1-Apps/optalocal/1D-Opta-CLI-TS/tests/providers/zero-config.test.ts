/**
 * Zero-config provider fallback tests.
 *
 * probeProvider() must:
 *   1. Return LMX provider when LMX is reachable.
 *   2. Return Anthropic provider silently when LMX is unreachable + API key set.
 *   3. Throw a descriptive error when LMX is unreachable + no API key.
 *   4. Return Anthropic directly when config.provider.active === 'anthropic'.
 *   5. Complete the probe within ≤2 seconds (timeout guard).
 *
 * All network calls are mocked — no real connections are made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OptaConfig } from '../../src/core/config.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Module mocks — hoisted so they apply before any module under test loads
// ---------------------------------------------------------------------------

// Mock probeLmxConnection to control reachability without network I/O.
vi.mock('../../src/lmx/connection.js', () => ({
  probeLmxConnection: vi.fn(),
  isAbortError: vi.fn().mockReturnValue(false),
}));

// Mock providers so we don't need real API clients.
vi.mock('../../src/providers/lmx.js', () => ({
  LmxProvider: vi.fn().mockImplementation((config: OptaConfig) => ({
    name: 'lmx',
    config,
    getClient: vi.fn().mockResolvedValue({}),
    listModels: vi.fn().mockResolvedValue([{ id: 'test-model' }]),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 10 }),
  })),
}));

vi.mock('../../src/providers/anthropic.js', () => ({
  AnthropicProvider: vi.fn().mockImplementation((config: OptaConfig) => ({
    name: 'anthropic',
    config,
    getClient: vi.fn().mockResolvedValue({}),
    listModels: vi.fn().mockResolvedValue([{ id: 'claude-sonnet-4-5-20250929' }]),
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

// Silence verbose output during tests.
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

// Dynamically import after mocks are registered.
async function getProbeProvider() {
  const { probeProvider, resetProviderCache } = await import('../../src/providers/manager.js');
  return { probeProvider, resetProviderCache };
}

async function getProbeLmxConnection() {
  const { probeLmxConnection } = await import('../../src/lmx/connection.js');
  return probeLmxConnection as ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  const { resetProviderCache } = await getProbeProvider();
  resetProviderCache();
  // Clear env vars so tests start in a clean state
  delete process.env['ANTHROPIC_API_KEY'];
});

afterEach(async () => {
  const { resetProviderCache } = await getProbeProvider();
  resetProviderCache();
  vi.clearAllMocks();
  delete process.env['ANTHROPIC_API_KEY'];
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('probeProvider — LMX reachable', () => {
  it('returns an LMX provider when LMX is reachable (state=connected)', async () => {
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'connected', latencyMs: 12 });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('lmx');
    expect(probeLmx).toHaveBeenCalledOnce();
  });

  it('returns an LMX provider when LMX is degraded (state=degraded)', async () => {
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'degraded', latencyMs: 100, reason: 'no_models_loaded' });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    // Degraded but reachable — still use LMX.
    expect(provider.name).toBe('lmx');
  });

  it('probes the configured LMX host and port', async () => {
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'connected', latencyMs: 5 });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' },
      connection: { ...DEFAULT_CONFIG.connection, host: '192.168.188.11', port: 1234 },
    });
    await probeProvider(config);

    expect(probeLmx).toHaveBeenCalledWith('192.168.188.11', 1234, { timeoutMs: 2_000 });
  });
});

describe('probeProvider — LMX unreachable + ANTHROPIC_API_KEY set', () => {
  it('silently returns an Anthropic provider when LMX is disconnected', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000, reason: 'connection refused' });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
  });

  it('silently returns Anthropic when probe throws (network error)', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
  });

  it('uses provider.anthropic.apiKey from config as the Anthropic key (no env var)', async () => {
    // No env var — key comes from config
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 1500 });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({
      provider: {
        ...DEFAULT_CONFIG.provider,
        active: 'lmx',
        anthropic: { apiKey: 'sk-ant-from-config', model: 'claude-opus-4-6' },
      },
    });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
  });

  it('does not log anything to stdout during fallback (silent by default)', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000 });

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'lmx' } });
    await probeProvider(config);

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});

describe('probeProvider — LMX unreachable + no API key', () => {
  it('throws a descriptive error when LMX is down and no ANTHROPIC_API_KEY', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000 });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx', anthropic: { apiKey: '', model: '' } },
      connection: { ...DEFAULT_CONFIG.connection, host: 'localhost', port: 1234 },
    });

    await expect(probeProvider(config)).rejects.toThrow(/LMX unreachable.*localhost:1234/);
  });

  it('error message mentions ANTHROPIC_API_KEY as a fix option', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000 });

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({
      provider: { ...DEFAULT_CONFIG.provider, active: 'lmx', anthropic: { apiKey: '', model: '' } },
    });

    await expect(probeProvider(config)).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('probeProvider — explicit Anthropic config (no LMX probe)', () => {
  it('returns Anthropic directly without probing LMX when active is "anthropic"', async () => {
    const probeLmx = await getProbeLmxConnection();

    const { probeProvider } = await getProbeProvider();
    const config = makeConfig({ provider: { ...DEFAULT_CONFIG.provider, active: 'anthropic' } });
    const provider = await probeProvider(config);

    expect(provider.name).toBe('anthropic');
    // LMX probe must NOT have been called — user already chose Anthropic.
    expect(probeLmx).not.toHaveBeenCalled();
  });
});

describe('probeProvider — no LMX config (fresh install)', () => {
  it('falls back to Anthropic on a fresh install (default localhost:1234 unreachable)', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-fresh-install';
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'disconnected', latencyMs: 2000, reason: 'ECONNREFUSED' });

    const { probeProvider } = await getProbeProvider();
    // Use default config (localhost:1234) — exactly what a fresh install would have.
    const provider = await probeProvider(DEFAULT_CONFIG);

    expect(provider.name).toBe('anthropic');
  });
});

describe('probeProvider — probe timeout constraint', () => {
  it('calls probeLmxConnection with a 2000ms timeout cap', async () => {
    const probeLmx = await getProbeLmxConnection();
    probeLmx.mockResolvedValueOnce({ state: 'connected', latencyMs: 1 });

    const { probeProvider } = await getProbeProvider();
    await probeProvider(DEFAULT_CONFIG);

    const [, , options] = probeLmx.mock.calls[0] as [string, number, { timeoutMs: number }];
    expect(options.timeoutMs).toBeLessThanOrEqual(2_000);
    expect(options.timeoutMs).toBeGreaterThan(0);
  });

  it('does not wait longer than 2s when LMX times out (resolves as disconnected)', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-timeout-test';
    const probeLmx = await getProbeLmxConnection();

    // Simulate a 1.8s probe that ends with disconnected.
    probeLmx.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Keep test fast but realistic
      return { state: 'disconnected', latencyMs: 1800 };
    });

    const { probeProvider } = await getProbeProvider();
    const start = Date.now();
    const provider = await probeProvider(DEFAULT_CONFIG);
    const elapsed = Date.now() - start;

    expect(provider.name).toBe('anthropic');
    // In tests we use a fast mock so elapsed should be well under 2s
    expect(elapsed).toBeLessThan(2_000);
  });
});
