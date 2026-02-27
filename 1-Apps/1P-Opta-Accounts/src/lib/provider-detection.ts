/**
 * provider-detection.ts — Smart API key provider detection.
 *
 * Regex heuristics ported from 1D-Opta-CLI-TS/src/commands/keychain.ts.
 * No Node.js deps — works in browser and server.
 */

export type ApiKeyProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'tavily'
  | 'exa'
  | 'brave'
  | 'groq'
  | 'lmx';

export interface ProviderInfo {
  id: ApiKeyProvider;
  name: string;
  icon: string;
  pattern?: RegExp;
  envHint: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'anthropic', name: 'Anthropic', icon: 'Bot', pattern: /^sk-ant-[A-Za-z0-9_-]{10,}$/i, envHint: 'ANTHROPIC_API_KEY' },
  { id: 'openai', name: 'OpenAI', icon: 'Sparkles', pattern: /^sk-(proj-)?[A-Za-z0-9_-]{10,}$/i, envHint: 'OPENAI_API_KEY' },
  { id: 'gemini', name: 'Gemini', icon: 'Gem', pattern: /^AIza[0-9A-Za-z_-]{20,}$/, envHint: 'GEMINI_API_KEY' },
  { id: 'groq', name: 'Groq', icon: 'Zap', pattern: /^gsk_[A-Za-z0-9_-]{10,}$/i, envHint: 'GROQ_API_KEY' },
  { id: 'tavily', name: 'Tavily', icon: 'Search', pattern: /^tvly-[A-Za-z0-9_-]{8,}$/i, envHint: 'TAVILY_API_KEY' },
  { id: 'lmx', name: 'LMX', icon: 'Cpu', pattern: /^opta_sk_[A-Za-z0-9_-]{16,}$/i, envHint: 'OPTA_LMX_API_KEY' },
  { id: 'brave', name: 'Brave Search', icon: 'Shield', envHint: 'BRAVE_API_KEY' },
  { id: 'exa', name: 'Exa', icon: 'Globe', envHint: 'EXA_API_KEY' },
];

/**
 * Detect which provider a key belongs to based on prefix heuristics.
 * Returns null for keys without distinct prefixes (Brave, Exa).
 */
export function detectProvider(key: string): ApiKeyProvider | null {
  const trimmed = key.trim();
  if (!trimmed) return null;

  // LMX first — most specific prefix
  if (/^opta_sk_[A-Za-z0-9_-]{16,}$/i.test(trimmed)) return 'lmx';
  // Anthropic before OpenAI — both start with sk- but Anthropic has sk-ant-
  if (/^sk-ant-[A-Za-z0-9_-]{10,}$/i.test(trimmed)) return 'anthropic';
  // Gemini — AIza prefix
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(trimmed)) return 'gemini';
  // Tavily — tvly- prefix
  if (/^tvly-[A-Za-z0-9_-]{8,}$/i.test(trimmed)) return 'tavily';
  // Groq — gsk_ prefix
  if (/^gsk_[A-Za-z0-9_-]{10,}$/i.test(trimmed)) return 'groq';
  // OpenAI — sk- or sk-proj- (after excluding Anthropic)
  if (/^sk-(proj-)?[A-Za-z0-9_-]{10,}$/i.test(trimmed)) return 'openai';

  return null;
}

/**
 * Mask a key for safe display: "sk-ant-●●●●●●●abc"
 * Shows prefix (first 8 chars) and suffix (last 3 chars).
 */
export function maskKey(key: string): string {
  if (key.length <= 12) return '●'.repeat(key.length);
  const prefix = key.slice(0, 8);
  const suffix = key.slice(-3);
  const masked = '●'.repeat(Math.min(key.length - 11, 12));
  return `${prefix}${masked}${suffix}`;
}

/**
 * Check if a string looks like it could be a valid API key format.
 */
export function isValidKeyFormat(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length >= 16 && /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function getProviderById(id: ApiKeyProvider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id)!;
}
