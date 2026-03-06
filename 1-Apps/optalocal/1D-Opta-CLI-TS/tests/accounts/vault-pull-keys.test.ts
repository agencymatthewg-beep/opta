import { describe, expect, it, vi, beforeEach } from 'vitest';
import { pullVaultKeys, syncVault } from '../../src/accounts/vault.js';
import type { AccountState } from '../../src/accounts/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_STATE: AccountState = {
  session: { access_token: 'test-token-abc', refresh_token: 'rt', expires_at: 9999999999 },
  user: { id: 'u1', email: 'test@opta.local' },
} as unknown as AccountState;

const MOCK_KEY_ENTRY = (provider: string, label: string | null = null) => ({
  id: `key-${provider}`,
  provider,
  label,
  key_value: `sk-${provider}-test-value`,
  is_active: true,
  updated_at: '2026-03-06T00:00:00Z',
});

// ---------------------------------------------------------------------------
// pullVaultKeys — unit tests with mocked fetch + keychain
// ---------------------------------------------------------------------------

vi.mock('../../src/keychain/api-keys.js', () => ({
  storeKeyByProvider: vi.fn().mockResolvedValue(undefined),
}));

// Mock getConfigDir so vault-state.json write does not hit disk
vi.mock('../../src/platform/paths.js', () => ({
  getConfigDir: vi.fn(() => '/tmp/opta-test-config'),
}));

// Prevent actual fs writes
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pullVaultKeys', () => {
  it('returns not_authenticated for null state', async () => {
    const result = await pullVaultKeys(null);
    expect(result.errors).toContain('not_authenticated');
    expect(result.synced).toBe(0);
    expect(result.syncedKeys).toEqual([]);
  });

  it('returns not_authenticated when access_token is empty', async () => {
    const state = { session: { access_token: '  ' } } as unknown as AccountState;
    const result = await pullVaultKeys(state);
    expect(result.errors).toContain('not_authenticated');
    expect(result.syncedKeys).toEqual([]);
  });

  it('syncs keys and populates syncedKeys on 200 response', async () => {
    const keys = [MOCK_KEY_ENTRY('anthropic', 'main'), MOCK_KEY_ENTRY('openai')];
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => '"etag-test-123"' },
      json: async () => ({ keys, count: 2, syncedAt: '2026-03-06T00:00:00Z' }),
    } as unknown as Response);

    const result = await pullVaultKeys(MOCK_STATE);

    expect(result.synced).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.syncedKeys).toEqual([
      { provider: 'anthropic', label: 'main' },
      { provider: 'openai', label: null },
    ]);
  });

  it('returns cached:true and empty syncedKeys on 304', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 304,
      ok: false,
      headers: { get: () => null },
    } as unknown as Response);

    const result = await pullVaultKeys(MOCK_STATE);

    expect(result.cached).toBe(true);
    expect(result.synced).toBe(0);
    expect(result.syncedKeys).toEqual([]);
  });

  it('reports error and empty syncedKeys on 503', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      headers: { get: () => null },
    } as unknown as Response);

    const result = await pullVaultKeys(MOCK_STATE);

    expect(result.errors).toContain('vault_sync_unavailable:schema_not_migrated');
    expect(result.syncedKeys).toEqual([]);
  });

  it('reports network_error and empty syncedKeys on fetch throw', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await pullVaultKeys(MOCK_STATE);

    expect(result.errors[0]).toMatch(/network_error/);
    expect(result.syncedKeys).toEqual([]);
  });

  it('skips entries with empty key_value', async () => {
    const keys = [
      { ...MOCK_KEY_ENTRY('anthropic'), key_value: '' },
      MOCK_KEY_ENTRY('openai'),
    ];
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => ({ keys, count: 2, syncedAt: '' }),
    } as unknown as Response);

    const result = await pullVaultKeys(MOCK_STATE);

    expect(result.skipped).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.syncedKeys.map((k) => k.provider)).toEqual(['openai']);
  });
});

describe('syncVault', () => {
  it('returns syncedKeys from pullVaultKeys in keys field', async () => {
    const mockKeys = [MOCK_KEY_ENTRY('gemini')];
    global.fetch = vi.fn()
      // First call = keys, second call = rules
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => null },
        json: async () => ({ keys: mockKeys, count: 1, syncedAt: '' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => null },
        json: async () => ({ content: null, configured: false }),
      } as unknown as Response);

    const result = await syncVault(MOCK_STATE);

    expect(result.keys.synced).toBe(1);
    expect(result.keys.syncedKeys).toEqual([{ provider: 'gemini', label: null }]);
    expect(result.rules.configured).toBe(false);
  });
});
