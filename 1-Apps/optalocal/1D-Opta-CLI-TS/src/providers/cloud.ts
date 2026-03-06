import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';
import { instantiateOrInvoke } from '../utils/newable.js';
import {
  GEMINI_VERTEX_AUTH_SENTINEL,
  resolveGeminiRuntimeAuth,
  normalizeProviderName,
  providerEnvVarNames,
  resolveProviderApiKey,
  type CloudProviderName,
  type ProviderKeySource,
} from '../utils/provider-normalization.js';

const GOOGLE_CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

async function createGoogleAccessTokenProvider(): Promise<() => Promise<string>> {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: [GOOGLE_CLOUD_PLATFORM_SCOPE] });

  let cachedToken = '';
  let cachedExpiry = 0;

  return async () => {
    const now = Date.now();
    if (cachedToken && now < cachedExpiry - 60_000) {
      return cachedToken;
    }

    const client = await auth.getClient();
    const response = await client.getAccessToken();
    const token = typeof response === 'string' ? response : response.token;

    if (!token) {
      throw new Error(
        'Google ADC did not return an access token. Run `gcloud auth application-default login` ' +
          'or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.',
      );
    }

    cachedToken = token;
    cachedExpiry =
      typeof client.credentials.expiry_date === 'number'
        ? client.credentials.expiry_date
        : now + 50 * 60_000;
    return cachedToken;
  };
}

export class CloudProvider implements ProviderClient {
  readonly name: CloudProviderName;
  private client: import('openai').default | null = null;
  private config: OptaConfig;
  private customOpts?: { baseURL?: string; apiKey?: string };

  constructor(name: string, config: OptaConfig, customOpts?: { baseURL?: string; apiKey?: string }) {
    const normalized = normalizeProviderName(name, 'openai');
    this.name =
      normalized === 'gemini' || normalized === 'openai' || normalized === 'opencode_zen'
        ? normalized
        : 'openai';
    this.config = config;
    this.customOpts = customOpts;
  }

  private async resolveApiKey(): Promise<{ apiKey: string; source: ProviderKeySource }> {
    if (this.customOpts?.apiKey) {
      return { apiKey: this.customOpts.apiKey, source: 'env' };
    }

    return resolveProviderApiKey(this.config, this.name);
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;

    const { apiKey } = await this.resolveApiKey();
    const geminiVertexAuth = resolveGeminiRuntimeAuth();
    const usingGeminiVertex = apiKey === GEMINI_VERTEX_AUTH_SENTINEL;

    if (
      this.name === 'gemini' &&
      geminiVertexAuth.enabled &&
      !geminiVertexAuth.project &&
      !this.customOpts?.baseURL?.includes('localhost') &&
      !this.customOpts?.baseURL?.includes('127.0.0.1')
    ) {
      throw new Error(
        'Gemini Vertex auth is enabled, but no Google Cloud project is configured. ' +
          'Set GOOGLE_CLOUD_PROJECT (or GCLOUD_PROJECT / GCP_PROJECT) and retry.',
      );
    }

    if (!apiKey && !this.customOpts?.baseURL?.includes('localhost') && !this.customOpts?.baseURL?.includes('127.0.0.1')) {
      const providerLabel =
        this.name === 'gemini'
          ? 'Gemini'
          : this.name === 'openai'
            ? 'OpenAI/Codex/Minimax'
            : 'OpenCode Zen';
      const envHints = providerEnvVarNames(this.name).join(', ');
      const hint =
        this.customOpts && this.customOpts.baseURL
          ? `the configured environment variable for ${this.name}`
          : this.name === 'gemini'
            ? `${envHints} or Vertex OAuth (GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT) or opta config / keychain / accounts cloud`
            : `${envHints} or opta config / keychain / accounts cloud`;
      throw new Error(`Missing API key for provider ${providerLabel}. Set ${hint}.`);
    }

    let baseURL =
      this.name === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
        : this.name === 'opencode_zen'
          ? 'https://api.opencodezen.com/v1'
          : undefined;
          
    if (this.customOpts?.baseURL) {
      baseURL = this.customOpts.baseURL;
    }

    let customFetch: typeof fetch | undefined;
    if (this.name === 'gemini' && usingGeminiVertex) {
      const project = geminiVertexAuth.project;
      const location = geminiVertexAuth.location;
      baseURL = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/endpoints/openapi`;

      const accessTokenProvider = await createGoogleAccessTokenProvider();
      customFetch = async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ): Promise<Response> => {
        const token = await accessTokenProvider();
        const headers = new Headers(init?.headers ?? {});
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      };
    }

    const { default: OpenAI } = await import('openai');
    this.client = instantiateOrInvoke<import('openai').default>(OpenAI, { 
      apiKey: usingGeminiVertex ? 'vertex-oauth' : apiKey || 'dummy-key-for-local',
      baseURL,
      ...(customFetch ? { fetch: customFetch } : {}),
    });
    return this.client;
  }

  async health(): Promise<ProviderHealthResult> {
    try {
      const start = Date.now();
      await this.getClient();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: 0, error: errorMessage(err) };
    }
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    const client = await this.getClient();
    try {
      const list = await client.models.list();
      return list.data.map((m) => ({ id: m.id, source: this.name, loaded: false }));
    } catch {
      return [];
    }
  }
}
