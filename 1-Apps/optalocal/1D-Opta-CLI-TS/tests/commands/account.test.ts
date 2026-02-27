import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT, ExitError } from '../../src/core/errors.js';
import type { AccountState } from '../../src/accounts/types.js';

const loadAccountStateMock = vi.fn<() => Promise<AccountState | null>>();
const saveAccountStateMock = vi.fn<(state: AccountState) => Promise<void>>();
const clearAccountStateMock = vi.fn<() => Promise<void>>();

vi.mock('../../src/accounts/storage.js', () => ({
  loadAccountState: loadAccountStateMock,
  saveAccountState: saveAccountStateMock,
  clearAccountState: clearAccountStateMock,
}));

let stdout: string[] = [];
let stderr: string[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

const originalOptaSupabaseUrl = process.env['OPTA_SUPABASE_URL'];
const originalOptaSupabaseAnonKey = process.env['OPTA_SUPABASE_ANON_KEY'];
const originalPublicSupabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const originalPublicSupabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const originalOptaPassword = process.env['OPTA_PASSWORD'];

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  stdout = [];
  stderr = [];
  fetchMock = vi.fn();

  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(' '));
  });

  loadAccountStateMock.mockReset();
  saveAccountStateMock.mockReset();
  clearAccountStateMock.mockReset();

  process.env['OPTA_SUPABASE_URL'] = 'https://proj-ref.supabase.co';
  process.env['OPTA_SUPABASE_ANON_KEY'] = 'anon-key';
  delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  if (originalOptaSupabaseUrl === undefined) delete process.env['OPTA_SUPABASE_URL'];
  else process.env['OPTA_SUPABASE_URL'] = originalOptaSupabaseUrl;

  if (originalOptaSupabaseAnonKey === undefined) delete process.env['OPTA_SUPABASE_ANON_KEY'];
  else process.env['OPTA_SUPABASE_ANON_KEY'] = originalOptaSupabaseAnonKey;

  if (originalPublicSupabaseUrl === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  else process.env['NEXT_PUBLIC_SUPABASE_URL'] = originalPublicSupabaseUrl;

  if (originalPublicSupabaseAnonKey === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  else process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = originalPublicSupabaseAnonKey;

  if (originalOptaPassword === undefined) delete process.env['OPTA_PASSWORD'];
  else process.env['OPTA_PASSWORD'] = originalOptaPassword;
});

describe('account command', () => {
  it('signup calls Supabase signup endpoint and persists account state', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      user: {
        id: 'user_1',
        email: 'person@example.com',
        user_metadata: { name: 'Pat' },
      },
      session: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 1_900_000_000,
      },
    }));

    process.env['OPTA_PASSWORD'] = 'secret-123';
    const { accountSignup } = await import('../../src/commands/account.js');
    await accountSignup({
      identifier: 'person@example.com',
      name: 'Pat',
      json: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proj-ref.supabase.co/auth/v1/signup',
      expect.objectContaining({ method: 'POST' }),
    );

    const callArgs = fetchMock.mock.calls[0] ?? [];
    const init = callArgs[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      email: 'person@example.com',
      password: 'secret-123',
      data: { name: 'Pat' },
    });

    expect(saveAccountStateMock).toHaveBeenCalledTimes(1);
    expect(saveAccountStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'proj-ref',
        user: expect.objectContaining({ id: 'user_1' }),
        session: expect.objectContaining({ access_token: 'access-token' }),
      }),
    );

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe('signup');
    expect(payload.project).toBe('proj-ref');
    expect(payload.authenticated).toBe(true);
  });

  it('login calls password token endpoint and stores normalized phone identifier', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 1_900_000_000,
      user: {
        id: 'user_phone',
        phone: '+15551234567',
      },
    }));

    process.env['OPTA_PASSWORD'] = 'pw';
    const { accountLogin } = await import('../../src/commands/account.js');
    await accountLogin({
      identifier: '+1 (555) 123-4567',
      json: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proj-ref.supabase.co/auth/v1/token?grant_type=password',
      expect.objectContaining({ method: 'POST' }),
    );

    const callArgs = fetchMock.mock.calls[0] ?? [];
    const init = callArgs[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      phone: '+15551234567',
      password: 'pw',
    });

    expect(saveAccountStateMock).toHaveBeenCalledTimes(1);
    expect(saveAccountStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'proj-ref',
        user: expect.objectContaining({ id: 'user_phone', phone: '+15551234567' }),
        session: expect.objectContaining({ access_token: 'access-token' }),
      }),
    );

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe('login');
    expect(payload.authenticated).toBe(true);
  });

  it('status returns unauthenticated JSON when there is no local state', async () => {
    loadAccountStateMock.mockResolvedValueOnce(null);

    const { accountStatus } = await import('../../src/commands/account.js');
    await accountStatus({ json: true });

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload.ok).toBe(true);
    expect(payload.authenticated).toBe(false);
    expect(payload.project).toBeNull();
    expect(payload.user).toEqual({
      id: null,
      email: null,
      phone: null,
      name: null,
    });
  });

  it('logout revokes remote session when possible and clears local account state', async () => {
    loadAccountStateMock.mockResolvedValueOnce({
      project: 'proj-ref',
      updatedAt: '2026-02-01T00:00:00.000Z',
      user: { id: 'user_1', email: 'person@example.com' },
      session: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const { accountLogout } = await import('../../src/commands/account.js');
    await accountLogout({ json: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proj-ref.supabase.co/auth/v1/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
    expect(clearAccountStateMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe('logout');
    expect(payload.cleared).toBe(true);
    expect(payload.remoteRevoked).toBe(true);
  });

  it('returns misuse error JSON when Supabase env config is missing', async () => {
    delete process.env['OPTA_SUPABASE_URL'];
    delete process.env['OPTA_SUPABASE_ANON_KEY'];
    process.env['OPTA_PASSWORD'] = 'secret';

    const { accountLogin } = await import('../../src/commands/account.js');
    await expect(accountLogin({
      identifier: 'person@example.com',
      json: true,
    })).rejects.toMatchObject<ExitError>({
      exitCode: EXIT.MISUSE,
    });

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload.ok).toBe(false);
    expect(String(payload.error)).toContain('Supabase Auth is not configured');
    expect(stderr).toHaveLength(0);
  });
});
