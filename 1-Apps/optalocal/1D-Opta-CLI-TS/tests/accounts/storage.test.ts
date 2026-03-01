import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState, SupabaseSession, SupabaseUser } from '../../src/accounts/types.js';

// ---------------------------------------------------------------------------
// Mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue(process.env.HOME || '/mock-home'),
}));

// Prevent actual dynamic imports to supabase module
vi.mock('../../src/accounts/supabase.js', () => ({
  refreshSession: vi.fn(),
  resolveSupabaseAuthConfig: vi.fn().mockReturnValue(null),
}));

import { readFile, writeFile, mkdir, chmod, rm } from 'node:fs/promises';
import {
  accountStatePath,
  loadAccountState,
  saveAccountState,
  clearAccountState,
} from '../../src/accounts/storage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<SupabaseUser> = {}): SupabaseUser {
  return {
    id: 'user-123',
    email: 'matt@test.com',
    ...overrides,
  };
}

function makeSession(overrides: Partial<SupabaseSession> = {}): SupabaseSession {
  return {
    access_token: 'access-tok-abc',
    refresh_token: 'refresh-tok-xyz',
    token_type: 'bearer',
    expires_in: 3600,
    ...overrides,
  };
}

function makeAccountState(overrides: Partial<AccountState> = {}): AccountState {
  return {
    project: 'opta-test',
    session: makeSession(),
    user: makeUser(),
    updatedAt: '2026-01-15T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('accountStatePath', () => {
  it('returns the path under ~/.config/opta/account.json', () => {
    const path = accountStatePath();
    expect(path).toBe(`${process.env.HOME || '/home/runner'}/.config/opta/account.json`);
  });
});

