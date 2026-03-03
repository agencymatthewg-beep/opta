import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';
import { instantiateOrInvoke } from '../utils/newable.js';

type CloudKeySource = 'config' | 'env' | 'keychain' | 'cloud' | 'none';

export class CloudProvider implements ProviderClient {
  readonly name: string;
  private client: import('openai').default | null = null;
  private config: OptaConfig;

  constructor(name: string, config: OptaConfig) {
    this.name = name;
    this.config = config;
  }

  private async resolveApiKey(): Promise<{ apiKey: string; source: CloudKeySource }> {
    const configuredProvider =
      this.name === 'gemini'
        ? this.config.provider.gemini.apiKey
        : this.name === 'openai'
          ? this.config.provider.openai.apiKey
          : this.config.provider.opencode_zen.apiKey;

    if (configuredProvider?.trim()) {
      return { apiKey: configuredProvider.trim(), source: 'config' };
    }

    const envVar =
      this.name === 'gemini'
        ? process.env['GEMINI_API_KEY']
        : this.name === 'openai'
          ? process.env['OPENAI_API_KEY']
          : process.env['OPENCODE_ZEN_API_KEY'];
    if (envVar?.trim()) {
      return { apiKey: envVar.trim(), source: 'env' };
    }

    try {
      if (this.name === 'gemini') {
        const { getGeminiKey } = await import('../keychain/api-keys.js');
        const key = (await getGeminiKey())?.trim();
        if (key) return { apiKey: key, source: 'keychain' };
      }
      if (this.name === 'openai') {
        const { getOpenaiKey } = await import('../keychain/api-keys.js');
        const key = (await getOpenaiKey())?.trim();
        if (key) return { apiKey: key, source: 'keychain' };
      }
      const { getOpencodeZenKey } = await import('../keychain/api-keys.js');
      const key = (await getOpencodeZenKey())?.trim();
      if (key) return { apiKey: key, source: 'keychain' };
    } catch {
      // Keychain unavailable — continue.
    }

    // Optional Opta Accounts cloud token source for portable key management.
    try {
      const { loadAccountState } = await import('../accounts/storage.js');
      const { resolveCloudApiKey } = await import('../accounts/cloud.js');
      const state = await loadAccountState();
      const cloudKey = (await resolveCloudApiKey(state, this.name))?.trim();
      if (cloudKey) return { apiKey: cloudKey, source: 'cloud' };
    } catch {
      // Cloud lookup unavailable.
    }

    return { apiKey: '', source: 'none' };
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;

    const { apiKey } = await this.resolveApiKey();

    if (!apiKey) {
      const hint =
        this.name === 'gemini'
          ? 'GEMINI_API_KEY or opta config / keychain / accounts cloud'
          : this.name === 'openai'
            ? 'OPENAI_API_KEY or opta config / keychain / accounts cloud'
            : 'OPENCODE_ZEN_API_KEY or opta config / keychain / accounts cloud';
      throw new Error(`Missing API key for provider: ${this.name}. Set ${hint}.`);
    }

    const baseURL =
      this.name === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
        : this.name === 'opencode_zen'
          ? 'https://api.opencodezen.com/v1'
          : undefined;

    const { default: OpenAI } = await import('openai');
    this.client = instantiateOrInvoke<import('openai').default>(OpenAI, { apiKey, baseURL });
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
