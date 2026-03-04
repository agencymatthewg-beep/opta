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
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../platform/paths.js';
import type { AccountState } from './types.js';

const DEFAULT_ACCOUNTS_URL = 'https://accounts.optalocal.com';
const RULES_FILENAME = 'non-negotiables.md';
const RULES_LOCAL_PATH = join(getConfigDir(), RULES_FILENAME);

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
): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { synced: 0, skipped: 0, errors: ['not_authenticated'] };

    const url = new URL('/api/sync/keys', accountsBaseUrl());
    let payload: VaultKeysResponse;

    try {
        const res = await fetch(url.toString(), {
            headers: authHeaders(accessToken),
        });
        if (!res.ok) return { synced: 0, skipped: 0, errors: [`vault_keys_fetch_failed:${res.status}`] };
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
): Promise<{ content: string | null; configured: boolean }> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return { content: null, configured: false };

    const url = new URL('/api/sync/files', accountsBaseUrl());
    url.searchParams.set('name', RULES_FILENAME);

    try {
        const res = await fetch(url.toString(), { headers: authHeaders(accessToken) });
        if (!res.ok) return { content: null, configured: false };
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
// ---------------------------------------------------------------------------

export async function pushVaultRules(
    state: AccountState | null,
    content: string,
    filename = RULES_FILENAME,
): Promise<boolean> {
    const accessToken = state?.session?.access_token.trim();
    if (!accessToken) return false;

    const url = new URL('/api/sync/files', accountsBaseUrl());
    try {
        const res = await fetch(url.toString(), {
            method: 'PATCH',
            headers: authHeaders(accessToken),
            body: JSON.stringify({ filename, content }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Full vault sync (keys + rules)
// ---------------------------------------------------------------------------

export async function syncVault(
    state: AccountState | null,
): Promise<{
    keys: { synced: number; skipped: number; errors: string[] };
    rules: { content: string | null; configured: boolean };
}> {
    const [keys, rules] = await Promise.all([
        pullVaultKeys(state),
        pullVaultRules(state),
    ]);
    return { keys, rules };
}
