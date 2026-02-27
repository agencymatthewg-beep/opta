/**
 * LMX provider — wraps Opta-LMX (OpenAI-compatible local inference server).
 */

import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { errorMessage } from '../utils/errors.js';
import { probeLmxConnection } from '../lmx/connection.js';
import { resolveLmxEndpoint } from '../lmx/endpoints.js';
import { resolveLmxApiKey } from '../lmx/api-key.js';

export class LmxProvider implements ProviderClient {
  readonly name = 'lmx';
  private client: import('openai').default | null = null;
  private config: OptaConfig;
  private resolvedHost: string | null = null;

  constructor(config: OptaConfig) {
    this.config = config;
  }

  get baseURL(): string {
    const host = this.resolvedHost ?? this.config.connection.host;
    return `http://${host}:${this.config.connection.port}/v1`;
  }

  async getClient(): Promise<import('openai').default> {
    if (this.client) return this.client;

    const endpoint = await resolveLmxEndpoint({
      host: this.config.connection.host,
      fallbackHosts: this.config.connection.fallbackHosts,
      port: this.config.connection.port,
      adminKey: this.config.connection.adminKey,
    });
    this.resolvedHost = endpoint.host;

    const { default: OpenAI } = await import('openai');
    this.client = new OpenAI({
      baseURL: this.baseURL,
      apiKey: resolveLmxApiKey(this.config.connection),
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
      const endpoint = await resolveLmxEndpoint({
        host: this.config.connection.host,
        fallbackHosts: this.config.connection.fallbackHosts,
        port: this.config.connection.port,
        adminKey: this.config.connection.adminKey,
      }, { timeoutMs: 2_000 });
      const result = await probeLmxConnection(
        endpoint.host,
        this.config.connection.port,
        { timeoutMs: 5000, adminKey: this.config.connection.adminKey }
      );
      return {
        ok: result.state !== 'disconnected',
        latencyMs: result.latencyMs,
        loadedModels: result.modelsLoaded ?? 0,
        error: result.state === 'disconnected' ? (result.reason ?? 'LMX unreachable') : undefined,
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
