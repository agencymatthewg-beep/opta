/**
 * keychain/api-keys.ts — High-level API key helpers.
 *
 * Wraps the low-level keychain module with named helpers for the two API
 * keys used by Opta CLI: Anthropic and LMX.
 *
 * Service name: 'opta-cli'
 * Accounts    : 'anthropic-api-key', 'lmx-api-key'
 */

import {
  getSecret,
  setSecret,
  deleteSecret,
  isKeychainAvailable,
} from './index.js';

const KEYCHAIN_SERVICE = 'opta-cli';
const ACCOUNT_ANTHROPIC = 'anthropic-api-key';
const ACCOUNT_LMX = 'lmx-api-key';
const ACCOUNT_GEMINI = 'gemini-api-key';
const ACCOUNT_OPENAI = 'openai-api-key';
const ACCOUNT_OPENCODE_ZEN = 'opencode-zen-api-key';
const ACCOUNT_GITHUB = 'github-api-key';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Store an Anthropic API key in the OS keychain.
 * @returns true if the operation succeeded, false if keychain is unavailable.
 */
export async function storeAnthropicKey(apiKey: string): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  await setSecret(KEYCHAIN_SERVICE, ACCOUNT_ANTHROPIC, apiKey);
  // Verify the write succeeded by reading back
  const verify = await getSecret(KEYCHAIN_SERVICE, ACCOUNT_ANTHROPIC);
  return verify === apiKey;
}

/**
 * Store an LMX API key in the OS keychain.
 * @returns true if the operation succeeded, false if keychain is unavailable.
 */
export async function storeLmxKey(apiKey: string): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  await setSecret(KEYCHAIN_SERVICE, ACCOUNT_LMX, apiKey);
  const verify = await getSecret(KEYCHAIN_SERVICE, ACCOUNT_LMX);
  return verify === apiKey;
}


/**
 * Store a Gemini API key in the OS keychain.
 * @returns true if the operation succeeded, false if keychain is unavailable.
 */
export async function storeGeminiKey(apiKey: string): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  await setSecret(KEYCHAIN_SERVICE, ACCOUNT_GEMINI, apiKey);
  const verify = await getSecret(KEYCHAIN_SERVICE, ACCOUNT_GEMINI);
  return verify === apiKey;
}

/**
 * Store an OpenAI API key in the OS keychain.
 * @returns true if the operation succeeded, false if keychain is unavailable.
 */
export async function storeOpenaiKey(apiKey: string): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  await setSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENAI, apiKey);
  const verify = await getSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENAI);
  return verify === apiKey;
}

/**
 * Store an Opencode Zen API key in the OS keychain.
 * @returns true if the operation succeeded, false if keychain is unavailable.
 */
export async function storeOpencodeZenKey(apiKey: string): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  await setSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENCODE_ZEN, apiKey);
  const verify = await getSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENCODE_ZEN);
  return verify === apiKey;
}

/**
 * Store a GitHub API key (Personal Access Token) in the OS keychain.
 * @returns true if the operation succeeded, false if keychain is unavailable.
 */
export async function storeGithubKey(apiKey: string): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  await setSecret(KEYCHAIN_SERVICE, ACCOUNT_GITHUB, apiKey);
  const verify = await getSecret(KEYCHAIN_SERVICE, ACCOUNT_GITHUB);
  return verify === apiKey;
}

// ---------------------------------------------------------------------------
// Retrieve
// ---------------------------------------------------------------------------

/**
 * Retrieve the Anthropic API key from the OS keychain.
 * @returns The key string or null if not stored / unavailable.
 */
export async function getAnthropicKey(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  return getSecret(KEYCHAIN_SERVICE, ACCOUNT_ANTHROPIC);
}

/**
 * Retrieve the LMX API key from the OS keychain.
 * @returns The key string or null if not stored / unavailable.
 */
export async function getLmxKey(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  return getSecret(KEYCHAIN_SERVICE, ACCOUNT_LMX);
}


/**
 * Retrieve a Gemini API key from the OS keychain.
 * @returns The key string or null if not stored / unavailable.
 */
export async function getGeminiKey(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  return getSecret(KEYCHAIN_SERVICE, ACCOUNT_GEMINI);
}

/**
 * Retrieve an OpenAI API key from the OS keychain.
 * @returns The key string or null if not stored / unavailable.
 */
export async function getOpenaiKey(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  return getSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENAI);
}

/**
 * Retrieve an Opencode Zen API key from the OS keychain.
 * @returns The key string or null if not stored / unavailable.
 */
export async function getOpencodeZenKey(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  return getSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENCODE_ZEN);
}

/**
 * Retrieve a GitHub API key from the OS keychain.
 * @returns The key string or null if not stored / unavailable.
 */
export async function getGithubKey(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  return getSecret(KEYCHAIN_SERVICE, ACCOUNT_GITHUB);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Remove the Anthropic API key from the OS keychain. */
export async function deleteAnthropicKey(): Promise<void> {
  await deleteSecret(KEYCHAIN_SERVICE, ACCOUNT_ANTHROPIC);
}

/** Remove the LMX API key from the OS keychain. */
export async function deleteLmxKey(): Promise<void> {
  await deleteSecret(KEYCHAIN_SERVICE, ACCOUNT_LMX);
}


/** Remove a Gemini API key from the OS keychain. */
export async function deleteGeminiKey(): Promise<void> {
  await deleteSecret(KEYCHAIN_SERVICE, ACCOUNT_GEMINI);
}

/** Remove an OpenAI API key from the OS keychain. */
export async function deleteOpenaiKey(): Promise<void> {
  await deleteSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENAI);
}

/** Remove an Opencode Zen API key from the OS keychain. */
export async function deleteOpencodeZenKey(): Promise<void> {
  await deleteSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENCODE_ZEN);
}

/** Remove a GitHub API key from the OS keychain. */
export async function deleteGithubKey(): Promise<void> {
  await deleteSecret(KEYCHAIN_SERVICE, ACCOUNT_GITHUB);
}

// ---------------------------------------------------------------------------
// Status probe
// ---------------------------------------------------------------------------

/**
 * Probe keychain availability and whether each key is stored.
 *
 * @returns An object describing keychain state:
 *   - available: whether the platform has a supported keychain backend
 *   - anthropic: whether an Anthropic key is present in the keychain
 *   - lmx: whether an LMX key is present in the keychain
 */
export async function keychainStatus(): Promise<{
  anthropic: boolean;
  lmx: boolean;
  gemini: boolean;
  openai: boolean;
  opencodeZen: boolean;
  github: boolean;
  available: boolean;
}> {
  const available = isKeychainAvailable();
  if (!available) {
    return {
      available: false,
      anthropic: false,
      lmx: false,
      gemini: false,
      openai: false,
      opencodeZen: false,
      github: false,
    };
  }

  const [anthropicKey, lmxKey, geminiKey, openaiKey, opencodeZenKey, githubKey] = await Promise.all([
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_ANTHROPIC),
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_LMX),
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_GEMINI),
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENAI),
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_OPENCODE_ZEN),
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_GITHUB),
  ]);

  const hasKey = (value: string | null | undefined): boolean =>
    typeof value === 'string' && value.length > 0;

  return {
    available: true,
    anthropic: hasKey(anthropicKey),
    lmx: hasKey(lmxKey),
    gemini: hasKey(geminiKey),
    openai: hasKey(openaiKey),
    opencodeZen: hasKey(opencodeZenKey),
    github: hasKey(githubKey),
  };
}
