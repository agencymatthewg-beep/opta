import type { OptaConfig } from '../core/config.js';

export const CANONICAL_PROVIDER_NAMES = [
  'lmx',
  'anthropic',
  'gemini',
  'openai',
  'opencode_zen',
] as const;

export type CanonicalProviderName = (typeof CANONICAL_PROVIDER_NAMES)[number];
export type CloudProviderName = Exclude<CanonicalProviderName, 'lmx'>;
export type ProviderKeySource = 'config' | 'env' | 'keychain' | 'cloud' | 'vertex' | 'none';
export type GeminiAuthMode = 'api-key' | 'vertex';

export interface GeminiRuntimeAuth {
  mode: GeminiAuthMode;
  project: string;
  location: string;
  enabled: boolean;
}

export const GEMINI_VERTEX_AUTH_SENTINEL = '__opta_gemini_vertex_oauth__';

const PROVIDER_ALIASES: Record<CanonicalProviderName, readonly string[]> = {
  lmx: ['lmx', 'local', 'local_lmx', 'local-lmx'],
  anthropic: ['anthropic', 'claude', 'claude-code', 'claude_code'],
  gemini: ['gemini', 'google'],
  openai: ['openai', 'codex', 'minimax'],
  opencode_zen: ['opencode_zen', 'opencode-zen', 'opencode', 'opencodezen', 'zen'],
};

const PROVIDER_DISPLAY: Record<CanonicalProviderName, string> = {
  lmx: 'LMX (Local)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Gemini (Google)',
  openai: 'OpenAI / Codex / Minimax',
  opencode_zen: 'OpenCode Zen',
};

const CLOUD_FALLBACK_DEFAULT: readonly CloudProviderName[] = [
  'anthropic',
  'gemini',
  'openai',
  'opencode_zen',
];

const ENV_VARS_BY_PROVIDER: Record<CloudProviderName, readonly string[]> = {
  anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openai: ['OPENAI_API_KEY', 'CODEX_API_KEY', 'MINIMAX_API_KEY'],
  opencode_zen: ['OPENCODE_ZEN_API_KEY', 'OPENCODE_API_KEY'],
};

const KEYCHAIN_ALIASES_BY_PROVIDER: Record<CloudProviderName, readonly string[]> = {
  anthropic: ['anthropic', 'claude'],
  gemini: ['gemini', 'google'],
  openai: ['openai', 'codex', 'minimax'],
  opencode_zen: ['opencode_zen', 'opencode-zen', 'opencode'],
};

const CLOUD_ALIASES_BY_PROVIDER: Record<CloudProviderName, readonly string[]> = {
  anthropic: ['anthropic', 'claude'],
  gemini: ['gemini', 'google'],
  openai: ['openai', 'codex', 'minimax'],
  opencode_zen: ['opencode_zen', 'opencode-zen', 'opencode'],
};

