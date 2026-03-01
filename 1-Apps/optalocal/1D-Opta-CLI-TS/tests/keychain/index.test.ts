/**
 * tests/keychain/index.test.ts
 *
 * Unit tests for the cross-platform keychain module.
 * OS commands are mocked via vi.mock — no real keychain is touched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Capture mock factories before any imports
// ---------------------------------------------------------------------------

const mockExecImpl = vi.fn();

vi.mock('../../src/core/debug.js', () => ({
  verbose: vi.fn(),
}));

// We intercept the promisified execFile by mocking the whole child_process
// module and returning our mock from promisify's result.
vi.mock('node:child_process', () => ({
  execFile: mockExecImpl,
}));

vi.mock('node:util', () => ({
  promisify: (_fn: unknown) => mockExecImpl,
}));

// ---------------------------------------------------------------------------
// Helper to override process.platform at runtime
// ---------------------------------------------------------------------------

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// macOS tests
// ---------------------------------------------------------------------------

describe('keychain — macOS', () => {
  beforeEach(() => {
    setPlatform('darwin');
    vi.resetModules();
    mockExecImpl.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('isKeychainAvailable returns true on darwin', async () => {
    const { isKeychainAvailable } = await import('../../src/keychain/index.js');
    expect(isKeychainAvailable()).toBe(true);
  });

  it('getSecret returns trimmed stdout on success', async () => {
    mockExecImpl.mockResolvedValueOnce({ stdout: 'sk-ant-secret-key\n', stderr: '' });

    const { getSecret } = await import('../../src/keychain/index.js');
    const result = await getSecret('opta-cli', 'anthropic-api-key');

    expect(result).toBe('sk-ant-secret-key');
    expect(mockExecImpl).toHaveBeenCalledWith('security', [
      'find-generic-password',
      '-s', 'opta-cli',
      '-a', 'anthropic-api-key',
      '-w',
    ]);
  });

  it('getSecret returns null when security exits with code 44 (item not found)', async () => {
    const notFoundErr = Object.assign(new Error('SecKeychainSearchCopyNext: item not found'), {
      code: 44,
    });
    mockExecImpl.mockRejectedValueOnce(notFoundErr);

    const { getSecret } = await import('../../src/keychain/index.js');
    const result = await getSecret('opta-cli', 'anthropic-api-key');

    expect(result).toBeNull();
  });

  it('getSecret returns null on unexpected error without throwing', async () => {
    mockExecImpl.mockRejectedValueOnce(new Error('security: command not found'));

    const { getSecret } = await import('../../src/keychain/index.js');
    const result = await getSecret('opta-cli', 'lmx-api-key');

    expect(result).toBeNull();
  });

  it('setSecret calls security add-generic-password with -U flag', async () => {
    mockExecImpl.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const { setSecret } = await import('../../src/keychain/index.js');
    await setSecret('opta-cli', 'lmx-api-key', 'opta_sk_abc123');

    expect(mockExecImpl).toHaveBeenCalledWith('security', [
      'add-generic-password',
      '-s', 'opta-cli',
      '-a', 'lmx-api-key',
      '-w', 'opta_sk_abc123',
      '-U',
    ]);
  });

  it('setSecret resolves without throwing on error', async () => {
    mockExecImpl.mockRejectedValueOnce(new Error('access denied'));

    const { setSecret } = await import('../../src/keychain/index.js');
    await expect(setSecret('opta-cli', 'anthropic-api-key', 'sk-ant-test')).resolves.toBeUndefined();
  });

  it('deleteSecret calls security delete-generic-password with correct args', async () => {
    mockExecImpl.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const { deleteSecret } = await import('../../src/keychain/index.js');
    await deleteSecret('opta-cli', 'anthropic-api-key');

    expect(mockExecImpl).toHaveBeenCalledWith('security', [
      'delete-generic-password',
      '-s', 'opta-cli',
      '-a', 'anthropic-api-key',
    ]);
  });

  it('deleteSecret handles exit code 44 (item not found) gracefully', async () => {
    const notFoundErr = Object.assign(new Error('item not found'), { code: 44 });
    mockExecImpl.mockRejectedValueOnce(notFoundErr);

    const { deleteSecret } = await import('../../src/keychain/index.js');
    await expect(deleteSecret('opta-cli', 'anthropic-api-key')).resolves.toBeUndefined();
  });

  it('deleteSecret resolves without throwing on unexpected error', async () => {
    mockExecImpl.mockRejectedValueOnce(new Error('permission denied'));

    const { deleteSecret } = await import('../../src/keychain/index.js');
    await expect(deleteSecret('opta-cli', 'anthropic-api-key')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Windows tests (DPAPI fallback store)
// ---------------------------------------------------------------------------

describe('keychain — Windows', () => {
  beforeEach(() => {
    setPlatform('win32');
    process.env['OPTA_WINDOWS_KEYCHAIN_FILE'] = `/tmp/opta-keychain-${Date.now()}-${Math.random()}.json`;
    vi.resetModules();
    mockExecImpl.mockReset();
  });

  afterEach(() => {
    delete process.env['OPTA_WINDOWS_KEYCHAIN_FILE'];
    vi.resetModules();
  });

  it('isKeychainAvailable returns true on Windows', async () => {
    const { isKeychainAvailable } = await import('../../src/keychain/index.js');
    expect(isKeychainAvailable()).toBe(true);
  });

  it('getSecret returns null without spawning any process', async () => {
    const { getSecret } = await import('../../src/keychain/index.js');
    const result = await getSecret('opta-cli', 'anthropic-api-key');

    expect(result).toBeNull();
    expect(mockExecImpl).not.toHaveBeenCalled();
  });

  it('setSecret encrypts via PowerShell and persists fallback entry', async () => {
    mockExecImpl.mockResolvedValueOnce({ stdout: 'encrypted-value\n', stderr: '' });

    const { setSecret } = await import('../../src/keychain/index.js');
    await expect(setSecret('opta-cli', 'lmx-api-key', 'some-key')).resolves.toBeUndefined();

    expect(mockExecImpl).toHaveBeenCalledTimes(1);
    expect(mockExecImpl).toHaveBeenCalledWith(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        expect.stringContaining('ConvertFrom-SecureString'),
      ],
      expect.objectContaining({
        windowsHide: true,
        env: expect.objectContaining({ OPTA_KEYCHAIN_VALUE: 'some-key' }),
      })
    );
  });

  it('deleteSecret removes fallback entry without spawning encryption process', async () => {
    const { deleteSecret } = await import('../../src/keychain/index.js');
    await expect(deleteSecret('opta-cli', 'anthropic-api-key')).resolves.toBeUndefined();
    expect(mockExecImpl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Linux tests
// ---------------------------------------------------------------------------

describe('keychain — Linux', () => {
  beforeEach(() => {
    setPlatform('linux');
    vi.resetModules();
    mockExecImpl.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('isKeychainAvailable returns false before async availability check', async () => {
    // On fresh module load _secretToolAvailable is null → sync returns false
    const { isKeychainAvailable } = await import('../../src/keychain/index.js');
    expect(isKeychainAvailable()).toBe(false);
  });

  it('getSecret checks secret-tool availability then calls lookup', async () => {
    // First: which secret-tool
    mockExecImpl.mockResolvedValueOnce({ stdout: '/usr/bin/secret-tool\n', stderr: '' });
    // Second: secret-tool lookup
    mockExecImpl.mockResolvedValueOnce({ stdout: 'my-lmx-key', stderr: '' });

    const { getSecret } = await import('../../src/keychain/index.js');
    const result = await getSecret('opta-cli', 'lmx-api-key');

    expect(result).toBe('my-lmx-key');
    expect(mockExecImpl).toHaveBeenNthCalledWith(1, 'which', ['secret-tool']);
    expect(mockExecImpl).toHaveBeenNthCalledWith(2, 'secret-tool', [
      'lookup',
      'service', 'opta-cli',
      'account', 'lmx-api-key',
    ]);
  });

  it('getSecret returns null when secret-tool is not in PATH', async () => {
    mockExecImpl.mockRejectedValueOnce(new Error('which: no secret-tool in PATH'));

    const { getSecret } = await import('../../src/keychain/index.js');
    const result = await getSecret('opta-cli', 'anthropic-api-key');

    expect(result).toBeNull();
    expect(mockExecImpl).toHaveBeenCalledTimes(1);
    expect(mockExecImpl).toHaveBeenCalledWith('which', ['secret-tool']);
  });
});
