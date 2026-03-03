/**
 * commands/keychain.ts — Secure keychain management for Opta CLI.
 *
 * Subcommands:
 *   status            Show availability + stored key presence
 *   set-anthropic     Store Anthropic API key in OS keychain
 *   set-lmx           Store LMX API key in OS keychain
 *   set-gemini        Store Gemini API key in OS keychain
 *   set-openai        Store OpenAI API key in OS keychain
 *   set-opencode-zen  Store Opencode Zen API key in OS keychain
 *   delete-anthropic  Remove Anthropic key from keychain
 *   delete-lmx        Remove LMX key from keychain
 *   delete-gemini     Remove Gemini key from keychain
 *   delete-openai     Remove OpenAI key from keychain
 *   delete-opencode-zen Remove Opencode Zen key from keychain
 */

import chalk from 'chalk';
import {
  storeAnthropicKey,
  storeLmxKey,
  storeGeminiKey,
  storeOpenaiKey,
  storeOpencodeZenKey,
  getAnthropicKey,
  getLmxKey,
  getGeminiKey,
  getOpenaiKey,
  getOpencodeZenKey,
  deleteAnthropicKey,
  deleteLmxKey,
  deleteGeminiKey,
  deleteOpenaiKey,
  deleteOpencodeZenKey,
  storeGithubKey,
  getGithubKey,
  deleteGithubKey,
  keychainStatus,
} from '../keychain/api-keys.js';
import { isKeychainAvailable } from '../keychain/index.js';
import { loadAccountState } from '../accounts/storage.js';
import { listCloudApiKeys } from '../accounts/cloud.js';

type KeychainProvider = 'anthropic' | 'lmx' | 'gemini' | 'openai' | 'opencode-zen' | 'github';

type KeychainAction =
  | 'status'
  | 'set-anthropic'
  | 'set-lmx'
  | 'set-gemini'
  | 'set-openai'
  | 'set-opencode-zen'
  | 'delete-anthropic'
  | 'delete-lmx'
  | 'delete-gemini'
  | 'delete-openai'
  | 'delete-opencode-zen'
  | 'set-github'
  | 'delete-github';

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
    case 'set-gemini':
      await handleSet('gemini', value);
      break;
    case 'set-openai':
      await handleSet('openai', value);
      break;
    case 'set-opencode-zen':
      await handleSet('opencode-zen', value);
      break;
    case 'delete-anthropic':
      await handleDelete('anthropic');
      break;
    case 'delete-lmx':
      await handleDelete('lmx');
      break;
    case 'delete-gemini':
      await handleDelete('gemini');
      break;
    case 'delete-openai':
      await handleDelete('openai');
      break;
    case 'delete-opencode-zen':
      await handleDelete('opencode-zen');
      break;
    case 'set-github':
      await handleSet('github', value);
      break;
    case 'delete-github':
      await handleDelete('github');
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
    const geminiLabel = status.gemini
      ? chalk.green('stored')
      : chalk.dim('not stored');
    const openaiLabel = status.openai
      ? chalk.green('stored')
      : chalk.dim('not stored');
    const opencodeZenLabel = status.opencodeZen
      ? chalk.green('stored')
      : chalk.dim('not stored');
    const githubLabel = status.github
      ? chalk.green('stored')
      : chalk.dim('not stored');

    console.log(`  Anthropic API key:   ${anthropicLabel}`);
    console.log(`  LMX API key:         ${lmxLabel}`);
    console.log(`  Gemini API key:      ${geminiLabel}`);
    console.log(`  OpenAI API key:      ${openaiLabel}`);
    console.log(`  Opencode Zen API key:${opencodeZenLabel}`);
    console.log(`  GitHub API key:      ${githubLabel}`);
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
  provider: KeychainProvider,
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
  const providerLabel: Record<KeychainProvider, string> = {
    anthropic: 'Anthropic',
    lmx: 'LMX',
    gemini: 'Gemini',
    openai: 'OpenAI',
    'opencode-zen': 'Opencode Zen',
    github: 'GitHub',
  };

  const storeByProvider: Record<KeychainProvider, (apiKey: string) => Promise<boolean>> = {
    anthropic: storeAnthropicKey,
    lmx: storeLmxKey,
    gemini: storeGeminiKey,
    openai: storeOpenaiKey,
    'opencode-zen': storeOpencodeZenKey,
    github: storeGithubKey,
  };

  const readByProvider: Record<KeychainProvider, () => Promise<string | null>> = {
    anthropic: getAnthropicKey,
    lmx: getLmxKey,
    gemini: getGeminiKey,
    openai: getOpenaiKey,
    'opencode-zen': getOpencodeZenKey,
    github: getGithubKey,
  };

  const success = await storeByProvider[provider](key);

  if (success) {
    const label = providerLabel[provider];
    console.log(chalk.green(`${label} API key stored in keychain.`));
    // Show masked confirmation
    const stored = await readByProvider[provider]();
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

  const providerLabel: Record<KeychainProvider, string> = {
    anthropic: 'Anthropic',
    lmx: 'LMX',
    gemini: 'Gemini',
    openai: 'OpenAI',
    'opencode-zen': 'Opencode Zen',
    github: 'GitHub',
  };

  const deleteByProvider: Record<KeychainProvider, () => Promise<void>> = {
    anthropic: deleteAnthropicKey,
    lmx: deleteLmxKey,
    gemini: deleteGeminiKey,
    openai: deleteOpenaiKey,
    'opencode-zen': deleteOpencodeZenKey,
    github: deleteGithubKey,
  };

  await deleteByProvider[provider]();
  console.log(chalk.green(`${providerLabel[provider]} API key removed from keychain.`));
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
