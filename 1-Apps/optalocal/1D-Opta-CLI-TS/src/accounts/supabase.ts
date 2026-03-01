import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AccountIdentifier, SupabaseSession, SupabaseUser } from './types.js';

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
  project: string;
}

export interface SupabaseAuthResult {
  session: SupabaseSession | null;
  user: SupabaseUser | null;
}

export class SupabaseRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'SupabaseRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseUser(value: unknown): SupabaseUser | null {
  if (!isRecord(value)) return null;
  if (typeof value['id'] !== 'string' || value['id'].trim().length === 0) return null;
  return value as SupabaseUser;
}

function parseSession(value: unknown): SupabaseSession | null {
  if (!isRecord(value)) return null;
  if (typeof value['access_token'] !== 'string') return null;
  if (typeof value['refresh_token'] !== 'string') return null;
  if (typeof value['token_type'] !== 'string') return null;
  if (typeof value['expires_in'] !== 'number') return null;
  return value as SupabaseSession;
}

function parseProjectFromUrl(url: string): string {
  const host = new URL(url).hostname;
  const firstLabel = host.split('.')[0] ?? '';
  return firstLabel || 'unknown';
}

function normalizeSupabaseUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  return `${parsed.protocol}//${parsed.host}`;
}

interface ResolveSupabaseAuthConfigOptions {
  cwd?: string;
}

function parseDotenv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function discoverSupabaseAuthConfig(
  env: NodeJS.ProcessEnv,
  cwd: string,
): { rawUrl: string; rawAnonKey: string } | null {
  if (env['VITEST'] === 'true' || env['NODE_ENV'] === 'test') {
    return null;
  }

  const roots: string[] = [];
  let cursor = cwd;
  for (let depth = 0; depth < 5; depth += 1) {
    roots.push(cursor);
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(
      join(root, '1R-Opta-Accounts', '.env.local'),
      join(root, '1L-Opta-Local', 'web', '.env.local'),
    );
  }

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = parseDotenv(readFileSync(path, 'utf-8'));
      const rawUrl = parsed['OPTA_SUPABASE_URL'] ?? parsed['NEXT_PUBLIC_SUPABASE_URL'];
      const rawAnonKey = parsed['OPTA_SUPABASE_ANON_KEY'] ?? parsed['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
      if (typeof rawUrl === 'string' && typeof rawAnonKey === 'string' && rawUrl.trim() && rawAnonKey.trim()) {
        return { rawUrl, rawAnonKey };
      }
    } catch {
      // Ignore malformed or unreadable .env files and keep searching.
    }
  }

  return null;
}

export function resolveSupabaseAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: ResolveSupabaseAuthConfigOptions = {},
): SupabaseAuthConfig | null {
  const discovered = discoverSupabaseAuthConfig(env, options.cwd ?? process.cwd());
  const rawUrl = env['OPTA_SUPABASE_URL'] ?? env['NEXT_PUBLIC_SUPABASE_URL'] ?? discovered?.rawUrl;
  const rawAnonKey = env['OPTA_SUPABASE_ANON_KEY'] ?? env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? discovered?.rawAnonKey;

  if (!rawUrl || !rawAnonKey) return null;

  const url = normalizeSupabaseUrl(rawUrl);
  const anonKey = rawAnonKey.trim();
  if (!anonKey) return null;

  return {
    url,
    anonKey,
    project: parseProjectFromUrl(url),
  };
}

