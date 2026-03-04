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
  | 'lmx'
  | 'github'
  | 'vercel'
  | 'cloudflare'
  | 'perplexity'
  | 'opencode'
  | 'codex'
  | 'google'
  | 'twitter';

export type ProviderCategory = 'AI Models' | 'Research Tools' | 'Developer Platforms';

export interface ProviderInfo {
  id: ApiKeyProvider;
  name: string;
  icon: string;
  pattern?: RegExp;
  envHint: string;
  category: ProviderCategory;
}

export const PROVIDERS: ProviderInfo[] = [
  // AI Models
  { id: 'anthropic', name: 'Anthropic', icon: 'Bot', pattern: /^sk-ant-[A-Za-z0-9_-]{10,}$/i, envHint: 'ANTHROPIC_API_KEY', category: 'AI Models' },
  { id: 'openai', name: 'OpenAI', icon: 'Sparkles', pattern: /^sk-(proj-)?[A-Za-z0-9_-]{10,}$/i, envHint: 'OPENAI_API_KEY', category: 'AI Models' },
  { id: 'gemini', name: 'Gemini', icon: 'Gem', pattern: /^AIza[0-9A-Za-z_-]{20,}$/, envHint: 'GEMINI_API_KEY', category: 'AI Models' },
  { id: 'groq', name: 'Groq', icon: 'Zap', pattern: /^gsk_[A-Za-z0-9_-]{10,}$/i, envHint: 'GROQ_API_KEY', category: 'AI Models' },
  { id: 'lmx', name: 'LMX', icon: 'Cpu', pattern: /^opta_sk_[A-Za-z0-9_-]{16,}$/i, envHint: 'OPTA_LMX_API_KEY', category: 'AI Models' },
  { id: 'opencode', name: 'OpenCode', icon: 'Terminal', envHint: 'OPENCODE_API_KEY', category: 'AI Models' },
  { id: 'codex', name: 'Codex', icon: 'Binary', pattern: /^sk-[A-Za-z0-9_-]{10,}$/i, envHint: 'CODEX_API_KEY', category: 'AI Models' },
  // Research Tools
  { id: 'tavily', name: 'Tavily', icon: 'Search', pattern: /^tvly-[A-Za-z0-9_-]{8,}$/i, envHint: 'TAVILY_API_KEY', category: 'Research Tools' },
  { id: 'brave', name: 'Brave Search', icon: 'Shield', envHint: 'BRAVE_API_KEY', category: 'Research Tools' },
  { id: 'exa', name: 'Exa', icon: 'Globe', envHint: 'EXA_API_KEY', category: 'Research Tools' },
  { id: 'perplexity', name: 'Perplexity', icon: 'BrainCircuit', pattern: /^pplx-[A-Za-z0-9_-]+$/i, envHint: 'PERPLEXITY_API_KEY', category: 'Research Tools' },
  // Developer Platforms
  { id: 'github', name: 'GitHub', icon: 'Github', pattern: /^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}$/, envHint: 'GITHUB_TOKEN', category: 'Developer Platforms' },
  { id: 'vercel', name: 'Vercel', icon: 'Triangle', pattern: /^vcp_[A-Za-z0-9_-]+$/, envHint: 'VERCEL_TOKEN', category: 'Developer Platforms' },
  { id: 'cloudflare', name: 'Cloudflare', icon: 'Cloud', pattern: /^[A-Za-z0-9_-]{40}$/, envHint: 'CLOUDFLARE_API_TOKEN', category: 'Developer Platforms' },
  { id: 'google', name: 'Google', icon: 'Chrome', envHint: 'GOOGLE_API_KEY', category: 'Developer Platforms' },
  { id: 'twitter', name: 'Twitter/X', icon: 'Twitter', envHint: 'TWITTER_BEARER_TOKEN', category: 'Developer Platforms' },
];

/**
 * Detect which provider a key belongs to based on prefix heuristics.
 * Returns null for keys without distinct prefixes (Brave, Exa).
 */
export function detectProvider(key: string): ApiKeyProvider | null {
  const trimmed = key.trim();
  if (!trimmed) return null;

  // GitHub
  if (/^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}$/.test(trimmed)) return 'github';
  // Vercel
  if (/^vcp_[A-Za-z0-9_-]+$/.test(trimmed)) return 'vercel';
  // Cloudflare
  if (/^[A-Za-z0-9_-]{40}$/.test(trimmed)) return 'cloudflare';
  // Perplexity
  if (/^pplx-[A-Za-z0-9_-]+$/i.test(trimmed)) return 'perplexity';
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
  // OpenAI/Codex — sk- or sk-proj- (after excluding Anthropic)
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
