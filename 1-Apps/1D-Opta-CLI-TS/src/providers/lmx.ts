/**
 * LMX provider — wraps Opta-LMX (OpenAI-compatible local inference server).
 */

import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';

export class LmxProvider implements ProviderClient {
  readonly name = 'lmx';
  private client: import('openai').default | null = null;
  private config: OptaConfig;

  constructor(config: OptaConfig) {
    this.config = config;
  }

  get baseURL(): string {
    return `http://${this.config.connection.host}:${this.config.connection.port}/v1`;
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;

    const { default: OpenAI } = await import('openai');
    this.client = new OpenAI({
      baseURL: this.baseURL,
      apiKey: 'opta-lmx',
      timeout: this.config.connection.inferenceTimeout,
    });
    return this.client;
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    const client = await this.getClient();
    const response = await client.models.list();
    const models: ProviderModelInfo[] = [];
    for await (const model of response) {
      models.push({ id: model.id, name: model.id });
    }
    return models;
  }

  async health(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      const url = `http://${this.config.connection.host}:${this.config.connection.port}/v1/models`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return { ok: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
      }
      const data = await res.json() as { data?: unknown[] };
      const modelCount = Array.isArray(data?.data) ? data.data.length : 0;
      return {
        ok: true,
        latencyMs: Date.now() - start,
        loadedModels: modelCount,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: errorMessage(err),
      };
    }
  }
}
