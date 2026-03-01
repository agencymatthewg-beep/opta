import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/keychain/api-keys.js', () => ({
  getLmxKey: vi.fn(),
}));

import { getLmxKey } from '../../src/keychain/api-keys.js';
import { resolveLmxApiKey, resolveLmxApiKeyAsync } from '../../src/lmx/api-key.js';

const ORIGINAL_OPTA_API_KEY = process.env['OPTA_API_KEY'];

afterEach(() => {
  vi.clearAllMocks();
  if (ORIGINAL_OPTA_API_KEY === undefined) {
    delete process.env['OPTA_API_KEY'];
    return;
  }
  process.env['OPTA_API_KEY'] = ORIGINAL_OPTA_API_KEY;
});

describe('resolveLmxApiKey', () => {
  it('uses connection.apiKey when provided', () => {
    delete process.env['OPTA_API_KEY'];
    expect(resolveLmxApiKey({ apiKey: 'cfg-key' })).toBe('cfg-key');
  });

  it('falls back to opta-lmx when connection.apiKey is absent', () => {
    delete process.env['OPTA_API_KEY'];
    expect(resolveLmxApiKey({})).toBe('opta-lmx');
  });

  it('uses OPTA_API_KEY over connection.apiKey', () => {
    process.env['OPTA_API_KEY'] = 'env-key';
    expect(resolveLmxApiKey({ apiKey: 'cfg-key' })).toBe('env-key');
  });
});

describe('resolveLmxApiKeyAsync', () => {
  it('uses keychain value when env/config are absent', async () => {
    delete process.env['OPTA_API_KEY'];
    vi.mocked(getLmxKey).mockResolvedValue('keychain-key');

    await expect(resolveLmxApiKeyAsync({})).resolves.toBe('keychain-key');
    expect(getLmxKey).toHaveBeenCalledOnce();
  });

  it('falls back to opta-lmx when env/config/keychain are absent', async () => {
    delete process.env['OPTA_API_KEY'];
    vi.mocked(getLmxKey).mockResolvedValue(null);

    await expect(resolveLmxApiKeyAsync({})).resolves.toBe('opta-lmx');
  });

  it('uses connection.apiKey over keychain', async () => {
    delete process.env['OPTA_API_KEY'];
    vi.mocked(getLmxKey).mockResolvedValue('keychain-key');

    await expect(resolveLmxApiKeyAsync({ apiKey: 'cfg-key' })).resolves.toBe('cfg-key');
    expect(getLmxKey).not.toHaveBeenCalled();
  });

  it('uses OPTA_API_KEY over config and keychain', async () => {
    process.env['OPTA_API_KEY'] = 'env-key';
    vi.mocked(getLmxKey).mockResolvedValue('keychain-key');

    await expect(resolveLmxApiKeyAsync({ apiKey: 'cfg-key' })).resolves.toBe('env-key');
    expect(getLmxKey).not.toHaveBeenCalled();
  });
});
