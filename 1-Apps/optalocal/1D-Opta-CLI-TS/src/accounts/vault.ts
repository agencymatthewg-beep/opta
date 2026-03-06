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
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../platform/paths.js';
import type { AccountState } from './types.js';

const DEFAULT_ACCOUNTS_URL = 'https://accounts.optalocal.com';
const RULES_FILENAME = 'non-negotiables.md';
const RULES_LOCAL_PATH = join(getConfigDir(), RULES_FILENAME);
const VAULT_STATE_PATH = join(getConfigDir(), 'vault-state.json');

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

// ---------------------------------------------------------------------------
// Pull keys from Vault
// ---------------------------------------------------------------------------

export async function pullVaultKeys(
    state: AccountState | null,
): Promise<{ synced: number; skipped: number; errors: string[]; cached?: boolean }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { synced: 0, skipped: 0, errors: ['not_authenticated'] };

    const url = new URL('/api/sync/keys', accountsBaseUrl());
    const vaultState = await readVaultState();

    const requestHeaders: Record<string, string> = { ...authHeaders(accessToken) };
    if (vaultState.keysEtag) {
        requestHeaders['if-none-match'] = vaultState.keysEtag;
    }

    let payload: VaultKeysResponse;

    try {
        const res = await fetch(url.toString(), { headers: requestHeaders });

        if (res.status === 304) {
            // Server confirmed nothing changed — skip keychain writes.
            return { synced: 0, skipped: 0, errors: [], cached: true };
        }

        if (!res.ok) {
            return { synced: 0, skipped: 0, errors: [`vault_keys_fetch_failed:${res.status}`] };
        }

        const freshEtag = extractEtag(res.headers);
        if (freshEtag) {
            await writeVaultState({ ...vaultState, keysEtag: freshEtag });
        }

        payload = (await res.json()) as VaultKeysResponse;
    } catch (err) {
        return { synced: 0, skipped: 0, errors: [`network_error:${String(err)}`] };
    }

    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;

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

    return { synced, skipped, errors };
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
    if (vaultState.rulesEtag) {
        requestHeaders['if-none-match'] = vaultState.rulesEtag;
    }

    try {
        const res = await fetch(url.toString(), { headers: requestHeaders });

        if (res.status === 304) {
            // Content unchanged — serve from local cache without re-writing.
            const cached = await readCachedRules();
            return { content: cached, configured: cached !== null, cached: true };
        }

        if (!res.ok) return { content: null, configured: false };

        const freshEtag = extractEtag(res.headers);
        if (freshEtag) {
            await writeVaultState({ ...vaultState, rulesEtag: freshEtag });
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
// ---------------------------------------------------------------------------

export async function pushVaultRules(
    state: AccountState | null,
    content: string,
    filename = RULES_FILENAME,
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
        let res = await attemptPatch(vaultState.rulesEtag ?? null);

        if (res.status === 412) {
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
                await writeVaultState({ ...latestState, rulesEtag: freshEtag });
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
    keys: { synced: number; skipped: number; errors: string[]; cached?: boolean };
    rules: { content: string | null; configured: boolean; cached?: boolean };
}> {
    const [keys, rules] = await Promise.all([
        pullVaultKeys(state),
        pullVaultRules(state),
    ]);
    return { keys, rules };
}
