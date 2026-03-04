import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';
import { instantiateOrInvoke } from '../utils/newable.js';
import {
  normalizeProviderName,
  providerEnvVarNames,
  resolveProviderApiKey,
  type CloudProviderName,
  type ProviderKeySource,
} from '../utils/provider-normalization.js';

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

    const { default: OpenAI } = await import('openai');
    this.client = instantiateOrInvoke<import('openai').default>(OpenAI, { 
      apiKey: apiKey || 'dummy-key-for-local', 
      baseURL 
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
