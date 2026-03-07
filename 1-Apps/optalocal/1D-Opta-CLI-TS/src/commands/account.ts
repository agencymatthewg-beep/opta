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
import {
  registerCliDevice,
  upsertSessionRecord,
  listCloudApiKeys,
  storeCloudApiKey,
  deleteCloudApiKey,
} from '../accounts/cloud.js';
import { storeGithubKey } from '../keychain/api-keys.js';
import { EXIT, type ExitCode, ExitError } from '../core/errors.js';
import { errorMessage } from '../utils/errors.js';

interface AccountAuthOptions {
  identifier?: string;
  name?: string;
  oauth?: boolean;
  oauthOptaBrowser?: boolean;
  oauthCookieJar?: string;
  oauthHeadless?: boolean;
  timeout?: string;
  returnTo?: string;
  accountsUrl?: string;
  json?: boolean;
}

interface AccountCommandOptions {
  json?: boolean;
}

interface BrowserAuthCallbackResult {
  exchangeCode: string | null;
  authCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

type OAuthBrowserMode = 'system' | 'opta-session';

export interface OAuthLoginFlowOptions {
  accountsUrl?: string;
  timeout?: string;
  returnTo?: string;
  env?: NodeJS.ProcessEnv;
  browserMode?: OAuthBrowserMode;
  browserOpener?: (url: string) => void | Promise<void>;
  optaCookieJar?: string;
  optaHeadless?: boolean;
  onSignInUrl?: (url: string) => void;
  onBrowserLaunchWarning?: (error: unknown, url: string) => void;
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

interface PortalCliHandoffRegistration {
  state: string;
  port: number;
  handoff?: string;
  returnTo?: string;
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
    await chmod(OPTA_COOKIE_JARS_DIR, 0o700).catch(() => { });
    await chmod(profileDir, 0o700).catch(() => { });
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
      close: async () => { },
    };
  }

  if (options.browserOpener) {
    return {
      mode,
      open: async (url: string) => {
        await options.browserOpener!(url);
      },
      close: async () => { },
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
        await manager.closeSession(sessionId).catch(() => { });
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
      await manager.closeSession(sessionId).catch(() => { });
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

function normalizeOAuthReturnTo(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      '--return-to must be an absolute URL (for example: opta-init://auth/callback).',
    );
  }

  const protocol = parsed.protocol.toLowerCase();
  if (
    protocol === 'javascript:' ||
    protocol === 'data:' ||
    protocol === 'file:' ||
    protocol === 'vbscript:'
  ) {
    throw new Error(`--return-to protocol is not allowed: ${protocol}`);
  }

  return parsed.toString();
}

function normalizeCallbackReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return normalizeOAuthReturnTo(raw) ?? null;
  } catch {
    return null;
  }
}

export function isValidCallbackExchangeCode(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return /^[A-Za-z0-9._-]{24,8192}$/.test(raw);
}

function parseOAuthTimeoutMs(raw: string): number {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 1800) {
    throw new Error('OAuth timeout must be an integer between 30 and 1800 seconds.');
  }
  return seconds * 1000;
}

function isTruthyEnvFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function shouldAllowLegacyTokenCallback(
  browserMode: OAuthBrowserMode,
  env: NodeJS.ProcessEnv,
): boolean {
  // Global strict mode applies to all browser modes.
  if (isTruthyEnvFlag(env['OPTA_OAUTH_STRICT_CODE_CALLBACK'])) return false;

  // Opta-session specific strict mode remains available for granular rollouts.
  if (browserMode === 'opta-session' && isTruthyEnvFlag(env['OPTA_OAUTH_OPTA_SESSION_STRICT_CODE_ONLY'])) {
    return false;
  }

  // Compatibility default: accept legacy token relay callbacks for portals that
  // have not yet switched to exchange_code or auth-code relay.
  return true;
}

