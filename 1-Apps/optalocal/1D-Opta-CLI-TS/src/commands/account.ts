import { createInterface } from 'readline';
import chalk from 'chalk';
import type { AccountState, SupabaseSession, SupabaseUser } from '../accounts/types.js';
import {
  SupabaseRequestError,
  loginWithPassword,
  logoutSession,
  parseAccountIdentifier,
  resolveSupabaseAuthConfig,
  signUpWithPassword,
} from '../accounts/supabase.js';
import {
  clearAccountState,
  loadAccountState,
  saveAccountState,
} from '../accounts/storage.js';
import { EXIT, type ExitCode, ExitError } from '../core/errors.js';

interface AccountAuthOptions {
  identifier?: string;
  name?: string;
  json?: boolean;
}

interface AccountCommandOptions {
  json?: boolean;
}

function fail(message: string, json: boolean | undefined, code: ExitCode): never {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(chalk.red('✗') + ` ${message}`);
  }
  throw new ExitError(code);
}

async function promptPassword(prompt: string, provided?: string): Promise<string> {
  if (provided !== undefined) return provided;
  if (process.env['OPTA_PASSWORD']) return process.env['OPTA_PASSWORD'];
  if (!process.stdin.isTTY) {
    throw new Error('Password required. Set OPTA_PASSWORD env var in non-interactive mode.');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    rl.question('', (answer) => {
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

function resolveConfigOrFail(json: boolean | undefined): {
  url: string;
  anonKey: string;
  project: string;
} {
  const config = resolveSupabaseAuthConfig();
  if (!config) {
    fail(
      'Supabase Auth is not configured. Set OPTA_SUPABASE_URL and OPTA_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      json,
      EXIT.MISUSE,
    );
  }
  return config;
}

function requireCredential(value: string | undefined, label: string, json: boolean | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    fail(`${label} is required.`, json, EXIT.MISUSE);
  }
  return trimmed;
}

function toIsoExpiry(session: SupabaseSession | null): string | null {
  if (!session || typeof session.expires_at !== 'number') return null;
  if (!Number.isFinite(session.expires_at)) return null;
  const epochMs = session.expires_at > 10_000_000_000
    ? session.expires_at
    : session.expires_at * 1000;
  return new Date(epochMs).toISOString();
}

function summarizeUser(user: SupabaseUser | null): {
  id: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
} {
  const metadata = user?.user_metadata;
  const name =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof metadata['name'] === 'string'
      ? metadata['name']
      : null;
  return {
    id: user?.id ?? null,
    email: typeof user?.email === 'string' ? user.email : null,
    phone: typeof user?.phone === 'string' ? user.phone : null,
    name,
  };
}

function buildState(
  project: string,
  session: SupabaseSession | null,
  user: SupabaseUser | null,
): AccountState {
  return {
    project,
    session,
    user,
    updatedAt: new Date().toISOString(),
  };
}

function errorCodeFromStatus(status: number): ExitCode {
  if (status === 401 || status === 403) return EXIT.PERMISSION;
  if (status === 400 || status === 422) return EXIT.MISUSE;
  return EXIT.ERROR;
}

function handleUnexpectedError(err: unknown, json: boolean | undefined): never {
  if (err instanceof ExitError) throw err;
  if (err instanceof SupabaseRequestError) {
    fail(err.message, json, errorCodeFromStatus(err.status));
  }
  if (err instanceof TypeError) {
    fail('Unable to reach Supabase Auth API.', json, EXIT.NO_CONNECTION);
  }
  if (err instanceof Error) {
    fail(err.message, json, EXIT.ERROR);
  }
  fail('Unknown account error.', json, EXIT.ERROR);
}

export async function accountSignup(opts: AccountAuthOptions): Promise<void> {
  try {
    const identifierRaw = requireCredential(opts.identifier, 'Identifier', opts.json);
    const password = await promptPassword('Password: ');
    if (!password.trim()) {
      fail('Password is required.', opts.json, EXIT.MISUSE);
    }
    const identifier = parseAccountIdentifier(identifierRaw);
    const config = resolveConfigOrFail(opts.json);

    const result = await signUpWithPassword(config, identifier, password, opts.name);
    const state = buildState(config.project, result.session, result.user);
    await saveAccountState(state);

    const payload = {
      ok: true,
      action: 'signup',
      project: config.project,
      authenticated: Boolean(result.session),
      user: summarizeUser(result.user),
      session: result.session
        ? {
          tokenType: result.session.token_type,
          expiresAt: toIsoExpiry(result.session),
        }
        : null,
    };

    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    if (payload.authenticated) {
      console.log(chalk.green('✓') + ` Signed up and logged in for project ${chalk.cyan(config.project)}.`);
    } else {
      console.log(chalk.green('✓') + ` Signed up for project ${chalk.cyan(config.project)}.`);
      console.log(chalk.dim('  Session not issued. Confirm your account, then run `opta account login`.'));
    }
  } catch (err) {
    handleUnexpectedError(err, opts.json);
  }
}

export async function accountLogin(opts: AccountAuthOptions): Promise<void> {
  try {
    const identifierRaw = requireCredential(opts.identifier, 'Identifier', opts.json);
    const password = await promptPassword('Password: ');
    if (!password.trim()) {
      fail('Password is required.', opts.json, EXIT.MISUSE);
    }
    const identifier = parseAccountIdentifier(identifierRaw);
    const config = resolveConfigOrFail(opts.json);

    const result = await loginWithPassword(config, identifier, password);
    if (!result.session) {
      fail('Login succeeded but no session was returned by Supabase.', opts.json, EXIT.ERROR);
    }

    const state = buildState(config.project, result.session, result.user);
    await saveAccountState(state);

    const payload = {
      ok: true,
      action: 'login',
      project: config.project,
      authenticated: true,
      user: summarizeUser(result.user),
      session: {
        tokenType: result.session.token_type,
        expiresAt: toIsoExpiry(result.session),
      },
    };

    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(chalk.green('✓') + ` Logged in for project ${chalk.cyan(config.project)}.`);
  } catch (err) {
    handleUnexpectedError(err, opts.json);
  }
}

export async function accountStatus(opts: AccountCommandOptions = {}): Promise<void> {
  const state = await loadAccountState();
  const authenticated = Boolean(state?.session?.access_token);
  const payload = {
    ok: true,
    authenticated,
    project: state?.project ?? null,
    user: summarizeUser(state?.user ?? null),
    session: state?.session
      ? {
        tokenType: state.session.token_type,
        expiresAt: toIsoExpiry(state.session),
      }
      : null,
    updatedAt: state?.updatedAt ?? null,
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!state) {
    console.log(chalk.dim('Not logged in. Run `opta account login ...`'));
    return;
  }

  if (!authenticated) {
    console.log(chalk.yellow('!') + ` Account state found for project ${chalk.cyan(state.project)} but no active session.`);
    return;
  }

  const identity = payload.user.email ?? payload.user.phone ?? payload.user.id ?? 'unknown-user';
  console.log(chalk.green('✓') + ` Logged in as ${identity}`);
  console.log(chalk.dim(`  Project: ${state.project}`));
  if (payload.session?.expiresAt) {
    console.log(chalk.dim(`  Expires: ${payload.session.expiresAt}`));
  }
}

export async function accountLogout(opts: AccountCommandOptions = {}): Promise<void> {
  const state = await loadAccountState();
  let remoteRevoked = false;
  let remoteWarning: string | null = null;

  if (state?.session?.access_token) {
    const config = resolveSupabaseAuthConfig();
    if (config) {
      try {
        await logoutSession(config, state.session.access_token);
        remoteRevoked = true;
      } catch (err) {
        if (err instanceof SupabaseRequestError || err instanceof Error) {
          remoteWarning = err.message;
        } else {
          remoteWarning = 'Remote logout failed.';
        }
      }
    } else {
      remoteWarning = 'Skipped remote logout because Supabase env vars are not configured.';
    }
  }

  await clearAccountState();

  const payload = {
    ok: true,
    action: 'logout',
    cleared: true,
    remoteRevoked,
    warning: remoteWarning,
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.green('✓') + ' Cleared local account session.');
  if (remoteWarning) {
    console.log(chalk.yellow('!') + ` ${remoteWarning}`);
  } else if (remoteRevoked) {
    console.log(chalk.dim('  Remote Supabase session revoked.'));
  }
}
