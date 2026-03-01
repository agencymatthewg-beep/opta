import { createHash } from 'node:crypto';
import { hostname, platform, arch, userInfo } from 'node:os';
import type { AccountState } from './types.js';

const DEFAULT_ACCOUNTS_URL = 'https://accounts.optalocal.com';
const CLOUD_KEY_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { value: string; expiresAt: number };
const cloudKeyCache = new Map<string, CacheEntry>();

function accountsBaseUrl(): string {
  const value = process.env['OPTA_ACCOUNTS_URL']?.trim();
  if (!value) return DEFAULT_ACCOUNTS_URL;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return DEFAULT_ACCOUNTS_URL;
  }
}

function supabaseRestBaseFromProject(project: string): string {
  return `https://${project}.supabase.co/rest/v1`;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    apikey: process.env['OPTA_SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
  };
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

export interface CloudApiKeyEntry {
  id: string;
  provider: string;
  label: string | null;
  keyValue: string;
  updatedAt: string;
}

/** Fetch all active cloud keys for a provider (or all providers if omitted). */
export async function listCloudApiKeys(
  state: AccountState | null,
  provider?: string,
): Promise<CloudApiKeyEntry[]> {
  const accessToken = state?.session?.access_token?.trim();
  if (!accessToken) return [];

  const url = new URL('/api/keys', accountsBaseUrl());
  if (provider) url.searchParams.set('provider', normalizeProvider(provider));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => null)) as
      | { keys?: Array<{ id?: string; provider?: string; label?: string | null; key_value?: string; updated_at?: string }> }
      | null;
    return (payload?.keys ?? [])
      .filter((k) => k.id && k.key_value)
      .map((k) => ({
        id: k.id!,
        provider: k.provider ?? provider ?? '',
        label: k.label ?? null,
        keyValue: k.key_value!,
        updatedAt: k.updated_at ?? '',
      }));
  } catch {
    return [];
  }
}

/**
 * Resolve the best active cloud API key for a provider.
 * Prefers the most-recently updated key (GET /api/keys already sorts by updated_at DESC).
 * Result is cached for CLOUD_KEY_TTL_MS to avoid repeated round-trips.
 */
export async function resolveCloudApiKey(
  state: AccountState | null,
  provider: string,
): Promise<string | null> {
  const accessToken = state?.session?.access_token?.trim();
  const project = state?.project?.trim();
  if (!accessToken || !project) return null;

  const p = normalizeProvider(provider);
  const cacheKey = `${project}:${p}`;
  const cached = cloudKeyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const keys = await listCloudApiKeys(state, p);
  // GET /api/keys returns active keys sorted by updated_at DESC — first entry is most recent.
  const key = keys[0]?.keyValue?.trim();
  if (!key) return null;

  cloudKeyCache.set(cacheKey, { value: key, expiresAt: Date.now() + CLOUD_KEY_TTL_MS });
  return key;
}

/**
 * Store (or update) an API key in the user's Opta Accounts cloud.
 * Uses POST /api/keys which upserts on (user_id, provider, label) conflict.
 * Returns true on success, false on auth failure or network error.
 */
export async function storeCloudApiKey(
  state: AccountState | null,
  provider: string,
  keyValue: string,
  label = 'default',
): Promise<boolean> {
  const accessToken = state?.session?.access_token?.trim();
  if (!accessToken) return false;

  const url = new URL('/api/keys', accountsBaseUrl());
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ provider: normalizeProvider(provider), keyValue: keyValue.trim(), label }),
    });
    if (response.ok) {
      // Invalidate cache so the next resolve picks up the new key immediately.
      const project = state?.project?.trim();
      if (project) cloudKeyCache.delete(`${project}:${normalizeProvider(provider)}`);
    }
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a cloud API key by its UUID.
 * Returns true on success, false on auth failure or network error.
 */
export async function deleteCloudApiKey(
  state: AccountState | null,
  keyId: string,
  provider?: string,
): Promise<boolean> {
  const accessToken = state?.session?.access_token?.trim();
  if (!accessToken) return false;

  const url = new URL(`/api/keys/${encodeURIComponent(keyId)}`, accountsBaseUrl());
  try {
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (response.ok && provider) {
      const project = state?.project?.trim();
      if (project) cloudKeyCache.delete(`${project}:${normalizeProvider(provider)}`);
    }
    return response.ok;
  } catch {
    return false;
  }
}

function buildDeviceFingerprint(userId: string): string {
  const source = [hostname(), platform(), arch(), userInfo().username, userId].join('|');
  return createHash('sha256').update(source).digest('hex');
}

export async function registerCliDevice(state: AccountState): Promise<string | null> {
  const accessToken = state.session?.access_token?.trim();
  const userId = state.user?.id?.trim();
  if (!accessToken || !userId) return null;

  const url = new URL('/api/devices/register', accountsBaseUrl());
  const payload = {
    platform: platform(),
    deviceLabel: hostname(),
    fingerprintHash: buildDeviceFingerprint(userId),
    trustState: 'trusted',
  };

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(accessToken),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as { deviceId?: string } | null;
    return body?.deviceId ?? null;
  } catch {
    return null;
  }
}

export async function evaluateCapability(
  state: AccountState | null,
  scope: string,
  deviceId?: string | null,
): Promise<{ allow: boolean; reason?: string }> {
  const accessToken = state?.session?.access_token?.trim();
  if (!accessToken) return { allow: false, reason: 'not_authenticated' };

  const url = new URL('/api/capabilities/evaluate', accountsBaseUrl());
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ scope, deviceId: deviceId ?? undefined }),
    });

    const payload = (await response.json().catch(() => null)) as { allow?: boolean; reason?: string } | null;
    return {
      allow: Boolean(payload?.allow),
      reason: payload?.reason,
    };
  } catch {
    return { allow: false, reason: 'capability_check_unavailable' };
  }
}

/**
 * Update the `last_seen_at` timestamp for the current CLI session in the cloud.
 *
 * Intended to be called periodically (e.g., every 30 minutes) while the TUI
 * is active, so that cloud-side activity tracking stays current after login.
 * Silently no-ops if the user is unauthenticated or the request fails.
 */
export async function touchSessionRecord(state: AccountState | null): Promise<void> {
  const accessToken = state?.session?.access_token?.trim();
  const userId = state?.user?.id?.trim();
  if (!accessToken || !userId || !state?.project) return;

  const base = supabaseRestBaseFromProject(state.project);
  await fetch(`${base}/accounts_sessions?user_id=eq.${encodeURIComponent(userId)}&session_type=eq.cli`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

export async function upsertSessionRecord(
  state: AccountState,
  sessionType: 'cli' | 'web' | 'api' = 'cli',
): Promise<void> {
  const accessToken = state.session?.access_token?.trim();
  const userId = state.user?.id?.trim();
  if (!accessToken || !userId) return;

  const base = supabaseRestBaseFromProject(state.project);
  const now = new Date().toISOString();
  const expiresAt =
    typeof state.session?.expires_at === 'number'
      ? new Date((state.session.expires_at > 10_000_000_000 ? state.session.expires_at : state.session.expires_at * 1000)).toISOString()
      : null;

  await fetch(`${base}/accounts_sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify([
      {
        user_id: userId,
        session_type: sessionType,
        created_at: now,
        last_seen_at: now,
        expires_at: expiresAt,
      },
    ]),
  }).catch(() => undefined);
}