async function registerPortalCliHandoff(
  accountsBaseUrl: string,
  registration: PortalCliHandoffRegistration,
  env: NodeJS.ProcessEnv,
): Promise<string | null> {
  if (isTruthyEnvFlag(env['OPTA_OAUTH_SKIP_PORTAL_HANDSHAKE'])) {
    return null;
  }

  const endpoint = new URL('/api/cli/handoff', accountsBaseUrl);
  const allowUnverified = isTruthyEnvFlag(env['OPTA_OAUTH_ALLOW_UNVERIFIED_CALLBACK']);

  const body: Record<string, string | number> = {
    state: registration.state,
    port: registration.port,
  };
  if (registration.handoff) body['handoff'] = registration.handoff;
  if (registration.returnTo) body['return_to'] = registration.returnTo;

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      try {
        const payload = (await response.json()) as { proof?: unknown };
        return typeof payload.proof === 'string' && payload.proof.trim().length > 0
          ? payload.proof.trim()
          : null;
      } catch {
        return null;
      }
    }
    if (allowUnverified) return null;

    let detail = `${response.status} ${response.statusText}`.trim();
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
        detail = `${detail}: ${payload.error.trim()}`;
      }
    } catch {
      const text = (await response.text()).trim();
      if (text.length > 0) {
        detail = `${detail}: ${text.slice(0, 240)}`;
      }
    }

    throw new Error(`Accounts portal rejected CLI handoff registration (${detail}).`);
  } catch (err) {
    if (allowUnverified) return null;
    throw new Error(
      `Secure callback registration failed at ${endpoint.origin}: ${errorMessage(err)}. ` +
        'Set OPTA_OAUTH_ALLOW_UNVERIFIED_CALLBACK=1 only as a temporary compatibility fallback.',
    );
  }
}

async function exchangePortalCliRelayCode(
  accountsBaseUrl: string,
  input: {
    code: string;
    state: string;
    port: number;
    handoff?: string;
  },
): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenType: string | null;
  expiresIn: number | null;
  expiresAt: number | null;
  providerToken: string | null;
  providerRefreshToken: string | null;
}> {
  const endpoint = new URL('/api/cli/exchange', accountsBaseUrl);
  const body: Record<string, string | number> = {
    code: input.code,
    state: input.state,
    port: input.port,
  };
  if (input.handoff) body['handoff'] = input.handoff;

  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error.trim()
        : `${response.status} ${response.statusText}`.trim();
    if (detail.toLowerCase() === 'replay_store_unavailable') {
      throw new Error(
        'Accounts exchange failed (replay_store_unavailable). ' +
          'The Accounts replay-protection store is unavailable. ' +
          'Retry in a moment; if this persists, ask an operator to configure ' +
          'SUPABASE service-role credentials and apply the accounts_cli_replay_nonces schema.',
      );
    }
    throw new Error(`Accounts exchange failed (${detail}).`);
  }

  const accessToken =
    payload && typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
  const refreshToken =
    payload && typeof payload.refresh_token === 'string' ? payload.refresh_token.trim() : '';
  const tokenTypeRaw = payload?.token_type;
  const tokenType =
    typeof tokenTypeRaw === 'string' && tokenTypeRaw.trim().length > 0
      ? tokenTypeRaw.trim()
      : null;
  const expiresInRaw = payload?.expires_in;
  const expiresIn =
    typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw)
      ? expiresInRaw
      : typeof expiresInRaw === 'string' && /^\d+$/.test(expiresInRaw)
        ? Number.parseInt(expiresInRaw, 10)
        : null;
  const expiresAtRaw = payload?.expires_at;
  const expiresAt =
    typeof expiresAtRaw === 'number' && Number.isFinite(expiresAtRaw)
      ? expiresAtRaw
      : typeof expiresAtRaw === 'string' && /^\d+$/.test(expiresAtRaw)
        ? Number.parseInt(expiresAtRaw, 10)
        : null;
  const providerTokenRaw = payload?.provider_token;
  const providerToken =
    typeof providerTokenRaw === 'string' && providerTokenRaw.trim().length > 0
      ? providerTokenRaw.trim()
      : null;
  const providerRefreshTokenRaw = payload?.provider_refresh_token;
  const providerRefreshToken =
    typeof providerRefreshTokenRaw === 'string' && providerRefreshTokenRaw.trim().length > 0
      ? providerRefreshTokenRaw.trim()
      : null;

  if (!accessToken || !refreshToken) {
    throw new Error('Accounts exchange succeeded but no tokens were returned.');
  }

  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresIn,
    expiresAt,
    providerToken,
    providerRefreshToken,
  };
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

