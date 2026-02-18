/**
 * Provider manager — factory for selecting the active LLM provider.
 *
 * Reads config.provider.active to determine which provider to use.
 * When fallbackOnFailure is enabled, wraps LMX in a FallbackProvider
 * that auto-degrades to Anthropic on connection failure.
 * Caches provider instances by config key to avoid re-creation.
 */

import type { ProviderClient } from './base.js';
import type { OptaConfig } from '../core/config.js';

let cachedProvider: ProviderClient | null = null;
let cachedProviderKey = '';

function providerCacheKey(config: OptaConfig): string {
  const active = config.provider?.active ?? 'lmx';
  const fallback = config.provider?.fallbackOnFailure ? '+fb' : '';
  if (active === 'lmx') {
    return `lmx${fallback}|${config.connection.host}:${config.connection.port}`;
  }
  const apiKey = config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY'] || '';
  return `anthropic|${apiKey.slice(0, 8)}`;
}

export async function getProvider(config: OptaConfig): Promise<ProviderClient> {
  const key = providerCacheKey(config);
  if (cachedProvider && cachedProviderKey === key) {
    return cachedProvider;
  }

  const active = config.provider?.active ?? 'lmx';

  if (active === 'anthropic') {
    const { AnthropicProvider } = await import('./anthropic.js');
    cachedProvider = new AnthropicProvider(config);
  } else {
    const { LmxProvider } = await import('./lmx.js');
    const lmx = new LmxProvider(config);

    if (config.provider?.fallbackOnFailure) {
      const { FallbackProvider } = await import('./fallback.js');
      cachedProvider = new FallbackProvider(lmx, config);
    } else {
      cachedProvider = lmx;
    }
  }

  cachedProviderKey = key;
  return cachedProvider;
}

/** Reset the cached provider (useful for testing or config reload). */
export function resetProviderCache(): void {
  cachedProvider = null;
  cachedProviderKey = '';
}

/** Re-export types for convenience. */
export type { ProviderClient } from './base.js';
