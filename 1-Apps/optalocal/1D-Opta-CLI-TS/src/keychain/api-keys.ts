/**
 * keychain/api-keys.ts — High-level API key helpers.
 *
 * Wraps the low-level keychain module with named helpers for the two API
 * keys used by Opta CLI: Anthropic and LMX.
 *
 * Service name: 'opta-cli'
 * Accounts    : 'anthropic-api-key', 'lmx-api-key'
 */

import { createDecipheriv } from 'node:crypto';
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
const ACCOUNT_MINIMAX = 'minimax-api-key';
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

// ---------------------------------------------------------------------------
// Universal dispatch — used by vault sync
// ---------------------------------------------------------------------------

const PROVIDER_ACCOUNT_MAP: Record<string, string> = {
  anthropic: ACCOUNT_ANTHROPIC,
  claude: ACCOUNT_ANTHROPIC,
  lmx: ACCOUNT_LMX,
  gemini: ACCOUNT_GEMINI,
  openai: ACCOUNT_OPENAI,
  minimax: ACCOUNT_MINIMAX,
  opencode_zen: ACCOUNT_OPENCODE_ZEN,
  'opencode-zen': ACCOUNT_OPENCODE_ZEN,
  opencode: ACCOUNT_OPENCODE_ZEN,
  github: ACCOUNT_GITHUB,
  // New vault providers — stored under their own account IDs
  vercel: 'vercel-api-key',
  cloudflare: 'cloudflare-api-key',
  perplexity: 'perplexity-api-key',
  tavily: 'tavily-api-key',
  brave: 'brave-api-key',
  exa: 'exa-api-key',
  groq: 'groq-api-key',
  codex: 'codex-api-key',
  google: 'google-api-key',
  twitter: 'twitter-api-key',
  // OAuth subscription providers — API key fallback path (OAuth token path uses storeConnectionToken)
  'github-copilot': 'github-copilot-api-key',
  'openai-codex': 'openai-codex-api-key',
  huggingface: 'huggingface-api-key',
  hf: 'huggingface-api-key',
  openrouter: 'openrouter-api-key',
};

/**
 * Store any provider's key in the OS keychain by provider name.
 * Returns true if stored successfully, false if keychain unavailable.
 */
export async function storeKeyByProvider(
  provider: string,
  apiKey: string,
): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  const account = PROVIDER_ACCOUNT_MAP[provider.toLowerCase().trim()];
  if (!account) return false;
  await setSecret(KEYCHAIN_SERVICE, account, apiKey);
  const verify = await getSecret(KEYCHAIN_SERVICE, account);
  return verify === apiKey;
}

/**
 * Retrieve any provider's key from the OS keychain by provider name.
 */
export async function getKeyByProvider(
  provider: string,
): Promise<string | null> {
  if (!isKeychainAvailable()) return null;
  const account = PROVIDER_ACCOUNT_MAP[provider.toLowerCase().trim()];
  if (!account) return null;
  return getSecret(KEYCHAIN_SERVICE, account);
}

/**
 * Delete any provider's key from the OS keychain by provider name.
 */
export async function deleteKeyByProvider(
  provider: string,
): Promise<void> {
  if (!isKeychainAvailable()) return;
  const account = PROVIDER_ACCOUNT_MAP[provider.toLowerCase().trim()];
  if (!account) return;
  await deleteSecret(KEYCHAIN_SERVICE, account);
}

// ---------------------------------------------------------------------------
// OAuth connection token storage — used by vault connections pull
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm' as const;

function resolveTokenEncryptionKey(): Buffer | null {
  const hex = process.env['OPTA_TOKEN_ENCRYPTION_KEY']?.trim();
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

function decryptConnectionToken(ciphertext: string): string | null {
  const key = resolveTokenEncryptionKey();
  if (!key) return null;
  const parts = ciphertext.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, authTagB64, encB64] = parts as [string, string, string];
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Store an OAuth connection token in the OS keychain.
 *
 * Decrypts the server-side AES-256-GCM ciphertext using OPTA_TOKEN_ENCRYPTION_KEY,
 * stores the raw access_token under service `opta-${provider}`, and persists
 * expiry metadata under `opta-${provider}-meta` as JSON.
 *
 * Returns true if the token was stored successfully, false if keychain is
 * unavailable or decryption failed (missing/wrong key).
 */
export async function storeConnectionToken(
  provider: string,
  tokenEncrypted: string,
  expiresAt: string | null,
): Promise<boolean> {
  if (!isKeychainAvailable()) return false;
  const accessToken = decryptConnectionToken(tokenEncrypted);
  if (!accessToken) return false;
  const service = `opta-${provider.toLowerCase().trim()}`;
  await setSecret(service, 'access-token', accessToken);
  const verify = await getSecret(service, 'access-token');
  if (verify !== accessToken) return false;
  const meta = JSON.stringify({ expiresAt: expiresAt ?? null });
  await setSecret(`${service}-meta`, 'token-meta', meta);
  return true;
}

/**
 * Retrieve OAuth connection token metadata from the OS keychain.
 *
 * Returns `{ expiresAt }` if found, or null if the metadata is not present.
 */
export async function getConnectionTokenMeta(
  provider: string,
): Promise<{ expiresAt: string | null } | null> {
  if (!isKeychainAvailable()) return null;
  const service = `opta-${provider.toLowerCase().trim()}-meta`;
  const raw = await getSecret(service, 'token-meta');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'expiresAt' in parsed) {
      const ea = (parsed as Record<string, unknown>)['expiresAt'];
      return { expiresAt: typeof ea === 'string' ? ea : null };
    }
    return null;
  } catch {
    return null;
  }
}
