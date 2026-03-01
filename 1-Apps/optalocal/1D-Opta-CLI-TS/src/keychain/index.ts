/**
 * keychain/index.ts — Cross-platform secure credential store.
 *
 * Uses OS-native CLIs only. No native addons, no node-gyp.
 *
 *   macOS  → security(1) add/find/delete-generic-password
 *   Linux  → secret-tool(1) if available in PATH
 *   Windows → PowerShell DPAPI-protected local fallback store
 *   Other   → no-op (returns null / false)
 *
 * All public functions are fail-safe: errors are logged at verbose level
 * and never thrown to the caller.
 */

import { execFile as _execFile, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { verbose } from '../core/debug.js';
import { errorMessage } from '../utils/errors.js';

const execFile = promisify(_execFile);

// ---------------------------------------------------------------------------
// Internal platform detection
// ---------------------------------------------------------------------------

const PLATFORM = process.platform;

/** Cached result for Linux secret-tool availability check. */
let _secretToolAvailable: boolean | null = null;
let _windowsFallbackWarningShown = false;

type WindowsFallbackStore = Record<string, string>;

const WINDOWS_FALLBACK_WARNING =
  '[opta] Windows keychain fallback active: using a DPAPI-protected local store (not Credential Manager).';

const WINDOWS_FALLBACK_STORE_PATH =
  process.env['OPTA_WINDOWS_KEYCHAIN_FILE'] ??
  join(
    process.env['LOCALAPPDATA'] ??
      process.env['APPDATA'] ??
      process.env['USERPROFILE'] ??
      process.cwd(),
    'opta-cli',
    'keychain-store.json'
  );

async function checkSecretToolAvailable(): Promise<boolean> {
  if (_secretToolAvailable !== null) return _secretToolAvailable;
  try {
    await execFile('which', ['secret-tool']);
    _secretToolAvailable = true;
  } catch {
    _secretToolAvailable = false;
  }
  return _secretToolAvailable;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the current platform has a usable keychain backend.
 *
 * - macOS: always true (security CLI is part of macOS)
 * - Windows: true (DPAPI fallback store via PowerShell)
 * - Linux: true only if secret-tool is in PATH (sync check uses cached result)
 * - Other: always false
 *
 * Note: on Linux this may return false on first call before the async check
 * completes. Call isKeychainAvailable() after at least one async operation
 * for an accurate result, or use the async variant internally.
 */
export function isKeychainAvailable(): boolean {
  if (PLATFORM === 'darwin') return true;
  if (PLATFORM === 'win32') return true;
  if (PLATFORM === 'linux') return _secretToolAvailable === true;
  return false;
}

/**
 * Retrieve a secret from the OS keychain.
 *
 * @param service  Keychain service name (e.g. 'opta-cli')
 * @param account  Account name within the service (e.g. 'anthropic-api-key')
 * @returns The stored secret string, or null if not found or on error.
 */
export async function getSecret(service: string, account: string): Promise<string | null> {
  if (PLATFORM === 'darwin') {
    return macosGetSecret(service, account);
  }
  if (PLATFORM === 'win32') {
    return windowsGetSecret(service, account);
  }
  if (PLATFORM === 'linux') {
    const available = await checkSecretToolAvailable();
    if (!available) return null;
    return linuxGetSecret(service, account);
  }
  verbose(`keychain: getSecret called on unsupported platform (${PLATFORM})`);
  return null;
}

/**
 * Store a secret in the OS keychain.
 *
 * @param service  Keychain service name
 * @param account  Account name within the service
 * @param secret   The plaintext secret to store
 */
export async function setSecret(service: string, account: string, secret: string): Promise<void> {
  if (PLATFORM === 'darwin') {
    await macosSetSecret(service, account, secret);
    return;
  }
  if (PLATFORM === 'win32') {
    await windowsSetSecret(service, account, secret);
    return;
  }
  if (PLATFORM === 'linux') {
    const available = await checkSecretToolAvailable();
    if (!available) {
      verbose('keychain: setSecret — secret-tool not available, skipping');
      return;
    }
    await linuxSetSecret(service, account, secret);
    return;
  }
  verbose(`keychain: setSecret called on unsupported platform (${PLATFORM}), skipping`);
}

/**
 * Delete a secret from the OS keychain.
 *
 * Does not throw if the secret does not exist.
 *
 * @param service  Keychain service name
 * @param account  Account name within the service
 */
export async function deleteSecret(service: string, account: string): Promise<void> {
  if (PLATFORM === 'darwin') {
    await macosDeleteSecret(service, account);
    return;
  }
  if (PLATFORM === 'win32') {
    await windowsDeleteSecret(service, account);
    return;
  }
  if (PLATFORM === 'linux') {
    const available = await checkSecretToolAvailable();
    if (!available) {
      verbose('keychain: deleteSecret — secret-tool not available, skipping');
      return;
    }
    await linuxDeleteSecret(service, account);
    return;
  }
  verbose(`keychain: deleteSecret called on unsupported platform (${PLATFORM}), skipping`);
}

// ---------------------------------------------------------------------------
// macOS implementation — security(1)
// ---------------------------------------------------------------------------

async function macosGetSecret(service: string, account: string): Promise<string | null> {
  try {
    // -w prints the password only (no other output)
    const { stdout } = await execFile('security', [
      'find-generic-password',
      '-s',
      service,
      '-a',
      account,
      '-w',
    ]);
    return stdout.trimEnd();
  } catch (err: unknown) {
    // Exit code 44 = item not found — not an error for our purposes
    const exitCode = (err as NodeJS.ErrnoException & { code?: number })?.code;
    if (exitCode !== 44) {
      verbose(`keychain(macOS): find-generic-password failed — ${errorMessage(err)}`);
    }
    return null;
  }
}

async function macosSetSecret(service: string, account: string, secret: string): Promise<void> {
  try {
    // -U updates the entry if it already exists
    await execFile('security', [
      'add-generic-password',
      '-s',
      service,
      '-a',
      account,
      '-w',
      secret,
      '-U',
    ]);
  } catch (err: unknown) {
    verbose(`keychain(macOS): add-generic-password failed — ${errorMessage(err)}`);
  }
}

async function macosDeleteSecret(service: string, account: string): Promise<void> {
  try {
    await execFile('security', ['delete-generic-password', '-s', service, '-a', account]);
  } catch (err: unknown) {
    // Exit code 44 = item not found — treat as success (idempotent delete)
    const exitCode = (err as NodeJS.ErrnoException & { code?: number })?.code;
    if (exitCode !== 44) {
      verbose(`keychain(macOS): delete-generic-password failed — ${errorMessage(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Linux implementation — secret-tool(1)
// ---------------------------------------------------------------------------

async function linuxGetSecret(service: string, account: string): Promise<string | null> {
  try {
    const { stdout } = await execFile('secret-tool', [
      'lookup',
      'service',
      service,
      'account',
      account,
    ]);
    return stdout.trimEnd();
  } catch (err: unknown) {
    verbose(`keychain(Linux): secret-tool lookup failed — ${errorMessage(err)}`);
    return null;
  }
}

async function linuxSetSecret(service: string, account: string, secret: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      // secret-tool store reads the password from stdin.
      // We use spawn (not execFile) here so we can write to stdin directly.
      const child = spawn(
        'secret-tool',
        ['store', `--label=${service}`, 'service', service, 'account', account],
        { stdio: ['pipe', 'ignore', 'ignore'] }
      );

      child.on('error', (err) => {
        verbose(`keychain(Linux): secret-tool store failed — ${err.message}`);
        resolve();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          verbose(`keychain(Linux): secret-tool store exited with code ${String(code)}`);
        }
        resolve();
      });

      // Write the secret to stdin then close the pipe
      if (child.stdin) {
        child.stdin.write(secret);
        child.stdin.end();
      }
    } catch (err: unknown) {
      verbose(`keychain(Linux): secret-tool store spawn failed — ${errorMessage(err)}`);
      resolve();
    }
  });
}

async function linuxDeleteSecret(service: string, account: string): Promise<void> {
  try {
    await execFile('secret-tool', ['clear', 'service', service, 'account', account]);
  } catch (err: unknown) {
    verbose(`keychain(Linux): secret-tool clear failed — ${errorMessage(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Windows implementation — DPAPI fallback store via PowerShell
// ---------------------------------------------------------------------------

function windowsStoreEntryKey(service: string, account: string): string {
  return `${service}::${account}`;
}

function warnWindowsFallbackOnce(): void {
  if (_windowsFallbackWarningShown) return;
  _windowsFallbackWarningShown = true;
  console.warn(WINDOWS_FALLBACK_WARNING);
}

async function loadWindowsFallbackStore(): Promise<WindowsFallbackStore> {
  try {
    const raw = await readFile(WINDOWS_FALLBACK_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: WindowsFallbackStore = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    if (code !== 'ENOENT') {
      verbose(`keychain(Windows): failed to read fallback store — ${errorMessage(err)}`);
    }
    return {};
  }
}

async function saveWindowsFallbackStore(store: WindowsFallbackStore): Promise<void> {
  try {
    await mkdir(dirname(WINDOWS_FALLBACK_STORE_PATH), { recursive: true });
    await writeFile(WINDOWS_FALLBACK_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err: unknown) {
    verbose(`keychain(Windows): failed to write fallback store — ${errorMessage(err)}`);
  }
}

async function execWindowsPowerShell(script: string, envValue: string): Promise<string | null> {
  const attempts: string[] = [];
  const candidates = ['powershell', 'pwsh'];

  for (const shell of candidates) {
    try {
      const { stdout } = await execFile(
        shell,
        ['-NoProfile', '-NonInteractive', '-Command', script],
        {
          env: {
            ...process.env,
            OPTA_KEYCHAIN_VALUE: envValue,
          },
          windowsHide: true,
        }
      );
      return stdout.trimEnd();
    } catch (err: unknown) {
      attempts.push(`${shell}: ${errorMessage(err)}`);
    }
  }

  verbose(`keychain(Windows): PowerShell execution failed — ${attempts.join('; ')}`);
  return null;
}

async function windowsEncryptSecret(secret: string): Promise<string | null> {
  return execWindowsPowerShell(
    '$secure = ConvertTo-SecureString -String $env:OPTA_KEYCHAIN_VALUE -AsPlainText -Force; ' +
      'ConvertFrom-SecureString -SecureString $secure',
    secret
  );
}

async function windowsDecryptSecret(encrypted: string): Promise<string | null> {
  return execWindowsPowerShell(
    '$secure = ConvertTo-SecureString -String $env:OPTA_KEYCHAIN_VALUE; ' +
      "$cred = New-Object System.Management.Automation.PSCredential('opta', $secure); " +
      '$cred.GetNetworkCredential().Password',
    encrypted
  );
}

async function windowsGetSecret(service: string, account: string): Promise<string | null> {
  warnWindowsFallbackOnce();
  const store = await loadWindowsFallbackStore();
  const encrypted = store[windowsStoreEntryKey(service, account)];
  if (!encrypted) return null;
  return windowsDecryptSecret(encrypted);
}

async function windowsSetSecret(service: string, account: string, secret: string): Promise<void> {
  warnWindowsFallbackOnce();
  const encrypted = await windowsEncryptSecret(secret);
  if (!encrypted) {
    verbose('keychain(Windows): encryption failed, skipping secret write');
    return;
  }
  const store = await loadWindowsFallbackStore();
  store[windowsStoreEntryKey(service, account)] = encrypted;
  await saveWindowsFallbackStore(store);
}

async function windowsDeleteSecret(service: string, account: string): Promise<void> {
  warnWindowsFallbackOnce();
  const store = await loadWindowsFallbackStore();
  Reflect.deleteProperty(store, windowsStoreEntryKey(service, account));
  await saveWindowsFallbackStore(store);
}
