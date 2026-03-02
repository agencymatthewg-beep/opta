import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';

export class CloudProvider implements ProviderClient {
  readonly name: string;
  private client: import('openai').default | null = null;
  private config: OptaConfig;

  constructor(name: string, config: OptaConfig) {
    this.name = name;
    this.config = config;
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;
    
    let apiKey = '';
    let baseURL: string | undefined;
    
    if (this.name === 'gemini') {
      apiKey = this.config.provider.gemini.apiKey || process.env['GEMINI_API_KEY'] || '';
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    } else if (this.name === 'openai') {
      apiKey = this.config.provider.openai.apiKey || process.env['OPENAI_API_KEY'] || '';
    } else if (this.name === 'opencode_zen') {
      apiKey = this.config.provider.opencode_zen.apiKey || process.env['OPENCODE_ZEN_API_KEY'] || '';
      baseURL = 'https://api.opencodezen.com/v1'; // Placeholder
    }

    if (!apiKey) {
      throw new Error(`Missing API key for provider: ${this.name}`);
    }

    const { OpenAI } = await import('openai');
    this.client = new OpenAI({ apiKey, baseURL });
    return this.client;
  }

  async health(): Promise<ProviderHealthResult> {
    try {
      await this.getClient();
      return { ok: true, latencyMs: 0 };
    } catch (err) {
      return { ok: false, latencyMs: 0, error: errorMessage(err) };
    }
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    const client = await this.getClient();
    try {
      const list = await client.models.list();
      return list.data.map(m => ({ id: m.id, source: this.name, loaded: false }));
    } catch {
      return [];
    }
  }
}
