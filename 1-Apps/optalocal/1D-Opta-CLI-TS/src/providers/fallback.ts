/**
 * Fallback provider — wraps LMX with automatic cloud degradation.
 *
 * When fallbackOnFailure is enabled, attempts LMX first for every operation.
 * On connection failure, transparently falls back to the first configured
 * cloud provider from fallback order.
 */

import type { ProviderClient, ProviderModelInfo, ProviderHealthResult } from './base.js';
import { instantiateOrInvoke } from '../utils/newable.js';
import type { OptaConfig } from '../core/config.js';
import {
  pickFirstConfiguredCloudProvider,
  providerDisplayName,
  type CloudProviderName,
} from '../utils/provider-normalization.js';

export class FallbackProvider implements ProviderClient {
  readonly name = 'lmx+fallback';
  private primary: ProviderClient;
  private fallback: ProviderClient | null = null;
  private fallbackProviderName: CloudProviderName | null = null;
  private config: OptaConfig;
  private usingFallback = false;

  constructor(primary: ProviderClient, config: OptaConfig) {
    this.primary = primary;
    this.config = config;
  }

  private async getFallback(): Promise<ProviderClient | null> {
    if (this.fallback) return this.fallback;

    const selected = await pickFirstConfiguredCloudProvider(this.config);
    if (!selected) return null;

    this.fallbackProviderName = selected;
    if (selected === 'anthropic') {
      const { AnthropicProvider } = await import('./anthropic.js');
      this.fallback = instantiateOrInvoke<ProviderClient>(AnthropicProvider, this.config);
      return this.fallback;
    }

    const { CloudProvider } = await import('./cloud.js');
    this.fallback = instantiateOrInvoke<ProviderClient>(CloudProvider, selected, this.config);
    return this.fallback;
  }

  private fallbackLabel(): string {
    if (!this.fallbackProviderName) return 'cloud fallback';
    return providerDisplayName(this.fallbackProviderName);
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

    // LMX unreachable — try cloud fallback
    const fallback = await this.getFallback();
    if (fallback) {
      if (!this.usingFallback) {
        console.error(`[opta] LMX unreachable — falling back to ${this.fallbackLabel()}`);
        this.usingFallback = true;
      }
      return fallback.getClient();
    }

    // No fallback available — return primary client anyway (will fail at request time)
    return this.primary.getClient();
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    try {
      return await this.primary.listModels();
    } catch {
      const fb = await this.getFallback();
      if (fb) {
        return fb.listModels();
      }
      throw new Error('LMX unreachable and no cloud fallback configured');
    }
  }

  async health(): Promise<ProviderHealthResult> {
    const primary = await this.primary.health();
    if (primary.ok) return primary;

    const fb = await this.getFallback();
    if (fb) {
      const fallback = await fb.health();
      const label = this.fallbackLabel();
      return {
        ...fallback,
        error: fallback.ok
          ? `LMX down, using ${label} (${primary.error})`
          : `Both LMX and ${label} are unreachable`,
      };
    }

    return primary;
  }
}
