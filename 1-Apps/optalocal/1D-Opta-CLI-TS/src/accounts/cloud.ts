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

  const url = new URL('/api/keys', accountsBaseUrl());
  url.searchParams.set('provider', p);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...authHeaders(accessToken),
      },
    });

    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { keys?: Array<{ keyValue?: string }> }
      | null;
    const key = payload?.keys?.[0]?.keyValue?.trim();
    if (!key) return null;

    cloudKeyCache.set(cacheKey, { value: key, expiresAt: Date.now() + CLOUD_KEY_TTL_MS });
    return key;
  } catch {
    return null;
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
