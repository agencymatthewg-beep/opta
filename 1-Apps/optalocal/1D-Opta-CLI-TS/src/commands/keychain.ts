/**
 * commands/keychain.ts — Secure keychain management for Opta CLI.
 *
 * Supports all 16 Sync Vault providers via universal dispatch.
 * Uses storeKeyByProvider / getKeyByProvider / deleteKeyByProvider
 * from keychain/api-keys.ts to avoid per-provider boilerplate.
 */

import chalk from 'chalk';
import {
  keychainStatus,
  storeKeyByProvider,
  getKeyByProvider,
  deleteKeyByProvider,
} from '../keychain/api-keys.js';
import { isKeychainAvailable } from '../keychain/index.js';
import { loadAccountState } from '../accounts/storage.js';
import { listCloudApiKeys } from '../accounts/cloud.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KeychainProvider =
  | 'anthropic'
  | 'lmx'
  | 'gemini'
  | 'openai'
  | 'opencode-zen'
  | 'github'
  | 'vercel'
  | 'cloudflare'
  | 'perplexity'
  | 'tavily'
  | 'brave'
  | 'exa'
  | 'groq'
  | 'codex'
  | 'google'
  | 'twitter';

type KeychainAction =
  | 'status'
  | `set-${KeychainProvider}`
  | `delete-${KeychainProvider}`;

// Human-readable display names
const PROVIDER_DISPLAY: Record<KeychainProvider, string> = {
  anthropic: 'Anthropic',
  lmx: 'LMX',
  gemini: 'Gemini',
  openai: 'OpenAI',
  'opencode-zen': 'Opencode Zen',
  github: 'GitHub',
  vercel: 'Vercel',
  cloudflare: 'Cloudflare',
  perplexity: 'Perplexity',
  tavily: 'Tavily',
  brave: 'Brave Search',
  exa: 'Exa',
  groq: 'Groq',
  codex: 'Codex',
  google: 'Google',
  twitter: 'Twitter/X',
};

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function runKeychainCommand(
  action: KeychainAction,
  value?: string,
): Promise<void> {
  if (action === 'status') {
    await handleStatus();
    return;
  }

  if (action.startsWith('set-')) {
    const provider = action.slice(4) as KeychainProvider;
    await handleSet(provider, value);
    return;
  }

  if (action.startsWith('delete-')) {
    const provider = action.slice(7) as KeychainProvider;
    await handleDelete(provider);
    return;
  }

  console.error(chalk.red(`Unknown keychain action: ${action}`));
  process.exitCode = 1;
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
        '  Set API keys as environment variables instead.',
      ),
    );
  } else {
    const bools: Record<string, boolean> = {
      anthropic: status.anthropic,
      lmx: status.lmx,
      gemini: status.gemini,
      openai: status.openai,
      'opencode-zen': status.opencodeZen,
      github: status.github,
    };

    for (const [provider, displayName] of Object.entries(PROVIDER_DISPLAY)) {
      const stored = bools[provider] ?? false;
      const sl = stored ? chalk.green('stored') : chalk.dim('not stored');
      console.log(`  ${displayName.padEnd(16)} ${sl}`);
    }
  }

  // Cloud keys section
  console.log('');
  try {
    const state = await loadAccountState();
    if (!state?.session?.access_token) {
      console.log(chalk.dim('Cloud keys (Vault): not signed in — run `opta account login --oauth`'));
      return;
    }

    const keys = await listCloudApiKeys(state);
    if (keys.length === 0) {
      console.log(chalk.dim('Cloud keys (Opta Vault): none'));
      return;
    }

    console.log('Cloud keys (Opta Vault):');
    for (const key of keys) {
      const updated = key.updatedAt
        ? chalk.dim(new Date(key.updatedAt).toLocaleDateString())
        : '';
      const label = key.label ? chalk.dim(`(${key.label})`) : '';
      console.log(`  ${key.provider.padEnd(16)} ${label} ${updated}`);
    }

    console.log('');
    console.log(chalk.dim('Sync all vault keys to local keychain: ') + chalk.cyan('opta vault pull'));
  } catch {
    console.log(chalk.dim('Cloud keys: unavailable'));
  }
}

async function handleSet(
  provider: KeychainProvider,
  value: string | undefined,
): Promise<void> {
  if (!isKeychainAvailable()) {
    console.error(
      chalk.yellow(
        `Keychain is not available on this platform (${process.platform}).\n` +
        'Use environment variables instead.',
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (!value || value.trim().length === 0) {
    console.error(chalk.red(`A non-empty API key value is required.`));
    console.error(chalk.dim(`Usage: opta keychain set-${provider} <key>`));
    process.exitCode = 1;
    return;
  }

  const key = value.trim();
  const success = await storeKeyByProvider(provider, key);
  const displayName = PROVIDER_DISPLAY[provider] ?? provider;

  if (success) {
    console.log(chalk.green(`${displayName} API key stored in keychain.`));
    const stored = await getKeyByProvider(provider);
    if (stored) {
      console.log(chalk.dim(`  Stored: ${maskKey(stored)}`));
    }
  } else {
    console.error(chalk.red(
      `Failed to store ${displayName} key in keychain. ` +
      `Check verbose output (--verbose) for details.`,
    ));
    process.exitCode = 1;
  }
}

async function handleDelete(provider: KeychainProvider): Promise<void> {
  if (!isKeychainAvailable()) {
    console.error(
      chalk.yellow(
        `Keychain is not available on this platform (${process.platform}).`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const displayName = PROVIDER_DISPLAY[provider] ?? provider;
  await deleteKeyByProvider(provider);
  console.log(chalk.green(`${displayName} API key removed from keychain.`));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskKey(key: string): string {
  if (key.length <= 12) return '****';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
