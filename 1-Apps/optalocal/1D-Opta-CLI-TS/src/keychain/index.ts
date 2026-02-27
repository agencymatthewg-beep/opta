/**
 * keychain/index.ts — Cross-platform secure credential store.
 *
 * Uses OS-native CLIs only. No native addons, no node-gyp.
 *
 *   macOS  → security(1) add/find/delete-generic-password
 *   Linux  → secret-tool(1) if available in PATH
 *   Other  → no-op (returns null / false)
 *
 * All public functions are fail-safe: errors are logged at verbose level
 * and never thrown to the caller.
 */

import { execFile as _execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { verbose } from '../core/debug.js';

const execFile = promisify(_execFile);

// ---------------------------------------------------------------------------
// Internal platform detection
// ---------------------------------------------------------------------------

const PLATFORM = process.platform;

/** Cached result for Linux secret-tool availability check. */
let _secretToolAvailable: boolean | null = null;

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
 * - Linux: true only if secret-tool is in PATH (sync check uses cached result)
 * - Other: always false
 *
 * Note: on Linux this may return false on first call before the async check
 * completes. Call isKeychainAvailable() after at least one async operation
 * for an accurate result, or use the async variant internally.
 */
export function isKeychainAvailable(): boolean {
  if (PLATFORM === 'darwin') return true;
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
      '-s', service,
      '-a', account,
      '-w',
    ]);
    return stdout.trimEnd();
  } catch (err: unknown) {
    // Exit code 44 = item not found — not an error for our purposes
    const exitCode = (err as NodeJS.ErrnoException & { code?: number })?.code;
    if (exitCode !== 44) {
      const msg = err instanceof Error ? err.message : String(err);
      verbose(`keychain(macOS): find-generic-password failed — ${msg}`);
    }
    return null;
  }
}

async function macosSetSecret(service: string, account: string, secret: string): Promise<void> {
  try {
    // -U updates the entry if it already exists
    await execFile('security', [
      'add-generic-password',
      '-s', service,
      '-a', account,
      '-w', secret,
      '-U',
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    verbose(`keychain(macOS): add-generic-password failed — ${msg}`);
  }
}

async function macosDeleteSecret(service: string, account: string): Promise<void> {
  try {
    await execFile('security', [
      'delete-generic-password',
      '-s', service,
      '-a', account,
    ]);
  } catch (err: unknown) {
    // Exit code 44 = item not found — treat as success (idempotent delete)
    const exitCode = (err as NodeJS.ErrnoException & { code?: number })?.code;
    if (exitCode !== 44) {
      const msg = err instanceof Error ? err.message : String(err);
      verbose(`keychain(macOS): delete-generic-password failed — ${msg}`);
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
      'service', service,
      'account', account,
    ]);
    return stdout.trimEnd();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    verbose(`keychain(Linux): secret-tool lookup failed — ${msg}`);
    return null;
  }
}

async function linuxSetSecret(service: string, account: string, secret: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      // secret-tool store reads the password from stdin.
      // We use spawn (not execFile) here so we can write to stdin directly.
      const child = spawn('secret-tool', [
        'store',
        `--label=${service}`,
        'service', service,
        'account', account,
      ], { stdio: ['pipe', 'ignore', 'ignore'] });

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
      const msg = err instanceof Error ? err.message : String(err);
      verbose(`keychain(Linux): secret-tool store spawn failed — ${msg}`);
      resolve();
    }
  });
}

async function linuxDeleteSecret(service: string, account: string): Promise<void> {
  try {
    await execFile('secret-tool', [
      'clear',
      'service', service,
      'account', account,
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    verbose(`keychain(Linux): secret-tool clear failed — ${msg}`);
  }
}
