/**
 * commands/keychain.ts — Secure keychain management for Opta CLI.
 *
 * Subcommands:
 *   status            Show availability + stored key presence
 *   set-anthropic     Store Anthropic API key in OS keychain
 *   set-lmx           Store LMX API key in OS keychain
 *   delete-anthropic  Remove Anthropic key from keychain
 *   delete-lmx        Remove LMX key from keychain
 */

import chalk from 'chalk';
import {
  storeAnthropicKey,
  storeLmxKey,
  getAnthropicKey,
  getLmxKey,
  deleteAnthropicKey,
  deleteLmxKey,
  keychainStatus,
} from '../keychain/api-keys.js';
import { isKeychainAvailable } from '../keychain/index.js';
import { loadAccountState } from '../accounts/storage.js';
import { listCloudApiKeys } from '../accounts/cloud.js';

type KeychainAction =
  | 'status'
  | 'set-anthropic'
  | 'set-lmx'
  | 'delete-anthropic'
  | 'delete-lmx';

export async function runKeychainCommand(
  action: KeychainAction,
  value?: string,
): Promise<void> {
  switch (action) {
    case 'status':
      await handleStatus();
      break;
    case 'set-anthropic':
      await handleSet('anthropic', value);
      break;
    case 'set-lmx':
      await handleSet('lmx', value);
      break;
    case 'delete-anthropic':
      await handleDelete('anthropic');
      break;
    case 'delete-lmx':
      await handleDelete('lmx');
      break;
    default: {
      // TypeScript exhaustiveness guard
      const exhaustive: never = action;
      console.error(chalk.red(`Unknown keychain action: ${String(exhaustive)}`));
      process.exitCode = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleStatus(): Promise<void> {
  const status = await keychainStatus();

  const availableLabel = status.available
    ? chalk.green('available')
    : chalk.yellow('unavailable');

  console.log(`Keychain backend: ${availableLabel}`);

  if (!status.available) {
    console.log(
      chalk.dim(
        `  Platform (${process.platform}) does not have a supported keychain backend.\n` +
        '  Set ANTHROPIC_API_KEY / OPTA_API_KEY as environment variables instead.',
      ),
    );
  } else {
    const anthropicLabel = status.anthropic
      ? chalk.green('stored')
      : chalk.dim('not stored');
    const lmxLabel = status.lmx
      ? chalk.green('stored')
      : chalk.dim('not stored');

    console.log(`  Anthropic API key: ${anthropicLabel}`);
    console.log(`  LMX API key:       ${lmxLabel}`);
  }

  // Cloud keys section
  console.log('');
  try {
    const state = await loadAccountState();
    if (!state?.session?.access_token) {
      console.log(chalk.dim('Cloud keys: not signed in'));
      return;
    }

    const keys = await listCloudApiKeys(state);
    if (keys.length === 0) {
      console.log(chalk.dim('Cloud keys (Opta Account): none'));
      return;
    }

    console.log(`Cloud keys (Opta Account):`);
    for (const key of keys) {
      const updated = key.updatedAt
        ? chalk.dim(new Date(key.updatedAt).toLocaleDateString())
        : '';
      const label = key.label ? chalk.dim(`(${key.label})`) : '';
      console.log(`  ${key.provider.padEnd(14)} ${label} ${updated}`);
    }
  } catch {
    console.log(chalk.dim('Cloud keys: unavailable'));
  }
}

async function handleSet(
  provider: 'anthropic' | 'lmx',
  value: string | undefined,
): Promise<void> {
  if (!isKeychainAvailable()) {
    console.error(
      chalk.yellow(
        `Keychain is not available on this platform (${process.platform}).\n` +
        'Use environment variables (ANTHROPIC_API_KEY / OPTA_API_KEY) instead.',
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (!value || value.trim().length === 0) {
    console.error(chalk.red(`A non-empty API key value is required.`));
    console.error(
      chalk.dim(
        `Usage: opta keychain set-${provider} <key>`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const key = value.trim();

  let success: boolean;
  if (provider === 'anthropic') {
    success = await storeAnthropicKey(key);
  } else {
    success = await storeLmxKey(key);
  }

  if (success) {
    const label = provider === 'anthropic' ? 'Anthropic' : 'LMX';
    console.log(chalk.green(`${label} API key stored in keychain.`));
    // Show masked confirmation
    const stored = provider === 'anthropic'
      ? await getAnthropicKey()
      : await getLmxKey();
    if (stored) {
      console.log(chalk.dim(`  Stored: ${maskKey(stored)}`));
    }
  } else {
    console.error(
      chalk.red(
        `Failed to store key in keychain. ` +
        `Check verbose output (--verbose) for details.`,
      ),
    );
    process.exitCode = 1;
  }
}

async function handleDelete(provider: 'anthropic' | 'lmx'): Promise<void> {
  if (!isKeychainAvailable()) {
    console.error(
      chalk.yellow(
        `Keychain is not available on this platform (${process.platform}).`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (provider === 'anthropic') {
    await deleteAnthropicKey();
    console.log(chalk.green('Anthropic API key removed from keychain.'));
  } else {
    await deleteLmxKey();
    console.log(chalk.green('LMX API key removed from keychain.'));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mask an API key for safe display: show first 8 and last 4 characters,
 * with asterisks in the middle.
 */
function maskKey(key: string): string {
  if (key.length <= 12) return '****';
  const prefix = key.slice(0, 8);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}
