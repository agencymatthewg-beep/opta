import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mockExecImpl = vi.fn();

vi.mock('../../src/core/debug.js', () => ({
  verbose: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: mockExecImpl,
  spawn: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecImpl,
}));

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });
}

describe('keychain (Windows fallback)', () => {
  let tempDir = '';
  let storePath = '';

  beforeEach(async () => {
    setPlatform('win32');
    vi.resetModules();
    mockExecImpl.mockReset();
    tempDir = await mkdtemp(join(tmpdir(), 'opta-win-keychain-'));
    storePath = join(tempDir, 'keychain-store.json');
    process.env['OPTA_WINDOWS_KEYCHAIN_FILE'] = storePath;
  });

  afterEach(async () => {
    delete process.env['OPTA_WINDOWS_KEYCHAIN_FILE'];
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reports keychain availability on win32', async () => {
    const { isKeychainAvailable } = await import('../../src/keychain/index.js');
    expect(isKeychainAvailable()).toBe(true);
  });

  it('stores, retrieves, and deletes secrets via encrypted fallback store', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { setSecret, getSecret, deleteSecret } = await import('../../src/keychain/index.js');

      mockExecImpl.mockResolvedValueOnce({ stdout: 'ENC_BLOB_1\n', stderr: '' });
      await setSecret('opta-cli', 'anthropic-api-key', 'secret-value');

      const storedRaw = await readFile(storePath, 'utf8');
      const storedJson = JSON.parse(storedRaw) as Record<string, string>;
      expect(storedJson['opta-cli::anthropic-api-key']).toBe('ENC_BLOB_1');

      mockExecImpl.mockResolvedValueOnce({ stdout: 'secret-value\n', stderr: '' });
      const loaded = await getSecret('opta-cli', 'anthropic-api-key');
      expect(loaded).toBe('secret-value');

      await deleteSecret('opta-cli', 'anthropic-api-key');
      const afterDeleteRaw = await readFile(storePath, 'utf8');
      const afterDeleteJson = JSON.parse(afterDeleteRaw) as Record<string, string>;
      expect(afterDeleteJson['opta-cli::anthropic-api-key']).toBeUndefined();

      expect(mockExecImpl).toHaveBeenNthCalledWith(
        1,
        'powershell',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            OPTA_KEYCHAIN_VALUE: 'secret-value',
          }),
        }),
      );
      expect(mockExecImpl).toHaveBeenNthCalledWith(
        2,
        'powershell',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            OPTA_KEYCHAIN_VALUE: 'ENC_BLOB_1',
          }),
        }),
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Windows keychain fallback active'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('returns null when encrypted value exists but decryption fails', async () => {
    const { setSecret, getSecret } = await import('../../src/keychain/index.js');

    mockExecImpl.mockResolvedValueOnce({ stdout: 'ENC_BLOB_2\n', stderr: '' });
    await setSecret('opta-cli', 'lmx-api-key', 'another-secret');

    mockExecImpl.mockRejectedValueOnce(new Error('powershell failed'));
    mockExecImpl.mockRejectedValueOnce(new Error('pwsh failed'));

    const loaded = await getSecret('opta-cli', 'lmx-api-key');
    expect(loaded).toBeNull();
  });
});
