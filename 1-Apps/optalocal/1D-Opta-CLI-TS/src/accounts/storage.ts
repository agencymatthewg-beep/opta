import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AccountState, SupabaseSession, SupabaseUser } from './types.js';

const ACCOUNT_DIR = join(homedir(), '.config', 'opta');
const ACCOUNT_FILE = join(ACCOUNT_DIR, 'account.json');
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asUser(value: unknown): SupabaseUser | null {
  if (!isRecord(value)) return null;
  if (typeof value['id'] !== 'string' || value['id'].trim().length === 0) return null;
  return value as SupabaseUser;
}

function asSession(value: unknown): SupabaseSession | null {
  if (!isRecord(value)) return null;
  if (typeof value['access_token'] !== 'string') return null;
  if (typeof value['refresh_token'] !== 'string') return null;
  if (typeof value['token_type'] !== 'string') return null;
  if (typeof value['expires_in'] !== 'number') return null;
  return value as SupabaseSession;
}

function parseAccountState(value: unknown): AccountState | null {
  if (!isRecord(value)) return null;
  const project = value['project'];
  const updatedAt = value['updatedAt'];
  if (typeof project !== 'string' || project.trim().length === 0) return null;
  if (typeof updatedAt !== 'string' || updatedAt.trim().length === 0) return null;

  const parsedSession = value['session'] === null ? null : asSession(value['session']);
  const parsedUser = value['user'] === null ? null : asUser(value['user']);
  if (value['session'] !== null && parsedSession === null) return null;
  if (value['user'] !== null && parsedUser === null) return null;

  return {
    project,
    session: parsedSession,
    user: parsedUser,
    updatedAt,
  };
}

async function enforcePermissions(path: string, mode: number): Promise<void> {
  if (process.platform === 'win32') return;
  try {
    await chmod(path, mode);
  } catch {
    // Best effort only.
  }
}

async function ensureAccountDir(): Promise<void> {
  await mkdir(ACCOUNT_DIR, { recursive: true, mode: DIR_MODE });
  await enforcePermissions(ACCOUNT_DIR, DIR_MODE);
}

export function accountStatePath(): string {
  return ACCOUNT_FILE;
}

export async function loadAccountState(): Promise<AccountState | null> {
  try {
    const raw = await readFile(ACCOUNT_FILE, 'utf-8');
    const parsed = parseAccountState(JSON.parse(raw));
    if (parsed === null) return null;

    const expiresAt = parsed.session?.expires_at;
    if (expiresAt !== undefined && Date.now() / 1000 + 300 >= expiresAt) {
      // Token expires within 5 minutes — attempt a transparent refresh.
      try {
        const { refreshSession, resolveSupabaseAuthConfig } = await import('./supabase.js');
        const config = resolveSupabaseAuthConfig();
        const currentRefreshToken = parsed.session?.refresh_token;
        if (config && currentRefreshToken) {
          const result = await refreshSession(config, currentRefreshToken);
          if (result.session) {
            const refreshed: AccountState = {
              ...parsed,
              session: result.session,
              user: result.user ?? parsed.user,
              updatedAt: new Date().toISOString(),
            };
            await saveAccountState(refreshed);
            return refreshed;
          }
        }
      } catch {
        // Refresh failed — fall through and return state with session nulled.
      }
      // Token is expired or refresh failed; signal invalid session.
      return { ...parsed, session: null };
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function saveAccountState(state: AccountState): Promise<void> {
  await ensureAccountDir();
  const payload = JSON.stringify(state, null, 2) + '\n';
  await writeFile(ACCOUNT_FILE, payload, { encoding: 'utf-8', mode: FILE_MODE });
  await enforcePermissions(ACCOUNT_FILE, FILE_MODE);
}

export async function clearAccountState(): Promise<void> {
  await rm(ACCOUNT_FILE, { force: true });
}