function callbackPageHtml(
  title: string,
  detail: string,
  options: { autoClose?: boolean; returnTo?: string | null } = {},
): string {
  const autoClose = options.autoClose === true;
  const returnTo = options.returnTo ?? null;
  const returnToScriptValue = returnTo ? JSON.stringify(returnTo) : 'null';
  const autoCloseHint = autoClose
    ? '<p id="closeHint" style="display:none;margin-top:12px;">If this tab does not close automatically, press <code>Cmd/Ctrl+W</code>.</p>'
    : '';
  const autoCloseScript = autoClose
    ? `
  <script>
    window.addEventListener('load', function () {
      var returnTo = ${returnToScriptValue};
      var closeWindow = function () {
        window.open('', '_self');
        window.close();
        var hint = document.getElementById('closeHint');
        if (hint) {
          hint.style.display = 'block';
        }
      };
      try {
        window.history.replaceState({}, document.title, '/callback');
      } catch (_) {}
      if (returnTo) {
        window.setTimeout(function () {
          try {
            window.location.assign(returnTo);
          } catch (_) {}
          window.setTimeout(closeWindow, 450);
        }, 120);
        return;
      }
      window.setTimeout(closeWindow, 300);
    });
  </script>`
    : '';

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
    ${autoCloseHint}
  </div>
  ${autoCloseScript}
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
    const callbackReturnTo = normalizeCallbackReturnTo(requestUrl.searchParams.get('return_to'));

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

    const exchangeCodeRaw = requestUrl.searchParams.get('exchange_code')?.trim() ?? '';
    if (isValidCallbackExchangeCode(exchangeCodeRaw)) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        callbackPageHtml(
          'Opta Sign-In Complete',
          'Authentication succeeded. Returning to Opta now.',
          { autoClose: true, returnTo: callbackReturnTo },
        ),
      );

      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() =>
          settleSuccess({
            exchangeCode: exchangeCodeRaw,
            authCode: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
          }),
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
          'Authentication succeeded. Returning to Opta now.',
          { autoClose: true, returnTo: callbackReturnTo },
        ),
      );

      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() =>
          settleSuccess({
            exchangeCode: null,
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
          'Strict callback mode is enabled. Callback must include <code>exchange_code</code> or <code>code</code>.',
        ),
      );
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        server.close(() =>
          settleFailure(
            new Error('Strict callback mode rejected legacy token callback (missing exchange_code/code).'),
          ),
        );
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
        'Authentication succeeded. Returning to Opta now.',
        { autoClose: true, returnTo: callbackReturnTo },
      ),
    );

    if (!settled) {
      settled = true;
      clearTimeout(timeoutId);
      server.close(() =>
        settleSuccess({
          exchangeCode: null,
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
  const returnTo = normalizeOAuthReturnTo(options.returnTo);
  const accountsBaseUrlRaw = resolveAccountsBaseUrlRaw(options.accountsUrl, env);
  const accountsBaseUrl = parseAccountsBaseUrl(accountsBaseUrlRaw);
  const timeoutMs = parseOAuthTimeoutMs(timeoutRaw);
  const pkce = buildPkcePair();
  const stateToken = randomBytes(16).toString('hex');
  const handoffToken = browserMode === 'opta-session'
    ? randomBytes(16).toString('hex')
    : undefined;
  const allowLegacyTokenCallback = shouldAllowLegacyTokenCallback(browserMode, env);

  const callbackHandle = await startBrowserAuthCallbackServer({
    expectedState: stateToken,
    expectedHandoffToken: handoffToken,
    allowLegacyTokenCallback,
    timeoutMs,
  });
  const handoffProof = await registerPortalCliHandoff(
    accountsBaseUrl,
    {
      state: stateToken,
      port: callbackHandle.port,
      handoff: handoffToken,
      returnTo: returnTo ?? undefined,
    },
    env,
  ).catch((error: unknown) => {
    callbackHandle.cancel('Secure callback registration failed.');
    void callbackHandle.waitForResult.catch(() => {});
    throw error;
  });

  const signInUrl = new URL('/sign-in', accountsBaseUrl);
  signInUrl.searchParams.set('mode', 'cli');
  signInUrl.searchParams.set('port', String(callbackHandle.port));
  signInUrl.searchParams.set('state', stateToken);
  signInUrl.searchParams.set('response_type', 'code');
  signInUrl.searchParams.set('code_challenge', pkce.codeChallenge);
  signInUrl.searchParams.set('code_challenge_method', 'S256');
  if (returnTo) {
    signInUrl.searchParams.set('return_to', returnTo);
  }
  if (handoffToken) {
    signInUrl.searchParams.set('handoff', handoffToken);
  }
  if (handoffProof) {
    signInUrl.searchParams.set('proof', handoffProof);
  }
  const signInUrlString = signInUrl.toString();
  options.onSignInUrl?.(signInUrlString);

  const launcher = await createOAuthBrowserLauncher(options);
  try {
    await launcher.open(signInUrlString);
  } catch (error) {
    if (browserMode === 'opta-session') {
      callbackHandle.cancel('Sign-in browser did not launch successfully.');
      await launcher.close().catch(() => { });
      throw formatBrowserLaunchFailure('Opta browser OAuth launch failed', error);
    }
    // System-browser mode remains best effort; caller can still open URL manually.
    options.onBrowserLaunchWarning?.(error, signInUrlString);
  }

  const callback = await callbackHandle.waitForResult;
  let session: SupabaseSession | null = null;
  let user: SupabaseUser | null = null;

  try {
    if (callback.exchangeCode) {
      const exchange = await exchangePortalCliRelayCode(accountsBaseUrl, {
        code: callback.exchangeCode,
        state: stateToken,
        port: callbackHandle.port,
        handoff: handoffToken,
      });
      const expiresAt = exchange.expiresAt ?? undefined;
      const nowEpoch = Math.floor(Date.now() / 1000);
      const expiresIn = exchange.expiresIn ?? (expiresAt ? Math.max(1, expiresAt - nowEpoch) : 3600);
      session = {
        access_token: exchange.accessToken,
        refresh_token: exchange.refreshToken,
        token_type: exchange.tokenType ?? 'bearer',
        expires_in: expiresIn,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        ...(exchange.providerToken ? { provider_token: exchange.providerToken } : {}),
        ...(exchange.providerRefreshToken
          ? { provider_refresh_token: exchange.providerRefreshToken }
          : {}),
      };
      user = await fetchUserWithAccessToken(config, exchange.accessToken).catch(() => null);
    } else if (callback.authCode) {
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
      throw new Error('OAuth callback did not return an exchange code, auth code, or session tokens.');
    }
  } finally {
    await launcher.close().catch(() => { });
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
    returnTo: opts.returnTo,
    browserMode,
    optaCookieJar: opts.oauthCookieJar,
    optaHeadless: opts.oauthHeadless,
    onSignInUrl: (url) => {
      if (opts.json) {
        console.error(`[opta] open sign-in URL: ${url}`);
        return;
      }
      const target = browserMode === 'opta-session'
        ? 'Opening Opta browser session for accounts sign-in'
        : 'Opening system browser for accounts sign-in';
      console.log(chalk.dim(`${target} (${new URL(url).origin})...`));
      console.log(chalk.dim(`If browser launch is blocked, open:\n  ${url}`));
    },
    onBrowserLaunchWarning: (error, url) => {
      if (opts.json) {
        console.error(`[opta] browser launch warning: ${errorMessage(error)}; open manually: ${url}`);
        return;
      }
      console.error(chalk.yellow('!') + ` Browser launch warning: ${errorMessage(error)}`);
      console.error(chalk.dim(`  Open manually:\n  ${url}`));
    },
  });

  if (result.session.provider_token) {
    await storeGithubKey(result.session.provider_token).catch(() => { });
  }

  const payload = {
    ok: true,
    action: 'login',
    mode: browserMode === 'opta-session' ? 'oauth-opta-browser' : 'oauth',
    project: result.config.project,
    authenticated: true,
    signInUrl: result.signInUrl,
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
    if (opts.returnTo && !useOAuth) {
      fail(
        '--return-to requires --oauth or --oauth-opta-browser.',
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

// ---------------------------------------------------------------------------
// Cloud API Key Management
// ---------------------------------------------------------------------------

interface AccountKeysListOptions {
  provider?: string;
  json?: boolean;
}

interface AccountKeysPushOptions {
  label?: string;
  json?: boolean;
}

interface AccountKeysDeleteOptions {
  provider?: string;
  json?: boolean;
}

export async function accountKeysList(opts: AccountKeysListOptions = {}): Promise<void> {
  const state = await loadAccountState();
  if (!state?.session?.access_token) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'Not signed in' }, null, 2));
    } else {
      console.error(chalk.red('✗') + ' Not signed in — run `opta account login`');
    }
    process.exitCode = 1;
    return;
  }

  const keys = await listCloudApiKeys(state, opts.provider);

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, keys }, null, 2));
    return;
  }

  if (keys.length === 0) {
    const scope = opts.provider ? ` for provider ${chalk.cyan(opts.provider)}` : '';
    console.log(chalk.dim(`No cloud API keys found${scope}.`));
    return;
  }

  // Table header
  const header = `${chalk.bold('Provider'.padEnd(16))}${chalk.bold('Label'.padEnd(16))}${chalk.bold('Updated'.padEnd(24))}${chalk.bold('ID')}`;
  console.log(header);
  console.log(chalk.dim('─'.repeat(64)));

  for (const key of keys) {
    const provider = key.provider.padEnd(16);
    const label = (key.label ?? chalk.dim('—')).padEnd(16);
    const updated = key.updatedAt
      ? new Date(key.updatedAt).toLocaleString().padEnd(24)
      : chalk.dim('—'.padEnd(24));
    const id = chalk.dim(key.id.slice(0, 8));
    console.log(`${provider}${label}${updated}${id}`);
  }
}

