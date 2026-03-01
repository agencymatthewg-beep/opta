import { render } from 'ink-testing-library';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState, SupabaseSession, SupabaseUser } from '../../src/accounts/types.js';

const loadAccountStateMock = vi.fn<() => Promise<AccountState | null>>();
const runOAuthLoginFlowMock = vi.fn<(options?: unknown) => Promise<unknown>>();

vi.mock('../../src/accounts/storage.js', () => ({
  loadAccountState: loadAccountStateMock,
}));

vi.mock('../../src/commands/account.js', () => ({
  runOAuthLoginFlow: runOAuthLoginFlowMock,
}));

import { SettingsOverlay } from '../../src/tui/SettingsOverlay.js';

const flush = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const baseProps = {
  animationPhase: 'open' as const,
  animationProgress: 1,
  config: {} as Record<string, unknown>,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

const originalNodeEnv = process.env['NODE_ENV'];
const originalVitest = process.env['VITEST'];
const originalOptaSupabaseUrl = process.env['OPTA_SUPABASE_URL'];
const originalOptaSupabaseAnonKey = process.env['OPTA_SUPABASE_ANON_KEY'];
const originalPublicSupabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const originalPublicSupabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const mockUser: SupabaseUser = {
  id: 'user_1',
  email: 'person@example.com',
};

const mockSession: SupabaseSession = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1_900_000_000,
};

beforeEach(() => {
  loadAccountStateMock.mockReset();
  runOAuthLoginFlowMock.mockReset();

  loadAccountStateMock.mockResolvedValue(null);
  runOAuthLoginFlowMock.mockResolvedValue({
    config: {
      url: 'https://proj-ref.supabase.co',
      anonKey: 'anon-key',
      project: 'proj-ref',
    },
    state: {
      project: 'proj-ref',
      updatedAt: '2026-02-28T00:00:00.000Z',
      user: mockUser,
      session: mockSession,
    },
    user: mockUser,
    session: mockSession,
    signInUrl: 'https://accounts.optalocal.com/sign-in',
  });

  process.env['NODE_ENV'] = 'development';
  delete process.env['VITEST'];
  process.env['OPTA_SUPABASE_URL'] = 'https://proj-ref.supabase.co';
  process.env['OPTA_SUPABASE_ANON_KEY'] = 'anon-key';
  delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = originalNodeEnv;

  if (originalVitest === undefined) delete process.env['VITEST'];
  else process.env['VITEST'] = originalVitest;

  if (originalOptaSupabaseUrl === undefined) delete process.env['OPTA_SUPABASE_URL'];
  else process.env['OPTA_SUPABASE_URL'] = originalOptaSupabaseUrl;

  if (originalOptaSupabaseAnonKey === undefined) delete process.env['OPTA_SUPABASE_ANON_KEY'];
  else process.env['OPTA_SUPABASE_ANON_KEY'] = originalOptaSupabaseAnonKey;

  if (originalPublicSupabaseUrl === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
  else process.env['NEXT_PUBLIC_SUPABASE_URL'] = originalPublicSupabaseUrl;

  if (originalPublicSupabaseAnonKey === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  else process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = originalPublicSupabaseAnonKey;
});

describe('SettingsOverlay account auto sign-in', () => {
  it('auto-opens Opta browser sign-in after account scan when unauthenticated', async () => {
    const { stdin } = render(<SettingsOverlay {...baseProps} />);
    await flush();
    stdin.write('7');
    await flush(80);

    expect(loadAccountStateMock).toHaveBeenCalled();
    expect(runOAuthLoginFlowMock).toHaveBeenCalledTimes(1);
    expect(runOAuthLoginFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        browserMode: 'opta-session',
      }),
    );
  });

  it('does not auto-open sign-in when Supabase auth config is missing', async () => {
    delete process.env['OPTA_SUPABASE_URL'];
    delete process.env['OPTA_SUPABASE_ANON_KEY'];

    const previousCwd = process.cwd();
    const isolatedCwd = mkdtempSync(join(tmpdir(), 'opta-settings-overlay-'));

    try {
      process.chdir(isolatedCwd);
      const { stdin } = render(<SettingsOverlay {...baseProps} />);
      await flush();
      stdin.write('7');
      await flush(80);

      expect(loadAccountStateMock).toHaveBeenCalled();
      expect(runOAuthLoginFlowMock).not.toHaveBeenCalled();
    } finally {
      process.chdir(previousCwd);
      rmSync(isolatedCwd, { force: true, recursive: true });
    }
  });

  it('attempts auto sign-in once per Account-page visit', async () => {
    const { stdin } = render(<SettingsOverlay {...baseProps} />);
    await flush();

    stdin.write('7');
    await flush(80);
    expect(runOAuthLoginFlowMock).toHaveBeenCalledTimes(1);

    stdin.write('1');
    await flush(40);

    stdin.write('7');
    await flush(80);
    expect(runOAuthLoginFlowMock).toHaveBeenCalledTimes(2);
  });
});
