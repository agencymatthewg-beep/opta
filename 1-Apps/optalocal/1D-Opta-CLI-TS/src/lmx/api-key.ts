/**
 * lmx/api-key.ts — LMX API key resolution.
 *
 * Priority chain (highest to lowest):
 *   1. OPTA_API_KEY env var
 *   2. connection.apiKey from config
 *   3. (async only) OS keychain via src/keychain/
 *   4. (async only) Opta Accounts cloud key via src/accounts/cloud.resolveCloudApiKey
 *   5. Default sentinel value 'opta-lmx'
 *
 * The sync form (resolveLmxApiKey) is kept for backwards compatibility with
 * callers that cannot be async — it resolves through steps 1 and 2 only.
 *
 * The async form (resolveLmxApiKeyAsync) performs the full five-step chain
 * including keychain lookup and Opta Accounts cloud fallback, and should be
 * preferred in new code.
 */

/**
 * Synchronous API key resolution (env var → config → default).
 *
 * Does NOT check the OS keychain. Use this for cache-key generation and any
 * synchronous context that must not be made async.
 */
export function resolveLmxApiKey(connection: { apiKey?: string }): string {
  const envApiKey = process.env['OPTA_API_KEY']?.trim();
  if (envApiKey) return envApiKey;

  const configuredApiKey = connection.apiKey?.trim();
  if (configuredApiKey) return configuredApiKey;

  return 'opta-lmx';
}

/**
 * Async API key resolution (env var → config → keychain → default).
 *
 * Extends the sync form with a keychain lookup before falling back to the
 * default sentinel. Falls back gracefully if the keychain module is
 * unavailable or the platform is not supported.
 */
export async function resolveLmxApiKeyAsync(connection: { apiKey?: string }): Promise<string> {
  // 1. Environment variable
  const envApiKey = process.env['OPTA_API_KEY']?.trim();
  if (envApiKey) return envApiKey;

  // 2. Config file
  const configuredApiKey = connection.apiKey?.trim();
  if (configuredApiKey) return configuredApiKey;

  // 3. OS keychain
  try {
    const { getLmxKey } = await import('../keychain/api-keys.js');
    const keychainKey = await getLmxKey();
    if (keychainKey && keychainKey.trim().length > 0) return keychainKey.trim();
  } catch {
    // Keychain module unavailable or errored — fall through to default
  }

  // 4. Cloud key from Opta Accounts
  try {
    const { loadAccountState } = await import('../accounts/storage.js');
    const { resolveCloudApiKey } = await import('../accounts/cloud.js');
    const state = await loadAccountState();
    const cloudKey = await resolveCloudApiKey(state, 'lmx');
    if (cloudKey && cloudKey.trim().length > 0) return cloudKey.trim();
  } catch {
    // Cloud lookup unavailable — fall through to default
  }

  // 5. Default sentinel
  return 'opta-lmx';
}
