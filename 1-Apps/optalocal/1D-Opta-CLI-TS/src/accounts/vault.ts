/**
 * accounts/vault.ts — Sync Vault integration for Opta CLI.
 *
 * Provides functions to:
 *  - Pull all provider keys from the Sync Vault → local OS keychain
 *  - Fetch non-negotiables.md from the vault → local rules file
 *  - Push local rules file back to vault (PATCH /api/sync/files)
 *
 * Used from:
 *  - `opta vault pull` command
 *  - Daemon startup hook (auto-sync on boot)
 *  - System prompt injection (non-negotiables.md → AI context)
 *
 * HTTP optimisations in use:
 *  - If-None-Match / 304 on GET requests (ETag persisted across runs in vault-state.json)
 *  - If-Match / 412 on PATCH requests with one auto-retry on conflict
 *  - Max-age guard: ETags older than 24h are discarded to force re-validation,
 *    protecting against server-side trigger failures or clock skew
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../platform/paths.js';
import type { AccountState } from './types.js';

const DEFAULT_ACCOUNTS_URL = 'https://accounts.optalocal.com';
const RULES_FILENAME = 'non-negotiables.md';
const RULES_LOCAL_PATH = join(getConfigDir(), RULES_FILENAME);
const VAULT_STATE_PATH = join(getConfigDir(), 'vault-state.json');
/** ETags older than this are discarded — forces re-validation to catch trigger failures. */
const MAX_ETAG_AGE_MS = 24 * 60 * 60 * 1000;

function accountsBaseUrl(): string {
    const value = process.env['OPTA_ACCOUNTS_URL']?.trim();
    if (!value) return DEFAULT_ACCOUNTS_URL;
    try {
        return new URL(value).origin;
    } catch {
        return DEFAULT_ACCOUNTS_URL;
    }
}

function authHeaders(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        apikey:
            process.env['OPTA_SUPABASE_ANON_KEY'] ??
            process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ??
            '',
        'content-type': 'application/json',
    };
}

// ---------------------------------------------------------------------------
// ETag state — persisted to disk so re-runs benefit from 304 short-circuits
// ---------------------------------------------------------------------------

type VaultETagState = {
    rulesEtag?: string;
    keysEtag?: string;
    connectionsEtag?: string;
    rulesLastSyncedAt?: string;
    keysLastSyncedAt?: string;
    connectionsLastSyncedAt?: string;
};

async function readVaultState(): Promise<VaultETagState> {
    try {
        const raw = await readFile(VAULT_STATE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed as VaultETagState;
        }
        return {};
    } catch {
        return {};
    }
}

async function writeVaultState(state: VaultETagState): Promise<void> {
    try {
        await mkdir(getConfigDir(), { recursive: true });
        await writeFile(VAULT_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
        // Best-effort — if the write fails, the next run just skips the 304 path.
    }
}

function extractEtag(headers: Headers): string | null {
    const value = headers.get('etag')?.trim();
    return value && value.length > 0 ? value : null;
}

function etagIsFresh(lastSyncedAt: string | undefined): boolean {
    if (!lastSyncedAt) return false;
    return Date.now() - new Date(lastSyncedAt).getTime() < MAX_ETAG_AGE_MS;
}

// ---------------------------------------------------------------------------
// Key Provider → Keychain mapping
// ---------------------------------------------------------------------------

type VaultKeyEntry = {
    id: string;
    provider: string;
    label: string | null;
    key_value: string;
    updated_at: string;
};

type VaultKeysResponse = {
    keys: VaultKeyEntry[];
    count: number;
    syncedAt: string;
};

type VaultFileResponse = {
    content: string | null;
    configured: boolean;
    syncedAt?: string;
};

type VaultConnectionEntry = {
    provider: string;
    token_encrypted: string | null;
    token_expires_at: string | null;
    updated_at: string;
};

type VaultConnectionsResponse = {
    connections: VaultConnectionEntry[];
    count: number;
    syncedAt: string;
};

// ---------------------------------------------------------------------------
// Pull keys from Vault
// ---------------------------------------------------------------------------

export async function pullVaultKeys(
    state: AccountState | null,
): Promise<{ synced: number; skipped: number; errors: string[]; cached?: boolean; syncedKeys: Array<{ provider: string; label: string | null }> }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { synced: 0, skipped: 0, errors: ['not_authenticated'], syncedKeys: [] };

    const url = new URL('/api/sync/keys', accountsBaseUrl());
    const vaultState = await readVaultState();

    const requestHeaders: Record<string, string> = { ...authHeaders(accessToken) };
    if (vaultState.keysEtag && etagIsFresh(vaultState.keysLastSyncedAt)) {
        requestHeaders['if-none-match'] = vaultState.keysEtag;
    }

    let payload: VaultKeysResponse;

    try {
        const res = await fetch(url.toString(), { headers: requestHeaders });

        if (res.status === 304) {
            // Server confirmed nothing changed — renew the timestamp and skip keychain writes.
            await writeVaultState({ ...vaultState, keysLastSyncedAt: new Date().toISOString() });
            return { synced: 0, skipped: 0, errors: [], cached: true, syncedKeys: [] };
        }

        if (res.status === 503) {
            return { synced: 0, skipped: 0, errors: ['vault_sync_unavailable:schema_not_migrated'], syncedKeys: [] };
        }

        if (!res.ok) {
            return { synced: 0, skipped: 0, errors: [`vault_keys_fetch_failed:${res.status}`], syncedKeys: [] };
        }

        const freshEtag = extractEtag(res.headers);
        if (freshEtag) {
            await writeVaultState({ ...vaultState, keysEtag: freshEtag, keysLastSyncedAt: new Date().toISOString() });
        }

        payload = (await res.json()) as VaultKeysResponse;
    } catch (err) {
        return { synced: 0, skipped: 0, errors: [`network_error:${String(err)}`], syncedKeys: [] };
    }

    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;
    const syncedKeys: Array<{ provider: string; label: string | null }> = [];

    // Dynamically import the keychain provider to avoid circular deps
    const { storeKeyByProvider } = await import('../keychain/api-keys.js').catch(() => ({
        storeKeyByProvider: null,
    }));

    for (const entry of payload.keys ?? []) {
        if (!entry.key_value) {
            skipped++;
            continue;
        }
        if (storeKeyByProvider) {
            try {
                await storeKeyByProvider(entry.provider, entry.key_value);
                syncedKeys.push({ provider: entry.provider, label: entry.label ?? null });
                synced++;
            } catch (e) {
                errors.push(`${entry.provider}:${String(e)}`);
                skipped++;
            }
        } else {
            // Keychain unavailable (e.g. Windows headless) — write to env-hint file
            skipped++;
        }
    }

    return { synced, skipped, errors, syncedKeys };
}

