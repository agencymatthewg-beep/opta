/**
 * Fallback provider — wraps LMX with automatic Anthropic degradation.
 *
 * When fallbackOnFailure is enabled, attempts LMX first for every operation.
 * On connection failure, transparently falls back to the Anthropic provider.
 */

import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import type { OptaConfig } from '../core/config.js';

export class FallbackProvider implements ProviderClient {
  readonly name = 'lmx+fallback';
  private primary: ProviderClient;
  private fallback: ProviderClient | null = null;
  private config: OptaConfig;
  private usingFallback = false;

  constructor(primary: ProviderClient, config: OptaConfig) {
    this.primary = primary;
    this.config = config;
  }

  private async getFallback(): Promise<ProviderClient> {
    if (this.fallback) return this.fallback;
    const { AnthropicProvider } = await import('./anthropic.js');
    this.fallback = new AnthropicProvider(this.config);
    return this.fallback;
  }

  private hasFallbackKey(): boolean {
    return !!(this.config.provider.anthropic.apiKey || process.env['ANTHROPIC_API_KEY']);
  }

  async getClient(): Promise<import('openai').default> {
    // Try primary (LMX) first with a quick health check
    try {
      const health = await this.primary.health();
      if (health.ok) {
        if (this.usingFallback) {
          console.error('[opta] LMX recovered — switching back from Anthropic fallback');
          this.usingFallback = false;
        }
        return await this.primary.getClient();
      }
    } catch {
      // Health check failed — try fallback
    }

    // LMX unreachable — try Anthropic fallback
    if (this.hasFallbackKey()) {
      if (!this.usingFallback) {
        console.error('[opta] LMX unreachable — falling back to Anthropic');
        this.usingFallback = true;
      }
      const fb = await this.getFallback();
      return fb.getClient();
    }

    // No fallback available — return primary client anyway (will fail at request time)
    return this.primary.getClient();
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    try {
      return await this.primary.listModels();
    } catch {
      if (this.hasFallbackKey()) {
        const fb = await this.getFallback();
        return fb.listModels();
      }
      throw new Error('LMX unreachable and no Anthropic fallback configured');
    }
  }

  async health(): Promise<ProviderHealthResult> {
    const primary = await this.primary.health();
    if (primary.ok) return primary;

    if (this.hasFallbackKey()) {
      const fb = await this.getFallback();
      const fallback = await fb.health();
      return {
        ...fallback,
        error: fallback.ok
          ? `LMX down, using Anthropic fallback (${primary.error})`
          : `Both LMX and Anthropic unreachable`,
      };
    }

    return primary;
  }
}
