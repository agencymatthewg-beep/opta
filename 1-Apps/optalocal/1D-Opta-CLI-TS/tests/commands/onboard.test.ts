import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const answers: string[] = [];

  return {
    answers,
    question: vi.fn(async () => answers.shift() ?? ''),
    close: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    isKeychainAvailable: vi.fn(),
    storeAnthropicKey: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  };
});

vi.mock('node:readline/promises', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: mocks.question,
      close: mocks.close,
    })),
  },
}));

vi.mock('../../src/core/config.js', () => ({
  loadConfig: mocks.loadConfig,
  saveConfig: mocks.saveConfig,
}));

vi.mock('../../src/keychain/index.js', () => ({
  isKeychainAvailable: mocks.isKeychainAvailable,
}));

vi.mock('../../src/keychain/api-keys.js', () => ({
  storeAnthropicKey: mocks.storeAnthropicKey,
}));

vi.mock('node:fs/promises', () => ({
  access: mocks.access,
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

describe('runOnboarding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.answers.length = 0;
    mocks.loadConfig.mockResolvedValue(null);
    mocks.saveConfig.mockResolvedValue(undefined);
    mocks.isKeychainAvailable.mockReturnValue(true);
    mocks.storeAnthropicKey.mockResolvedValue(true);
    mocks.access.mockRejectedValue(new Error('not found'));
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('stores Anthropic key in keychain and avoids plaintext config when keychain is available', async () => {
    mocks.answers.push(
      '2', // Provider -> Anthropic
      'sk-ant-keychain-value', // API key
      '', // Store in keychain? -> yes (default)
      '', // Autonomy default
      '', // TUI default
      '', // Save config? -> yes
    );

    const { runOnboarding } = await import('../../src/commands/onboard.js');
    await runOnboarding();

    expect(mocks.storeAnthropicKey).toHaveBeenCalledWith('sk-ant-keychain-value');
    expect(mocks.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        'provider.active': 'anthropic',
        'provider.anthropic.apiKey': '',
      }),
    );
  });

  it('falls back to plaintext config when keychain is unavailable', async () => {
    mocks.isKeychainAvailable.mockReturnValue(false);
    mocks.answers.push(
      '2', // Provider -> Anthropic
      'sk-ant-plaintext-value', // API key
      '', // Autonomy default
      '', // TUI default
      '', // Save config? -> yes
    );

    const { runOnboarding } = await import('../../src/commands/onboard.js');
    await runOnboarding();

    expect(mocks.storeAnthropicKey).not.toHaveBeenCalled();
    expect(mocks.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        'provider.active': 'anthropic',
        'provider.anthropic.apiKey': 'sk-ant-plaintext-value',
      }),
    );
  });
});