// ---------------------------------------------------------------------------
// Pull OAuth connection tokens from Vault
// ---------------------------------------------------------------------------

export async function pullVaultConnections(
    state: AccountState | null,
): Promise<{ synced: number; skipped: number; errors: string[]; cached?: boolean; syncedConnections: Array<{ provider: string }> }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { synced: 0, skipped: 0, errors: ['not_authenticated'], syncedConnections: [] };

    const url = new URL('/api/sync/connections', accountsBaseUrl());
    const vaultState = await readVaultState();

    const requestHeaders: Record<string, string> = { ...authHeaders(accessToken) };
    if (vaultState.connectionsEtag && etagIsFresh(vaultState.connectionsLastSyncedAt)) {
        requestHeaders['if-none-match'] = vaultState.connectionsEtag;
    }

    let payload: VaultConnectionsResponse;

    try {
        const res = await fetch(url.toString(), { headers: requestHeaders });

        if (res.status === 304) {
            await writeVaultState({ ...vaultState, connectionsLastSyncedAt: new Date().toISOString() });
            return { synced: 0, skipped: 0, errors: [], cached: true, syncedConnections: [] };
        }

        if (res.status === 503) {
            return { synced: 0, skipped: 0, errors: ['vault_sync_unavailable:schema_not_migrated'], syncedConnections: [] };
        }

        if (!res.ok) {
            return { synced: 0, skipped: 0, errors: [`vault_connections_fetch_failed:${res.status}`], syncedConnections: [] };
        }

        const freshEtag = extractEtag(res.headers);
        if (freshEtag) {
            await writeVaultState({ ...vaultState, connectionsEtag: freshEtag, connectionsLastSyncedAt: new Date().toISOString() });
        }

        payload = (await res.json()) as VaultConnectionsResponse;
    } catch (err) {
        return { synced: 0, skipped: 0, errors: [`network_error:${String(err)}`], syncedConnections: [] };
    }

    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;
    const syncedConnections: Array<{ provider: string }> = [];

    const { storeConnectionToken } = await import('../keychain/api-keys.js').catch(() => ({
        storeConnectionToken: null,
    }));

    for (const entry of payload.connections ?? []) {
        if (!entry.token_encrypted) {
            skipped++;
            continue;
        }
        if (storeConnectionToken) {
            try {
                const stored = await storeConnectionToken(entry.provider, entry.token_encrypted, entry.token_expires_at ?? null);
                if (stored) {
                    syncedConnections.push({ provider: entry.provider });
                    synced++;
                } else {
                    errors.push(`${entry.provider}:decrypt_failed`);
                    skipped++;
                }
            } catch (e) {
                errors.push(`${entry.provider}:${String(e)}`);
                skipped++;
            }
        } else {
            skipped++;
        }
    }

    return { synced, skipped, errors, syncedConnections };
}

// ---------------------------------------------------------------------------
// Pull rules (non-negotiables.md)
// ---------------------------------------------------------------------------

