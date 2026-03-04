import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type OptaConfig } from '../../src/core/config.js';

const mocks = vi.hoisted(() => ({
  getKeyByProvider: vi.fn<(provider: string) => Promise<string | null>>(),
  loadAccountState: vi.fn<() => Promise<unknown>>(),
  resolveCloudApiKey: vi.fn<(state: unknown, provider: string) => Promise<string | null>>(),
  openaiCtor: vi.fn(),
}));

vi.mock('openai', () => ({
  default: mocks.openaiCtor,
}));

vi.mock('../../src/keychain/api-keys.js', () => ({
  getKeyByProvider: mocks.getKeyByProvider,
}));

vi.mock('../../src/accounts/storage.js', () => ({
  loadAccountState: mocks.loadAccountState,
}));

vi.mock('../../src/accounts/cloud.js', () => ({
  resolveCloudApiKey: mocks.resolveCloudApiKey,
}));

function makeConfig(anthropicApiKey = ''): OptaConfig {
  return {
    ...DEFAULT_CONFIG,
    provider: {
      ...DEFAULT_CONFIG.provider,
      active: 'anthropic',
      anthropic: {
        ...DEFAULT_CONFIG.provider.anthropic,
        apiKey: anthropicApiKey,
      },
    },
  };
}

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['CLAUDE_API_KEY'];

    mocks.getKeyByProvider.mockResolvedValue(null);
    mocks.loadAccountState.mockResolvedValue({});
    mocks.resolveCloudApiKey.mockResolvedValue(null);
    mocks.openaiCtor.mockImplementation(function(opts: unknown) { return { opts }; });
  });

  it('prefers config key over env and keychain', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env-value';
    mocks.getKeyByProvider.mockResolvedValue('sk-ant-keychain-value');

    const { AnthropicProvider } = await import('../../src/providers/anthropic.js');
    const provider = new AnthropicProvider(makeConfig('sk-ant-config-value'));

    await provider.getClient();

    expect(mocks.openaiCtor).toHaveBeenCalledTimes(1);
    expect(mocks.openaiCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-ant-config-value',
      }),
    );
    expect(mocks.getKeyByProvider).not.toHaveBeenCalled();
  });

  it('falls back to ANTHROPIC_API_KEY when config key is empty', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env-value';

    const { AnthropicProvider } = await import('../../src/providers/anthropic.js');
    const provider = new AnthropicProvider(makeConfig(''));

    await provider.getClient();

    expect(mocks.openaiCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-ant-env-value',
      }),
    );
    expect(mocks.getKeyByProvider).not.toHaveBeenCalled();
  });

  it('falls back to keychain when config and env keys are missing', async () => {
    mocks.getKeyByProvider.mockResolvedValue('sk-ant-keychain-value');

    const { AnthropicProvider } = await import('../../src/providers/anthropic.js');
    const provider = new AnthropicProvider(makeConfig(''));

    await provider.getClient();

    expect(mocks.getKeyByProvider).toHaveBeenCalledTimes(1);
    expect(mocks.getKeyByProvider).toHaveBeenCalledWith('anthropic');
    expect(mocks.openaiCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-ant-keychain-value',
      }),
    );
  });

  it('throws a clear error when no Anthropic key is available from any source', async () => {
    const { AnthropicProvider } = await import('../../src/providers/anthropic.js');
    const provider = new AnthropicProvider(makeConfig(''));

    await expect(provider.getClient()).rejects.toThrow(/opta keychain set-anthropic/);
  });

  it('health reports missing key with all checked sources', async () => {
    const { AnthropicProvider } = await import('../../src/providers/anthropic.js');
    const provider = new AnthropicProvider(makeConfig(''));

    const result = await provider.health();

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/config, ANTHROPIC_API_KEY, keychain, and Opta Accounts cloud/i);
  });

  it('health uses keychain key when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    mocks.getKeyByProvider.mockResolvedValue('sk-ant-keychain-value');

    const { AnthropicProvider } = await import('../../src/providers/anthropic.js');
    const provider = new AnthropicProvider(makeConfig(''));

    const result = await provider.health();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-keychain-value',
        }),
      }),
    );
  });
});
