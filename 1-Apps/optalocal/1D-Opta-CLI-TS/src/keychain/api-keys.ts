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
  available: boolean;
}> {
  const available = isKeychainAvailable();
  if (!available) {
    return { available: false, anthropic: false, lmx: false };
  }

  const [anthropicKey, lmxKey] = await Promise.all([
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_ANTHROPIC),
    getSecret(KEYCHAIN_SERVICE, ACCOUNT_LMX),
  ]);

  return {
    available: true,
    anthropic: anthropicKey !== null && anthropicKey.length > 0,
    lmx: lmxKey !== null && lmxKey.length > 0,
  };
}