export async function pullVaultRules(
    state: AccountState | null,
): Promise<{ content: string | null; configured: boolean; cached?: boolean }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { content: null, configured: false };

    const url = new URL('/api/sync/files', accountsBaseUrl());
    url.searchParams.set('name', RULES_FILENAME);

    const vaultState = await readVaultState();
    const requestHeaders: Record<string, string> = { ...authHeaders(accessToken) };
    if (vaultState.rulesEtag && etagIsFresh(vaultState.rulesLastSyncedAt)) {
        requestHeaders['if-none-match'] = vaultState.rulesEtag;
    }

    try {
        const res = await fetch(url.toString(), { headers: requestHeaders });

        if (res.status === 304) {
            // Content unchanged — renew timestamp and serve from local cache.
            await writeVaultState({ ...vaultState, rulesLastSyncedAt: new Date().toISOString() });
            const cached = await readCachedRules();
            return { content: cached, configured: cached !== null, cached: true };
        }

        if (res.status === 503) {
            return { content: null, configured: false };
        }

        if (!res.ok) return { content: null, configured: false };

        const freshEtag = extractEtag(res.headers);
        if (freshEtag) {
            await writeVaultState({ ...vaultState, rulesEtag: freshEtag, rulesLastSyncedAt: new Date().toISOString() });
        }

        const payload = (await res.json()) as VaultFileResponse;

        if (payload.configured && payload.content) {
            // Persist locally so the daemon can inject without a network call per-session
            await mkdir(getConfigDir(), { recursive: true });
            await writeFile(RULES_LOCAL_PATH, payload.content, 'utf-8');
        }

        return { content: payload.content ?? null, configured: payload.configured };
    } catch {
        return { content: null, configured: false };
    }
}

// ---------------------------------------------------------------------------
// Read cached rules (local file — fastest path, used during AI sessions)
// ---------------------------------------------------------------------------

export async function readCachedRules(): Promise<string | null> {
    try {
        return await readFile(RULES_LOCAL_PATH, 'utf-8');
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Push rules to Vault
//
// Sends If-Match with the persisted ETag. On 412 (concurrent write conflict),
// re-fetches the current ETag and retries once so callers don't have to.
//
// Pass `options.force = true` to bypass optimistic concurrency entirely
// (sends no If-Match header, always overwrites — use for disaster recovery).
// ---------------------------------------------------------------------------

export async function pushVaultRules(
    state: AccountState | null,
    content: string,
    filename = RULES_FILENAME,
    options: { force?: boolean } = {},
): Promise<{ ok: boolean; conflict?: boolean }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { ok: false };

    const url = new URL('/api/sync/files', accountsBaseUrl());

    async function attemptPatch(ifMatchEtag: string | null): Promise<Response> {
        const headers: Record<string, string> = {
            ...authHeaders(accessToken as string),
        };
        if (ifMatchEtag) {
            headers['if-match'] = ifMatchEtag;
        }
        return fetch(url.toString(), {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ filename, content }),
        });
    }

    try {
        const vaultState = await readVaultState();
        // --force bypasses optimistic concurrency — no If-Match sent.
        const initialEtag = options.force ? null : (vaultState.rulesEtag ?? null);
        let res = await attemptPatch(initialEtag);

        if (!options.force && res.status === 412) {
            // Conflict: refresh the ETag by doing a GET, then retry once.
            const freshState = await pullVaultRules(state);
            if (!freshState.configured) {
                // File was deleted remotely — proceed without If-Match (will create).
                res = await attemptPatch(null);
            } else {
                // Read the freshly-written ETag from state file.
                const updatedState = await readVaultState();
                res = await attemptPatch(updatedState.rulesEtag ?? null);
            }

            if (res.status === 412) {
                // Still conflicting after refresh — caller must decide.
                return { ok: false, conflict: true };
            }
        }

        if (res.ok) {
            const freshEtag = extractEtag(res.headers);
            if (freshEtag) {
                const latestState = await readVaultState();
                await writeVaultState({ ...latestState, rulesEtag: freshEtag, rulesLastSyncedAt: new Date().toISOString() });
            }
        }

        return { ok: res.ok };
    } catch {
        return { ok: false };
    }
}

// ---------------------------------------------------------------------------
// Full vault sync (keys + rules)
// ---------------------------------------------------------------------------

export async function syncVault(
    state: AccountState | null,
): Promise<{
    keys: { synced: number; skipped: number; errors: string[]; cached?: boolean; syncedKeys: Array<{ provider: string; label: string | null }> };
    rules: { content: string | null; configured: boolean; cached?: boolean };
    connections: { synced: number; skipped: number; errors: string[]; cached?: boolean; syncedConnections: Array<{ provider: string }> };
}> {
    const [keys, rules, connections] = await Promise.all([
        pullVaultKeys(state),
        pullVaultRules(state),
        pullVaultConnections(state),
    ]);
    return { keys, rules, connections };
}
