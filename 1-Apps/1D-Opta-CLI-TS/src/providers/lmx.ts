/**
 * LMX provider — wraps Opta-LMX (OpenAI-compatible local inference server).
 */

import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';

export class LmxProvider implements ProviderClient {
  readonly name = 'lmx';
  private client: import('openai').default | null = null;
  private config: OptaConfig;

  constructor(config: OptaConfig) {
    this.config = config;
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;

    const { default: OpenAI } = await import('openai');
    const baseURL = `http://${this.config.connection.host}:${this.config.connection.port}/v1`;
    this.client = new OpenAI({ baseURL, apiKey: 'opta-lmx' });
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
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
