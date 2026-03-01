import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState } from '../../src/accounts/types.js';

const TEST_ACCOUNTS_URL = 'https://test-accounts.example.com';

function makeState(overrides: Partial<AccountState> = {}): AccountState {
  return {
    project: 'test-project',
    session: {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
    },
    user: { id: 'user-123', email: 'test@example.com' },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('cloud.ts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env['OPTA_ACCOUNTS_URL'] = TEST_ACCOUNTS_URL;
  });

  afterEach(() => {
    delete process.env['OPTA_ACCOUNTS_URL'];
    vi.unstubAllGlobals();
  });

  // ───────────────────────── listCloudApiKeys ─────────────────────────

  describe('listCloudApiKeys', () => {
    it('returns empty array when state is null', async () => {
      const { listCloudApiKeys } = await import('../../src/accounts/cloud.js');
      const result = await listCloudApiKeys(null);
      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns empty array when no access token', async () => {
      const { listCloudApiKeys } = await import('../../src/accounts/cloud.js');
      const result = await listCloudApiKeys(makeState({ session: null }));
      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns mapped entries from API response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [
              {
                id: 'key-1',
                provider: 'anthropic',
                label: 'primary',
                key_value: 'sk-ant-xxx',
                updated_at: '2026-03-01T00:00:00Z',
              },
              {
                id: 'key-2',
                provider: 'openai',
                label: null,
                key_value: 'sk-oai-yyy',
                updated_at: '2026-02-28T00:00:00Z',
              },
            ],
          }),
      });

      const { listCloudApiKeys } = await import('../../src/accounts/cloud.js');
      const result = await listCloudApiKeys(makeState());

      expect(result).toEqual([
        {
          id: 'key-1',
          provider: 'anthropic',
          label: 'primary',
          keyValue: 'sk-ant-xxx',
          updatedAt: '2026-03-01T00:00:00Z',
        },
        {
          id: 'key-2',
          provider: 'openai',
          label: null,
          keyValue: 'sk-oai-yyy',
          updatedAt: '2026-02-28T00:00:00Z',
        },
      ]);
    });

    it('filters by provider when provided (check URL searchParam)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ keys: [] }),
      });

      const { listCloudApiKeys } = await import('../../src/accounts/cloud.js');
      await listCloudApiKeys(makeState(), 'Anthropic');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('provider')).toBe('anthropic');
    });

    it('returns empty array on non-ok response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { listCloudApiKeys } = await import('../../src/accounts/cloud.js');
      const result = await listCloudApiKeys(makeState());
      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));

      const { listCloudApiKeys } = await import('../../src/accounts/cloud.js');
      const result = await listCloudApiKeys(makeState());
      expect(result).toEqual([]);
    });
  });

  // ───────────────────────── storeCloudApiKey ─────────────────────────

  describe('storeCloudApiKey', () => {
    it('returns false when state is null', async () => {
      const { storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await storeCloudApiKey(null, 'anthropic', 'sk-xxx');
      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns false when no access token', async () => {
      const { storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await storeCloudApiKey(makeState({ session: null }), 'anthropic', 'sk-xxx');
      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POSTs to /api/keys with correct body', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 201 });

      const { storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      await storeCloudApiKey(makeState(), 'Anthropic', 'sk-ant-xxx', 'my-label');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${TEST_ACCOUNTS_URL}/api/keys`);
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body).toEqual({
        provider: 'anthropic',
        keyValue: 'sk-ant-xxx',
        label: 'my-label',
      });
    });

    it('returns true on 201 response', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 201 });

      const { storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await storeCloudApiKey(makeState(), 'anthropic', 'sk-ant-xxx');
      expect(result).toBe(true);
    });

    it('returns false on non-ok response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 403 });

      const { storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await storeCloudApiKey(makeState(), 'anthropic', 'sk-ant-xxx');
      expect(result).toBe(false);
    });

    it('invalidates cache: subsequent resolveCloudApiKey makes a new fetch', async () => {
      const state = makeState();

      // First: populate cache via resolveCloudApiKey
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ id: 'k1', provider: 'anthropic', label: null, key_value: 'old-key', updated_at: '2026-01-01' }],
          }),
      });

      const { resolveCloudApiKey, storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const firstResolve = await resolveCloudApiKey(state, 'anthropic');
      expect(firstResolve).toBe('old-key');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second: store a new key (invalidates cache)
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      await storeCloudApiKey(state, 'anthropic', 'new-key');
      expect(fetchMock).toHaveBeenCalledTimes(2); // store call

      // Third: resolveCloudApiKey should fetch again (cache invalidated)
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ id: 'k2', provider: 'anthropic', label: null, key_value: 'new-key', updated_at: '2026-03-01' }],
          }),
      });
      const secondResolve = await resolveCloudApiKey(state, 'anthropic');
      expect(secondResolve).toBe('new-key');
      expect(fetchMock).toHaveBeenCalledTimes(3); // re-fetch after invalidation
    });

    it('returns false on network error', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));

      const { storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await storeCloudApiKey(makeState(), 'anthropic', 'sk-ant-xxx');
      expect(result).toBe(false);
    });
  });

  // ───────────────────────── deleteCloudApiKey ─────────────────────────

  describe('deleteCloudApiKey', () => {
    it('returns false when state is null', async () => {
      const { deleteCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await deleteCloudApiKey(null, 'key-id-123');
      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns false when no access token', async () => {
      const { deleteCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await deleteCloudApiKey(makeState({ session: null }), 'key-id-123');
      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('DELETEs to /api/keys/{encoded-id}', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const { deleteCloudApiKey } = await import('../../src/accounts/cloud.js');
      await deleteCloudApiKey(makeState(), 'key/with special&chars');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${TEST_ACCOUNTS_URL}/api/keys/${encodeURIComponent('key/with special&chars')}`);
      expect(opts.method).toBe('DELETE');
    });

    it('returns true on 200 response', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const { deleteCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await deleteCloudApiKey(makeState(), 'key-id-123');
      expect(result).toBe(true);
    });

    it('returns false on non-ok response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      const { deleteCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await deleteCloudApiKey(makeState(), 'key-id-123');
      expect(result).toBe(false);
    });

    it('invalidates cache when provider is provided', async () => {
      const state = makeState();

      // Populate cache
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ id: 'k1', provider: 'anthropic', label: null, key_value: 'cached-key', updated_at: '2026-01-01' }],
          }),
      });

      const { resolveCloudApiKey, deleteCloudApiKey } = await import('../../src/accounts/cloud.js');
      const first = await resolveCloudApiKey(state, 'anthropic');
      expect(first).toBe('cached-key');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Delete with provider — should invalidate cache
      fetchMock.mockResolvedValue({ ok: true, status: 200 });
      await deleteCloudApiKey(state, 'k1', 'anthropic');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Next resolve should fetch again
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ keys: [] }),
      });
      const second = await resolveCloudApiKey(state, 'anthropic');
      expect(second).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ───────────────────────── resolveCloudApiKey ─────────────────────────

  describe('resolveCloudApiKey', () => {
    it('returns first entry keyValue from listCloudApiKeys (most recent)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [
              { id: 'k1', provider: 'anthropic', label: 'latest', key_value: 'sk-latest', updated_at: '2026-03-01' },
              { id: 'k2', provider: 'anthropic', label: 'older', key_value: 'sk-older', updated_at: '2026-01-01' },
            ],
          }),
      });

      const { resolveCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await resolveCloudApiKey(makeState(), 'anthropic');
      expect(result).toBe('sk-latest');
    });

    it('returns null when listCloudApiKeys returns empty', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ keys: [] }),
      });

      const { resolveCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await resolveCloudApiKey(makeState(), 'anthropic');
      expect(result).toBeNull();
    });

    it('caches result and returns cached value on second call (no second fetch)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ id: 'k1', provider: 'openai', label: null, key_value: 'sk-cached', updated_at: '2026-01-01' }],
          }),
      });

      const { resolveCloudApiKey } = await import('../../src/accounts/cloud.js');
      const state = makeState();

      const first = await resolveCloudApiKey(state, 'openai');
      expect(first).toBe('sk-cached');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const second = await resolveCloudApiKey(state, 'openai');
      expect(second).toBe('sk-cached');
      expect(fetchMock).toHaveBeenCalledTimes(1); // no additional fetch
    });

    it('cache is invalidated by storeCloudApiKey', async () => {
      const state = makeState();

      // Populate cache
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ id: 'k1', provider: 'anthropic', label: null, key_value: 'old-val', updated_at: '2026-01-01' }],
          }),
      });

      const { resolveCloudApiKey, storeCloudApiKey } = await import('../../src/accounts/cloud.js');
      const first = await resolveCloudApiKey(state, 'anthropic');
      expect(first).toBe('old-val');

      // Store invalidates cache
      fetchMock.mockResolvedValue({ ok: true, status: 201 });
      await storeCloudApiKey(state, 'anthropic', 'new-val');

      // Next resolve fetches again
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ id: 'k2', provider: 'anthropic', label: null, key_value: 'new-val', updated_at: '2026-03-01' }],
          }),
      });
      const second = await resolveCloudApiKey(state, 'anthropic');
      expect(second).toBe('new-val');
      expect(fetchMock).toHaveBeenCalledTimes(3); // initial resolve + store + re-resolve
    });

    it('returns null when state is null', async () => {
      const { resolveCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await resolveCloudApiKey(null, 'anthropic');
      expect(result).toBeNull();
    });

    it('returns null when no project', async () => {
      const { resolveCloudApiKey } = await import('../../src/accounts/cloud.js');
      const result = await resolveCloudApiKey(makeState({ project: '' }), 'anthropic');
      expect(result).toBeNull();
    });
  });
});