const ALIAS_TO_PROVIDER = new Map<string, CanonicalProviderName>();
for (const provider of CANONICAL_PROVIDER_NAMES) {
  ALIAS_TO_PROVIDER.set(provider, provider);
  for (const alias of PROVIDER_ALIASES[provider]) {
    ALIAS_TO_PROVIDER.set(normalizeAlias(alias), provider);
  }
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseBooleanish(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function parseGeminiAuthMode(value: string | undefined): GeminiAuthMode | 'auto' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (['vertex', 'vertex_ai', 'vertex-ai', 'oauth', 'adc'].includes(normalized)) {
    return 'vertex';
  }
  if (['api', 'api_key', 'api-key', 'apikey', 'key'].includes(normalized)) {
    return 'api-key';
  }
  return 'auto';
}

function readFirstEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function parseProvider(value: string | undefined): CanonicalProviderName | null {
  if (!value || !value.trim()) return null;
  return ALIAS_TO_PROVIDER.get(normalizeAlias(value)) ?? null;
}

function readConfigProviderApiKey(
  config: OptaConfig,
  provider: CloudProviderName,
): string {
  if (provider === 'anthropic') return config.provider.anthropic.apiKey.trim();
  if (provider === 'gemini') return config.provider.gemini.apiKey.trim();
  if (provider === 'openai') return config.provider.openai.apiKey.trim();
  return config.provider.opencode_zen.apiKey.trim();
}

export function resolveGeminiRuntimeAuth(): GeminiRuntimeAuth {
  const modePreference = parseGeminiAuthMode(process.env['OPTA_GEMINI_AUTH_MODE']);
  const useVertexFlag = parseBooleanish(process.env['GOOGLE_GENAI_USE_VERTEXAI']);
  const mode: GeminiAuthMode =
    modePreference === 'vertex' || useVertexFlag === true ? 'vertex' : 'api-key';

  const project = readFirstEnv([
    'GOOGLE_CLOUD_PROJECT',
    'GCLOUD_PROJECT',
    'GCP_PROJECT',
    'GOOGLE_PROJECT_ID',
  ]);
  const location =
    readFirstEnv([
      'GOOGLE_CLOUD_LOCATION',
      'GOOGLE_GENAI_LOCATION',
      'VERTEX_AI_LOCATION',
      'CLOUD_ML_REGION',
    ]) || 'us-central1';

  return {
    mode,
    project,
    location,
    enabled: mode === 'vertex',
  };
}

function toCloudProvider(provider: CanonicalProviderName): CloudProviderName | null {
  return provider === 'lmx' ? null : provider;
}

export function normalizeProviderName(
  value: string | undefined,
  fallback: CanonicalProviderName = 'lmx',
): CanonicalProviderName {
  return parseProvider(value) ?? fallback;
}

export function parseProviderName(value: string): CanonicalProviderName {
  const normalized = parseProvider(value);
  if (normalized) return normalized;
  throw new Error(
    `Invalid provider "${value}". Expected one of: ${CANONICAL_PROVIDER_NAMES.join(
      ', ',
    )}. Aliases: claude, google, codex, minimax, opencode.`,
  );
}

export function providerDisplayName(provider: CanonicalProviderName): string {
  return PROVIDER_DISPLAY[provider] ?? provider;
}

export function providerEndpointHint(provider: CanonicalProviderName): string {
  if (provider === 'lmx') return 'local-lmx';
  if (provider === 'anthropic') return 'api.anthropic.com';
  if (provider === 'gemini') return 'generativelanguage.googleapis.com';
  if (provider === 'openai') return 'api.openai.com';
  return 'api.opencodezen.com';
}

export function providerModelFromConfig(
  config: OptaConfig,
  provider: CanonicalProviderName,
): string {
  if (provider === 'anthropic') return config.provider.anthropic.model;
  if (provider === 'gemini') return config.provider.gemini.model;
  if (provider === 'openai') return config.provider.openai.model;
  if (provider === 'opencode_zen') return config.provider.opencode_zen.model;
  return config.model.default;
}

export function providerEnvVarNames(provider: CloudProviderName): readonly string[] {
  return ENV_VARS_BY_PROVIDER[provider];
}

export function readEnvProviderApiKey(provider: CloudProviderName): string {
  for (const envVar of ENV_VARS_BY_PROVIDER[provider]) {
    const value = process.env[envVar]?.trim();
    if (value) return value;
  }
  return '';
}

export function providerOptionHelp(): string {
  return 'lmx|anthropic|gemini|openai|opencode_zen (aliases: claude, google, codex, minimax, opencode)';
}

export function parseCloudFallbackOrder(raw?: string): CloudProviderName[] {
  const tokens = (raw ?? process.env['OPTA_CLOUD_FALLBACK_ORDER'] ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return [...CLOUD_FALLBACK_DEFAULT];

  const order: CloudProviderName[] = [];
  for (const token of tokens) {
    const canonical = parseProvider(token);
    if (!canonical || canonical === 'lmx') continue;
    if (!order.includes(canonical)) order.push(canonical);
  }
  return order.length > 0 ? order : [...CLOUD_FALLBACK_DEFAULT];
}

export async function resolveProviderApiKey(
  config: OptaConfig,
  provider: CloudProviderName,
  options: { includeCloud?: boolean } = {},
): Promise<{ apiKey: string; source: ProviderKeySource }> {
  if (provider === 'gemini') {
    const vertexAuth = resolveGeminiRuntimeAuth();
    if (vertexAuth.enabled) {
      if (!vertexAuth.project) {
        return { apiKey: '', source: 'none' };
      }
      return { apiKey: GEMINI_VERTEX_AUTH_SENTINEL, source: 'vertex' };
    }
  }

  const configured = readConfigProviderApiKey(config, provider);
  if (configured) return { apiKey: configured, source: 'config' };

  const env = readEnvProviderApiKey(provider);
  if (env) return { apiKey: env, source: 'env' };

  try {
    const { getKeyByProvider } = await import('../keychain/api-keys.js');
    for (const alias of KEYCHAIN_ALIASES_BY_PROVIDER[provider]) {
      const key = (await getKeyByProvider(alias))?.trim();
      if (key) return { apiKey: key, source: 'keychain' };
    }
  } catch {
    // keychain unavailable
  }

  if (options.includeCloud !== false) {
    try {
      const { loadAccountState } = await import('../accounts/storage.js');
      const { resolveCloudApiKey } = await import('../accounts/cloud.js');
      const state = await loadAccountState();
      for (const alias of CLOUD_ALIASES_BY_PROVIDER[provider]) {
        const key = (await resolveCloudApiKey(state, alias))?.trim();
        if (key) return { apiKey: key, source: 'cloud' };
      }
    } catch {
      // cloud lookup unavailable
    }
  }

  return { apiKey: '', source: 'none' };
}

export async function hasProviderApiKey(
  config: OptaConfig,
  provider: CloudProviderName,
  options: { includeCloud?: boolean } = {},
): Promise<boolean> {
  if (provider === 'gemini') {
    const vertexAuth = resolveGeminiRuntimeAuth();
    if (vertexAuth.enabled) {
      return vertexAuth.project.length > 0;
    }
  }
  const resolved = await resolveProviderApiKey(config, provider, options);
  return resolved.apiKey.length > 0;
}

export async function pickFirstConfiguredCloudProvider(
  config: OptaConfig,
  order: readonly CloudProviderName[] = parseCloudFallbackOrder(),
): Promise<CloudProviderName | null> {
  for (const provider of order) {
    if (await hasProviderApiKey(config, provider)) return provider;
  }
  return null;
}

export function toCloudProviderName(value: string | undefined): CloudProviderName | null {
  const canonical = normalizeProviderName(value, 'lmx');
  return toCloudProvider(canonical);
}
