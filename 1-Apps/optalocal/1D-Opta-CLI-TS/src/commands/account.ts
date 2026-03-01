import { createInterface } from 'readline';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import type { AccountState, SupabaseSession, SupabaseUser } from '../accounts/types.js';
import {
  exchangeAuthCodeForSession,
  fetchUserWithAccessToken,
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
import { registerCliDevice, upsertSessionRecord } from '../accounts/cloud.js';
import { EXIT, type ExitCode, ExitError } from '../core/errors.js';

interface AccountAuthOptions {
  identifier?: string;
  name?: string;
  oauth?: boolean;
  oauthOptaBrowser?: boolean;
  oauthCookieJar?: string;
  oauthHeadless?: boolean;
  timeout?: string;
  accountsUrl?: string;
  json?: boolean;
}

interface AccountCommandOptions {
  json?: boolean;
}

interface BrowserAuthCallbackResult {
  authCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

type OAuthBrowserMode = 'system' | 'opta-session';

export interface OAuthLoginFlowOptions {
  accountsUrl?: string;
  timeout?: string;
  env?: NodeJS.ProcessEnv;
  browserMode?: OAuthBrowserMode;
  browserOpener?: (url: string) => void | Promise<void>;
  optaCookieJar?: string;
  optaHeadless?: boolean;
  onSignInUrl?: (url: string) => void;
}

export interface OAuthLoginFlowResult {
  config: {
    url: string;
    anonKey: string;
    project: string;
  };
  state: AccountState;
  user: SupabaseUser | null;
  session: SupabaseSession;
  signInUrl: string;
}

const DEFAULT_ACCOUNTS_URL = 'https://accounts.optalocal.com';
const DEFAULT_OAUTH_TIMEOUT_SECONDS = 180;
const DEFAULT_OPTA_COOKIE_JAR = 'default';
const OPTA_COOKIE_JARS_DIR = join(
  homedir(),
  '.config',
  'opta',
  'browser',
  'account-cookie-jars',
);

interface BrowserAuthCallbackServerOptions {
  expectedState: string;
  expectedHandoffToken?: string;
  allowLegacyTokenCallback: boolean;
  timeoutMs: number;
}

interface BrowserAuthCallbackServerHandle {
  port: number;
  waitForResult: Promise<BrowserAuthCallbackResult>;
  cancel: (reason: string) => void;
}

interface OAuthBrowserLauncher {
  mode: OAuthBrowserMode;
  open: (url: string) => Promise<void>;
  close: () => Promise<void>;
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
  try {
    return resolveConfigOrThrow();
  } catch {
    fail(
      'Supabase Auth is not configured. Set OPTA_SUPABASE_URL and OPTA_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      json,
      EXIT.MISUSE,
    );
  }
}

function resolveConfigOrThrow(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  anonKey: string;
  project: string;
} {
  const config = resolveSupabaseAuthConfig(env);
  if (!config) {
    throw new Error(
      'Supabase Auth is not configured. Set OPTA_SUPABASE_URL and OPTA_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).',
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


async function enrichAccountState(state: AccountState): Promise<AccountState> {
  let next = state;
  const deviceId = await registerCliDevice(state).catch(() => null);
  if (deviceId) next = { ...next, deviceId };
  await upsertSessionRecord(next, 'cli').catch(() => undefined);
  await saveAccountState(next);
  return next;
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

function openInBrowser(url: string): void {
  if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function normalizeCookieJarId(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_OPTA_COOKIE_JAR;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) {
    throw new Error(
      'OAuth cookie jar ID must match /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/ (letters, numbers, ., _, -).',
    );
  }
  return value;
}

async function ensureCookieJarProfileDir(cookieJarId: string): Promise<string> {
  const profileDir = join(OPTA_COOKIE_JARS_DIR, cookieJarId);
  await mkdir(profileDir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    await chmod(OPTA_COOKIE_JARS_DIR, 0o700).catch(() => {});
    await chmod(profileDir, 0o700).catch(() => {});
  }
  return profileDir;
}

function formatBrowserLaunchFailure(prefix: string, error: unknown): Error {
  const detail = error instanceof Error && error.message.trim().length > 0
    ? error.message
    : String(error);
  return new Error(`${prefix}: ${detail}`);
}

async function createOAuthBrowserLauncher(options: OAuthLoginFlowOptions): Promise<OAuthBrowserLauncher> {
  const mode: OAuthBrowserMode = options.browserMode ?? 'system';
  if (mode === 'system') {
    return {
      mode,
      open: async (url: string) => {
        (options.browserOpener ?? openInBrowser)(url);
      },
      close: async () => {},
    };
  }

  if (options.browserOpener) {
    return {
      mode,
      open: async (url: string) => {
        await options.browserOpener!(url);
      },
      close: async () => {},
    };
  }

  const cookieJarId = normalizeCookieJarId(options.optaCookieJar);
  const profileDir = await ensureCookieJarProfileDir(cookieJarId);
  const sessionId = `account-oauth-${randomBytes(6).toString('hex')}`;
  const headless = options.optaHeadless ?? false;
  const { NativeSessionManager } = await import('../browser/native-session-manager.js');
  const manager = new NativeSessionManager({ cwd: process.cwd() });
  let sessionOpened = false;

  return {
    mode,
    open: async (url: string) => {
      const openResult = await manager.openSession({
        sessionId,
        runId: sessionId,
        mode: 'isolated',
        headless,
        profileDir,
      });
      if (!openResult.ok) {
        throw formatBrowserLaunchFailure(
          'Failed to open Opta browser session',
          openResult.error?.message ?? 'Unknown browser runtime error',
        );
      }
      sessionOpened = true;

      const navigateResult = await manager.navigate(sessionId, {
        url,
        waitUntil: 'domcontentloaded',
      });
      if (!navigateResult.ok) {
        await manager.closeSession(sessionId).catch(() => {});
        sessionOpened = false;
        throw formatBrowserLaunchFailure(
          'Failed to navigate Opta browser session',
          navigateResult.error?.message ?? 'Unknown navigation error',
        );
      }
    },
    close: async () => {
      if (!sessionOpened) return;
      sessionOpened = false;
      await manager.closeSession(sessionId).catch(() => {});
    },
  };
}

function toBase64Url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = toBase64Url(randomBytes(64));
  const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function parseAccountsBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('Invalid accounts URL. Set --accounts-url or OPTA_ACCOUNTS_URL.');
  }

  const isLocal =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!isLocal && parsed.protocol !== 'https:') {
    throw new Error(
      'Accounts URL must use HTTPS (except localhost/127.0.0.1 for local testing).',
    );
  }

  return `${parsed.protocol}//${parsed.host}`;
}

function parseOAuthTimeoutMs(raw: string): number {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 1800) {
    throw new Error('OAuth timeout must be an integer between 30 and 1800 seconds.');
  }
  return seconds * 1000;
}

function resolveAccountsBaseUrlRaw(
  accountsUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    accountsUrl ??
    env['OPTA_ACCOUNTS_URL'] ??
    env['NEXT_PUBLIC_ACCOUNTS_URL'] ??
    DEFAULT_ACCOUNTS_URL
  );
}

function callbackPageHtml(title: string, detail: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #09090f; color: #f5f5f7; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { max-width: 520px; padding: 20px 22px; border-radius: 12px; border: 1px solid #2a2a3a; background: #131320; box-shadow: 0 18px 50px rgba(0,0,0,0.35); }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0; color: #c7c9d4; line-height: 1.5; }
    code { color: #c4b5fd; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${detail}</p>
  </div>
</body>
</html>`;
}

async function startBrowserAuthCallbackServer(
  options: BrowserAuthCallbackServerOptions,
): Promise<BrowserAuthCallbackServerHandle> {
  const {
    expectedState,
    expectedHandoffToken,
    allowLegacyTokenCallback,
    timeoutMs,
  } = options;
  let settled = false;
  let settleSuccess!: (result: BrowserAuthCallbackResult) => void;
  let settleFailure!: (error: Error) => void;

  const waitForResult = new Promise<BrowserAuthCallbackResult>((resolve, reject) => {
    settleSuccess = resolve;
    settleFailure = reject;
  });

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname !== '/callback') {
      response.statusCode = 404;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end('Not found');
      return;
    }

    const state = requestUrl.searchParams.get('state')?.trim() ?? '';
    if (!state || state !== expectedState) {
      response.statusCode = 400;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        callbackPageHtml(
          'Opta Sign-In Failed',
          'State verification failed. Return to your terminal and retry <code>opta account login --oauth</code>.',
        ),
      );
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() => settleFailure(new Error('State mismatch from browser callback.')));
      }
      return;
    }

    if (expectedHandoffToken) {
      const handoff = requestUrl.searchParams.get('handoff')?.trim() ?? '';
      if (!handoff || handoff !== expectedHandoffToken) {
        response.statusCode = 400;
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(
          callbackPageHtml(
            'Opta Sign-In Failed',
            'Callback handoff token did not match. Return to your terminal and retry sign-in.',
          ),
        );
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          server.close(() => settleFailure(new Error('Callback handoff token mismatch.')));
        }
        return;
      }
    }

    const providerError = requestUrl.searchParams.get('error');
    if (providerError) {
      const providerErrorDescription =
        requestUrl.searchParams.get('error_description') ?? providerError;
      response.statusCode = 400;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        callbackPageHtml(
          'Opta Sign-In Failed',
          `Provider returned an error: <code>${providerErrorDescription}</code>.`,
        ),
      );
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() =>
          settleFailure(new Error(`Accounts sign-in failed: ${providerErrorDescription}`)),
        );
      }
      return;
    }

    const authCode = requestUrl.searchParams.get('code')?.trim() ?? '';
    if (authCode) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        callbackPageHtml(
          'Opta Sign-In Complete',
          'Authentication succeeded. You can close this tab and return to the terminal.',
        ),
      );

      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() =>
          settleSuccess({
            authCode,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
          }),
        );
      }
      return;
    }

    if (!allowLegacyTokenCallback) {
      response.statusCode = 400;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        callbackPageHtml(
          'Opta Sign-In Failed',
          'Callback did not include an auth code. Retry sign-in and complete the full redirect flow.',
        ),
      );
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() => settleFailure(new Error('Missing auth code in callback.')));
      }
      return;
    }

    const accessToken = requestUrl.searchParams.get('access_token')?.trim() ?? '';
    const refreshToken = requestUrl.searchParams.get('refresh_token')?.trim() ?? '';
    const expiresAtRaw = requestUrl.searchParams.get('expires_at')?.trim() ?? '';
    const expiresAt =
      expiresAtRaw && /^\d+$/.test(expiresAtRaw)
        ? Number.parseInt(expiresAtRaw, 10)
        : null;

    if (!accessToken || !refreshToken) {
      response.statusCode = 400;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        callbackPageHtml(
          'Opta Sign-In Failed',
          'Callback did not include required tokens. Return to your terminal and retry.',
        ),
      );
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() => settleFailure(new Error('Missing access or refresh token in callback.')));
      }
      return;
    }

    response.statusCode = 200;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(
      callbackPageHtml(
        'Opta Sign-In Complete',
        'Authentication succeeded. You can close this tab and return to the terminal.',
      ),
    );

    if (!settled) {
      settled = true;
      clearTimeout(timeoutId);
      server.close(() =>
        settleSuccess({
          authCode: null,
          accessToken,
          refreshToken,
          expiresAt,
        }),
      );
    }
  });

  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    server.close(() => {
      settleFailure(new Error('Timed out waiting for browser authentication callback.'));
    });
  }, timeoutMs);

  server.on('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    settleFailure(error instanceof Error ? error : new Error(String(error)));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();
  const port =
    address && typeof address === 'object' && typeof address.port === 'number'
      ? address.port
      : null;
  if (!port) {
    clearTimeout(timeoutId);
    server.close();
    throw new Error('Failed to determine local callback port.');
  }

  const cancel = (reason: string): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    server.close(() => settleFailure(new Error(reason)));
  };

  return { port, waitForResult, cancel };
}

export async function runOAuthLoginFlow(
  options: OAuthLoginFlowOptions = {},
): Promise<OAuthLoginFlowResult> {
  const env = options.env ?? process.env;
  const config = resolveConfigOrThrow(env);
  const browserMode: OAuthBrowserMode = options.browserMode ?? 'system';
  const timeoutRaw = options.timeout ??
    env['OPTA_ACCOUNT_OAUTH_TIMEOUT_SECONDS'] ??
    String(DEFAULT_OAUTH_TIMEOUT_SECONDS);
  const accountsBaseUrlRaw = resolveAccountsBaseUrlRaw(options.accountsUrl, env);
  const accountsBaseUrl = parseAccountsBaseUrl(accountsBaseUrlRaw);
  const timeoutMs = parseOAuthTimeoutMs(timeoutRaw);
  const pkce = buildPkcePair();
  const stateToken = randomBytes(16).toString('hex');
  const handoffToken = browserMode === 'opta-session'
    ? randomBytes(16).toString('hex')
    : undefined;
  const allowLegacyTokenCallback = browserMode !== 'opta-session';

  const callbackHandle = await startBrowserAuthCallbackServer({
    expectedState: stateToken,
    expectedHandoffToken: handoffToken,
    allowLegacyTokenCallback,
    timeoutMs,
  });

  const signInUrl = new URL('/sign-in', accountsBaseUrl);
  signInUrl.searchParams.set('mode', 'cli');
  signInUrl.searchParams.set('port', String(callbackHandle.port));
  signInUrl.searchParams.set('state', stateToken);
  signInUrl.searchParams.set('response_type', 'code');
  signInUrl.searchParams.set('code_challenge', pkce.codeChallenge);
  signInUrl.searchParams.set('code_challenge_method', 'S256');
  if (handoffToken) {
    signInUrl.searchParams.set('handoff', handoffToken);
  }
  const signInUrlString = signInUrl.toString();
  options.onSignInUrl?.(signInUrlString);

  const launcher = await createOAuthBrowserLauncher(options);
  try {
    await launcher.open(signInUrlString);
  } catch (error) {
    if (browserMode === 'opta-session') {
      callbackHandle.cancel('Sign-in browser did not launch successfully.');
      await launcher.close().catch(() => {});
      throw formatBrowserLaunchFailure('Opta browser OAuth launch failed', error);
    }
    // System-browser mode remains best effort; caller can still open URL manually.
  }

  const callback = await callbackHandle.waitForResult;
  let session: SupabaseSession | null = null;
  let user: SupabaseUser | null = null;

  try {
    if (callback.authCode) {
      const exchange = await exchangeAuthCodeForSession(config, callback.authCode, pkce.codeVerifier);
      session = exchange.session;
      user = exchange.user;
      if (!session) {
        throw new Error('OAuth code exchange succeeded but no session was returned.');
      }
    } else if (callback.accessToken && callback.refreshToken && allowLegacyTokenCallback) {
      // Legacy compatibility: older accounts portals may still return tokens directly.
      const expiresAt = callback.expiresAt ?? undefined;
      const nowEpoch = Math.floor(Date.now() / 1000);
      const expiresIn = expiresAt ? Math.max(1, expiresAt - nowEpoch) : 3600;
      session = {
        access_token: callback.accessToken,
        refresh_token: callback.refreshToken,
        token_type: 'bearer',
        expires_in: expiresIn,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      };

      try {
        user = await fetchUserWithAccessToken(config, callback.accessToken);
      } catch {
        // Non-fatal: session has already been established.
      }
    } else {
      throw new Error('OAuth callback did not return an auth code or session tokens.');
    }
  } finally {
    await launcher.close().catch(() => {});
  }

  const state = buildState(config.project, session, user);
  await enrichAccountState(state);

  return {
    config,
    state,
    user,
    session,
    signInUrl: signInUrlString,
  };
}

async function accountLoginOAuth(opts: AccountAuthOptions): Promise<void> {
  const browserMode: OAuthBrowserMode = opts.oauthOptaBrowser ? 'opta-session' : 'system';
  const result = await runOAuthLoginFlow({
    accountsUrl: opts.accountsUrl,
    timeout: opts.timeout,
    browserMode,
    optaCookieJar: opts.oauthCookieJar,
    optaHeadless: opts.oauthHeadless,
    onSignInUrl: opts.json
      ? undefined
      : (url) => {
          const target = browserMode === 'opta-session'
            ? 'Opening Opta browser session for accounts sign-in'
            : 'Opening system browser for accounts sign-in';
          console.log(chalk.dim(`${target} (${new URL(url).origin})...`));
          console.log(chalk.dim(`If browser launch is blocked, open:\n  ${url}`));
        },
  });

  const payload = {
    ok: true,
    action: 'login',
    mode: browserMode === 'opta-session' ? 'oauth-opta-browser' : 'oauth',
    project: result.config.project,
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

  const browserLabel = browserMode === 'opta-session' ? 'Opta browser session' : 'browser';
  console.log(chalk.green('✓') + ` Logged in via ${browserLabel} for project ${chalk.cyan(result.config.project)}.`);
  if (!result.user) {
    console.log(chalk.dim('  Session established. User profile will hydrate on next account refresh.'));
  }
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
    await enrichAccountState(state);

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
    const useOAuth = Boolean(opts.oauth || opts.oauthOptaBrowser);
    if ((opts.oauthCookieJar || opts.oauthHeadless) && !opts.oauthOptaBrowser) {
      fail(
        '--oauth-cookie-jar / --oauth-headless require --oauth-opta-browser.',
        opts.json,
        EXIT.MISUSE,
      );
    }

    if (useOAuth) {
      await accountLoginOAuth(opts);
      return;
    }

    const identifierRaw = requireCredential(
      opts.identifier,
      'Identifier (or use --oauth / --oauth-opta-browser)',
      opts.json,
    );
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
    await enrichAccountState(state);

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