describe('loadAccountState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when file does not exist', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('returns null when file contains invalid JSON', async () => {
    vi.mocked(readFile).mockResolvedValue('not json at all');
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('returns null when file contains valid JSON but invalid shape', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('returns null when project is missing', async () => {
    const state = { ...makeAccountState(), project: '' };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('returns null when updatedAt is missing', async () => {
    const state = { ...makeAccountState(), updatedAt: '' };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('returns null when session has invalid shape', async () => {
    const state = {
      project: 'opta',
      updatedAt: '2026-01-01T00:00:00Z',
      session: { invalid: true },
      user: null,
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('returns null when user has invalid shape (missing id)', async () => {
    const state = {
      project: 'opta',
      updatedAt: '2026-01-01T00:00:00Z',
      session: null,
      user: { email: 'a@b.com' }, // no id field
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));
    const result = await loadAccountState();
    expect(result).toBeNull();
  });

  it('loads valid account state without token refresh', async () => {
    // Session without expires_at => no refresh attempted
    const state = makeAccountState({ session: makeSession() });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));
    const result = await loadAccountState();
    expect(result).not.toBeNull();
    expect(result!.project).toBe('opta-test');
    expect(result!.session!.access_token).toBe('access-tok-abc');
    expect(result!.user!.id).toBe('user-123');
  });

  it('loads valid state with null session and null user', async () => {
    const state = makeAccountState({ session: null, user: null });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));
    const result = await loadAccountState();
    expect(result).not.toBeNull();
    expect(result!.session).toBeNull();
    expect(result!.user).toBeNull();
  });

  it('attempts token refresh when expires_at is within 5 minutes', async () => {
    const { refreshSession, resolveSupabaseAuthConfig } = await import(
      '../../src/accounts/supabase.js'
    );
    const expiringSession = makeSession({
      expires_at: Math.floor(Date.now() / 1000) + 100, // expires in 100s (< 300s threshold)
    });
    const state = makeAccountState({ session: expiringSession });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));

    vi.mocked(resolveSupabaseAuthConfig).mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'anon-key',
      project: 'test',
    });
    vi.mocked(refreshSession).mockResolvedValue({
      session: makeSession({ access_token: 'refreshed-tok' }),
      user: makeUser(),
    });

    const result = await loadAccountState();
    expect(result).not.toBeNull();
    expect(result!.session!.access_token).toBe('refreshed-tok');
    expect(refreshSession).toHaveBeenCalledOnce();
    // Verify saveAccountState was called (writeFile is the mock)
    expect(writeFile).toHaveBeenCalled();
  });

  it('returns state with null session when refresh fails', async () => {
    const { refreshSession, resolveSupabaseAuthConfig } = await import(
      '../../src/accounts/supabase.js'
    );
    const expiringSession = makeSession({
      expires_at: Math.floor(Date.now() / 1000) + 100,
    });
    const state = makeAccountState({ session: expiringSession });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));

    vi.mocked(resolveSupabaseAuthConfig).mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'anon-key',
      project: 'test',
    });
    vi.mocked(refreshSession).mockRejectedValue(new Error('network error'));

    const result = await loadAccountState();
    expect(result).not.toBeNull();
    expect(result!.session).toBeNull(); // nulled out due to failed refresh
    expect(result!.project).toBe('opta-test');
  });

  it('returns state with null session when refresh returns null session', async () => {
    const { refreshSession, resolveSupabaseAuthConfig } = await import(
      '../../src/accounts/supabase.js'
    );
    const expiringSession = makeSession({
      expires_at: Math.floor(Date.now() / 1000) + 100,
    });
    const state = makeAccountState({ session: expiringSession });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));

    vi.mocked(resolveSupabaseAuthConfig).mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'anon-key',
      project: 'test',
    });
    vi.mocked(refreshSession).mockResolvedValue({ session: null, user: null });

    const result = await loadAccountState();
    expect(result).not.toBeNull();
    // refresh returned null session, so refresh path is not entered (result.session stays null)
    expect(result!.session).toBeNull();
  });

  it('skips refresh when supabase config is not available', async () => {
    const { refreshSession, resolveSupabaseAuthConfig } = await import(
      '../../src/accounts/supabase.js'
    );
    const expiringSession = makeSession({
      expires_at: Math.floor(Date.now() / 1000) + 100,
    });
    const state = makeAccountState({ session: expiringSession });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));

    vi.mocked(resolveSupabaseAuthConfig).mockReturnValue(null);

    const result = await loadAccountState();
    expect(result).not.toBeNull();
    expect(result!.session).toBeNull(); // no config => refresh not attempted => token expired
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('does not refresh when token is not near expiry', async () => {
    const { refreshSession } = await import('../../src/accounts/supabase.js');
    const validSession = makeSession({
      expires_at: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    });
    const state = makeAccountState({ session: validSession });
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(state));

    const result = await loadAccountState();
    expect(result).not.toBeNull();
    expect(result!.session!.access_token).toBe('access-tok-abc');
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe('saveAccountState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates directory and writes file', async () => {
    const state = makeAccountState();
    await saveAccountState(state);

    expect(mkdir).toHaveBeenCalledWith(
      '/mock-home/.config/opta',
      expect.objectContaining({ recursive: true }),
    );
    expect(writeFile).toHaveBeenCalledWith(
      '${process.env.HOME || '/home/runner'}/.config/opta/account.json',
      expect.stringContaining('"project"'),
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('writes valid JSON', async () => {
    const state = makeAccountState();
    await saveAccountState(state);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    expect(() => JSON.parse(writtenContent)).not.toThrow();
    const parsed = JSON.parse(writtenContent);
    expect(parsed.project).toBe('opta-test');
    expect(parsed.session.access_token).toBe('access-tok-abc');
  });

  it('writes pretty-printed JSON with trailing newline', async () => {
    const state = makeAccountState();
    await saveAccountState(state);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    expect(writtenContent.endsWith('\n')).toBe(true);
    expect(writtenContent).toContain('\n  ');
  });

  it('sets restrictive file permissions (0o600)', async () => {
    const state = makeAccountState();
    await saveAccountState(state);

    expect(writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ mode: 0o600 }),
    );
  });

  it('enforces directory permissions (chmod called)', async () => {
    const state = makeAccountState();
    await saveAccountState(state);

    // chmod is called for the directory (0o700) and the file (0o600)
    expect(chmod).toHaveBeenCalled();
  });
});

describe('clearAccountState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the account file with force flag', async () => {
    await clearAccountState();
    expect(rm).toHaveBeenCalledWith('${process.env.HOME || '/home/runner'}/.config/opta/account.json', { force: true });
  });

  it('does not throw if file does not exist (force: true)', async () => {
    vi.mocked(rm).mockResolvedValue(undefined);
    await expect(clearAccountState()).resolves.toBeUndefined();
  });
});