export async function accountKeysPush(
  provider: string,
  keyValue: string,
  opts: AccountKeysPushOptions = {},
): Promise<void> {
  const state = await loadAccountState();
  if (!state?.session?.access_token) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'Not signed in' }, null, 2));
    } else {
      console.error(chalk.red('✗') + ' Not signed in — run `opta account login`');
    }
    process.exitCode = 1;
    return;
  }

  const label = opts.label ?? 'default';
  const success = await storeCloudApiKey(state, provider, keyValue, label);

  if (opts.json) {
    console.log(JSON.stringify({ ok: success, provider, label }, null, 2));
    return;
  }

  if (success) {
    console.log(chalk.green('✓') + ` Key stored to cloud for ${chalk.cyan(provider)} (label: ${label})`);
  } else {
    console.error(chalk.red('✗') + ' Failed to store key — check your Opta Account connection');
    process.exitCode = 1;
  }
}

export async function accountKeysDelete(
  keyId: string,
  opts: AccountKeysDeleteOptions = {},
): Promise<void> {
  const state = await loadAccountState();
  if (!state?.session?.access_token) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'Not signed in' }, null, 2));
    } else {
      console.error(chalk.red('✗') + ' Not signed in — run `opta account login`');
    }
    process.exitCode = 1;
    return;
  }

  // Confirmation prompt
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(`Delete key ${chalk.dim(keyId.slice(0, 8))}? [y/N]: `, (ans) => {
        rl.close();
        resolve(ans);
      });
    });
    if (answer.trim().toLowerCase() !== 'y') {
      console.log(chalk.dim('Cancelled.'));
      return;
    }
  }

  const success = await deleteCloudApiKey(state, keyId, opts.provider);

  if (opts.json) {
    console.log(JSON.stringify({ ok: success, keyId }, null, 2));
    return;
  }

  if (success) {
    console.log(chalk.green('✓') + ` Key ${chalk.dim(keyId.slice(0, 8))} deleted from cloud.`);
  } else {
    console.error(chalk.red('✗') + ' Failed to delete key — check the ID and your Opta Account connection');
    process.exitCode = 1;
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
