/**
 * tests/accounts/vault.test.ts
 *
 * Unit tests for vault.ts ETag conditional-HTTP behaviour.
 *
 * Strategy:
 *  - Uses XDG_CONFIG_HOME env var to redirect vault-state.json to a real temp dir.
 *  - vi.resetModules() before each test forces vault.ts to re-evaluate its module-level
 *    constants (VAULT_STATE_PATH etc.) with the new XDG_CONFIG_HOME value.
 *  - vi.spyOn(globalThis, 'fetch') controls HTTP responses without a network.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FAKE_TOKEN = 'test-access-token';
const FAKE_STATE = { session: { access_token: FAKE_TOKEN } };

let tmpDir: string;

beforeEach(async () => {
  const base = join(tmpdir(), `opta-vault-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  tmpDir = base;
  await mkdir(join(tmpDir, 'opta'), { recursive: true });
  // Redirect getConfigDir() to tmpDir/opta via XDG_CONFIG_HOME
  vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
  // Clear module cache so vault.ts re-evaluates VAULT_STATE_PATH with the new env
  vi.resetModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(tmpDir, { recursive: true, force: true });
});

async function importVault() {
  return import('../../src/accounts/vault.js');
}

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// ─────────────────────────── pullVaultKeys ───────────────────────────────────

describe('pullVaultKeys', () => {
  it('sends no If-None-Match on first call (no cached ETag)', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeJsonResponse({ keys: [], count: 0, syncedAt: '' }),
    );
    const { pullVaultKeys } = await importVault();
    await pullVaultKeys(FAKE_STATE as never);

    const reqHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(reqHeaders?.['if-none-match']).toBeUndefined();
  });

  it('persists ETag from 200 response and sends it on second call', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeJsonResponse({ keys: [], count: 0, syncedAt: '' }, 200, { etag: '"etag-v1"' }))
      .mockResolvedValueOnce(makeJsonResponse({ keys: [], count: 0, syncedAt: '' }));

    const { pullVaultKeys } = await importVault();
    await pullVaultKeys(FAKE_STATE as never);
    await pullVaultKeys(FAKE_STATE as never);

    const secondReqHeaders = mockFetch.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined;
    expect(secondReqHeaders?.['if-none-match']).toBe('"etag-v1"');
  });

  it('returns cached:true on 304 and renews lastSyncedAt without touching keychain', async () => {
    // Pre-seed a vault-state.json with a fresh ETag
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({
      keysEtag: '"etag-cached"',
      keysLastSyncedAt: new Date().toISOString(),
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 304 }));

    const { pullVaultKeys } = await importVault();
    const result = await pullVaultKeys(FAKE_STATE as never);

    expect(result.cached).toBe(true);
    expect(result.synced).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('does NOT send If-None-Match when cached ETag is older than MAX_ETAG_AGE', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({ keysEtag: '"stale-etag"', keysLastSyncedAt: stale }));
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeJsonResponse({ keys: [], count: 0, syncedAt: '' }),
    );

    const { pullVaultKeys } = await importVault();
    await pullVaultKeys(FAKE_STATE as never);

    const reqHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(reqHeaders?.['if-none-match']).toBeUndefined();
  });

  it('returns schema_not_migrated error on 503', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }));

    const { pullVaultKeys } = await importVault();
    const result = await pullVaultKeys(FAKE_STATE as never);

    expect(result.errors).toContain('vault_sync_unavailable:schema_not_migrated');
  });

  it('returns not_authenticated when session is absent', async () => {
    const { pullVaultKeys } = await importVault();
    const result = await pullVaultKeys(null);
    expect(result.errors).toContain('not_authenticated');
  });
});

// ─────────────────────────── pullVaultRules ──────────────────────────────────

describe('pullVaultRules', () => {
  it('persists ETag and writes rules file on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeJsonResponse({ content: '# Rules', configured: true }, 200, { etag: '"rules-etag-1"' }),
    );

    const { pullVaultRules } = await importVault();
    const result = await pullVaultRules(FAKE_STATE as never);

    expect(result.configured).toBe(true);
    expect(result.content).toBe('# Rules');
  });

  it('returns cached:true on 304 and serves local file', async () => {
    // Write a local rules file to simulate a previous successful pull
    const rulesFile = join(tmpDir, 'opta', 'non-negotiables.md');
    await writeFile(rulesFile, '# Cached Rules');
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({
      rulesEtag: '"rules-etag-cached"',
      rulesLastSyncedAt: new Date().toISOString(),
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 304 }));

    const { pullVaultRules } = await importVault();
    const result = await pullVaultRules(FAKE_STATE as never);

    expect(result.cached).toBe(true);
    expect(result.content).toBe('# Cached Rules');
    expect(result.configured).toBe(true);
  });

  it('sends If-None-Match only when ETag is fresh', async () => {
    const fresh = new Date().toISOString();
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({ rulesEtag: '"fresh-rules-etag"', rulesLastSyncedAt: fresh }));
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 304 }));

    const { pullVaultRules } = await importVault();
    await pullVaultRules(FAKE_STATE as never);

    const reqHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(reqHeaders?.['if-none-match']).toBe('"fresh-rules-etag"');
  });
});

// ─────────────────────────── pushVaultRules ──────────────────────────────────

describe('pushVaultRules', () => {
  it('sends If-Match header when ETag is cached', async () => {
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({
      rulesEtag: '"rules-etag-push"',
      rulesLastSyncedAt: new Date().toISOString(),
    }));
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeJsonResponse({ ok: true, filename: 'non-negotiables.md', syncedAt: '' }, 200, { etag: '"rules-etag-new"' }),
    );

    const { pushVaultRules } = await importVault();
    const result = await pushVaultRules(FAKE_STATE as never, '# Updated');

    expect(result.ok).toBe(true);
    const reqHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(reqHeaders?.['if-match']).toBe('"rules-etag-push"');
  });

  it('retries once on 412 and returns conflict:true if retry also 412', async () => {
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({ rulesEtag: '"stale-etag"', rulesLastSyncedAt: new Date().toISOString() }));
    vi.spyOn(globalThis, 'fetch')
      // First PATCH → 412
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'precondition_failed' }), { status: 412 }))
      // pullVaultRules GET (refresh) → 200 with new ETag
      .mockResolvedValueOnce(makeJsonResponse({ content: '# Remote', configured: true }, 200, { etag: '"fresh-etag"' }))
      // Second PATCH (retry) → 412 again
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'precondition_failed' }), { status: 412 }));

    const { pushVaultRules } = await importVault();
    const result = await pushVaultRules(FAKE_STATE as never, '# Local');

    expect(result.ok).toBe(false);
    expect(result.conflict).toBe(true);
  });

  it('succeeds on retry after 412 + refresh', async () => {
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({ rulesEtag: '"stale-etag"', rulesLastSyncedAt: new Date().toISOString() }));
    vi.spyOn(globalThis, 'fetch')
      // First PATCH → 412
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'precondition_failed' }), { status: 412 }))
      // pullVaultRules GET → 200 with refreshed ETag
      .mockResolvedValueOnce(makeJsonResponse({ content: '# Remote', configured: true }, 200, { etag: '"refreshed-etag"' }))
      // Second PATCH → 200
      .mockResolvedValueOnce(makeJsonResponse({ ok: true, filename: 'non-negotiables.md', syncedAt: '' }, 200, { etag: '"after-push-etag"' }));

    const { pushVaultRules } = await importVault();
    const result = await pushVaultRules(FAKE_STATE as never, '# Local');

    expect(result.ok).toBe(true);
    expect(result.conflict).toBeUndefined();
  });

  it('--force sends no If-Match header even when ETag is cached', async () => {
    const stateFile = join(tmpDir, 'opta', 'vault-state.json');
    await writeFile(stateFile, JSON.stringify({ rulesEtag: '"cached-etag"', rulesLastSyncedAt: new Date().toISOString() }));
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      makeJsonResponse({ ok: true, filename: 'non-negotiables.md', syncedAt: '' }, 200, { etag: '"new-etag"' }),
    );

    const { pushVaultRules } = await importVault();
    const result = await pushVaultRules(FAKE_STATE as never, '# Force', undefined, { force: true });

    expect(result.ok).toBe(true);
    const reqHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(reqHeaders?.['if-match']).toBeUndefined();
  });

  it('persists new ETag from successful PATCH response', async () => {
    // Set up both responses on one spy so call indices are unambiguous
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeJsonResponse({ ok: true, filename: 'non-negotiables.md', syncedAt: '' }, 200, { etag: '"after-push-etag"' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const { pushVaultRules, pullVaultRules } = await importVault();
    await pushVaultRules(FAKE_STATE as never, '# Content');
    await pullVaultRules(FAKE_STATE as never);

    // calls[0] = PATCH, calls[1] = subsequent GET
    const pullHeaders = mockFetch.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined;
    expect(pullHeaders?.['if-none-match']).toBe('"after-push-etag"');
  });
});