export function parseAccountIdentifier(identifier: string): AccountIdentifier {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('Identifier cannot be empty.');
  }

  if (trimmed.includes('@')) {
    return { email: trimmed.toLowerCase() };
  }

  const normalizedPhone = trimmed.replace(/[\s()-]/g, '');
  if (!/^\+?[0-9]{6,15}$/.test(normalizedPhone)) {
    throw new Error('Identifier must be a valid email address or phone number.');
  }

  return { phone: normalizedPhone };
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const candidates = [
    payload['msg'],
    payload['message'],
    payload['error_description'],
    payload['error'],
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

function authHeaders(config: SupabaseAuthConfig, bearer?: string): Record<string, string> {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${bearer ?? config.anonKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function requestSupabase(
  config: SupabaseAuthConfig,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${config.url}${path}`, init);
  const rawBody = await response.text();
  const payload = rawBody.length > 0 ? tryParseJson(rawBody) : {};

  if (!response.ok) {
    const message = extractErrorMessage(payload) ?? `Supabase request failed with HTTP ${response.status}.`;
    throw new SupabaseRequestError(message, response.status, payload);
  }

  return payload;
}

function tryParseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return { message: rawBody };
  }
}

export async function signUpWithPassword(
  config: SupabaseAuthConfig,
  identifier: AccountIdentifier,
  password: string,
  name?: string,
): Promise<SupabaseAuthResult> {
  const body: Record<string, unknown> = {
    ...identifier,
    password,
  };
  const trimmedName = name?.trim();
  if (trimmedName) {
    body['data'] = { name: trimmedName };
  }

  const payload = await requestSupabase(config, '/auth/v1/signup', {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });

  const parsed = isRecord(payload) ? payload : {};
  const session = parseSession(parsed['session']);
  const user = parseUser(parsed['user']) ?? (session?.user ?? null);
  return { session, user };
}

export async function loginWithPassword(
  config: SupabaseAuthConfig,
  identifier: AccountIdentifier,
  password: string,
): Promise<SupabaseAuthResult> {
  const payload = await requestSupabase(config, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      ...identifier,
      password,
    }),
  });

  const parsed = isRecord(payload) ? payload : {};
  const user = parseUser(parsed['user']);
  const accessToken = parsed['access_token'];
  const refreshToken = parsed['refresh_token'];
  const tokenType = parsed['token_type'];
  const expiresIn = parsed['expires_in'];
  const expiresAt = parsed['expires_at'];

  const session: SupabaseSession | null =
    typeof accessToken === 'string' &&
    typeof refreshToken === 'string' &&
    typeof tokenType === 'string' &&
    typeof expiresIn === 'number'
      ? {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: tokenType,
        expires_in: expiresIn,
        ...(typeof expiresAt === 'number' ? { expires_at: expiresAt } : {}),
        ...(user ? { user } : {}),
      }
      : null;

  return {
    session,
    user: user ?? session?.user ?? null,
  };
}

export async function logoutSession(
  config: SupabaseAuthConfig,
  accessToken: string,
): Promise<void> {
  await requestSupabase(config, '/auth/v1/logout', {
    method: 'POST',
    headers: authHeaders(config, accessToken),
  });
}

export async function refreshSession(
  config: SupabaseAuthConfig,
  refreshToken: string,
): Promise<SupabaseAuthResult> {
  const payload = await requestSupabase(config, '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const parsed = isRecord(payload) ? payload : {};
  const user = parseUser(parsed['user']);
  const accessToken = parsed['access_token'];
  const newRefreshToken = parsed['refresh_token'];
  const tokenType = parsed['token_type'];
  const expiresIn = parsed['expires_in'];
  const expiresAt = parsed['expires_at'];

  const session: SupabaseSession | null =
    typeof accessToken === 'string' &&
    typeof newRefreshToken === 'string' &&
    typeof tokenType === 'string' &&
    typeof expiresIn === 'number'
      ? {
          access_token: accessToken,
          refresh_token: newRefreshToken,
          token_type: tokenType,
          expires_in: expiresIn,
          ...(typeof expiresAt === 'number' ? { expires_at: expiresAt } : {}),
          ...(user ? { user } : {}),
        }
      : null;

  return { session, user: user ?? session?.user ?? null };
}

export async function exchangeAuthCodeForSession(
  config: SupabaseAuthConfig,
  authCode: string,
  codeVerifier: string,
): Promise<SupabaseAuthResult> {
  const payload = await requestSupabase(config, '/auth/v1/token?grant_type=pkce', {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      auth_code: authCode,
      code_verifier: codeVerifier,
    }),
  });

  const parsed = isRecord(payload) ? payload : {};
  const user = parseUser(parsed['user']);

  const parsedSession = parseSession(parsed['session']);
  if (parsedSession) {
    return { session: parsedSession, user: user ?? parsedSession.user ?? null };
  }

  const accessToken = parsed['access_token'];
  const refreshToken = parsed['refresh_token'];
  const tokenType = parsed['token_type'];
  const expiresIn = parsed['expires_in'];
  const expiresAt = parsed['expires_at'];

  const session: SupabaseSession | null =
    typeof accessToken === 'string' &&
    typeof refreshToken === 'string' &&
    typeof tokenType === 'string' &&
    typeof expiresIn === 'number'
      ? {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: tokenType,
          expires_in: expiresIn,
          ...(typeof expiresAt === 'number' ? { expires_at: expiresAt } : {}),
          ...(user ? { user } : {}),
        }
      : null;

  return { session, user: user ?? session?.user ?? null };
}

export async function fetchUserWithAccessToken(
  config: SupabaseAuthConfig,
  accessToken: string,
): Promise<SupabaseUser | null> {
  const payload = await requestSupabase(config, '/auth/v1/user', {
    method: 'GET',
    headers: authHeaders(config, accessToken),
  });
  return parseUser(payload);
}
