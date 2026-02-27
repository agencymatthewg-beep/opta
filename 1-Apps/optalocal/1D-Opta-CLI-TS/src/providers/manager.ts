/**
 * Provider manager — factory for selecting the active LLM provider.
 *
 * Reads config.provider.active to determine which provider to use.
 * When fallbackOnFailure is enabled, wraps LMX in a FallbackProvider
 * that auto-degrades to Anthropic on connection failure.
 * Caches provider instances by config key to avoid re-creation.
 *
 * Zero-config fallback:
 * probeProvider() performs a fast LMX health check (≤2s) before the first
 * agent turn. If LMX is unreachable it silently returns an Anthropic provider.
 * This lets fresh installs work immediately when ANTHROPIC_API_KEY is set.
 */

import type { ProviderClient } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { resolveLmxApiKey } from '../lmx/api-key.js';
import { verbose } from '../core/debug.js';

let cachedProvider: ProviderClient | null = null;
let cachedProviderKey = '';

function providerCacheKey(config: OptaConfig): string {
  const active = config.provider?.active ?? 'lmx';
  const fallback = config.provider?.fallbackOnFailure ? '+fb' : '';
  if (active === 'lmx') {
    const fallbackHosts = (config.connection.fallbackHosts ?? [])
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0)
      .join(',');
    const apiKeyPrefix = resolveLmxApiKey(config.connection).slice(0, 8);
    return `lmx${fallback}|${config.connection.host}:${config.connection.port}|${fallbackHosts}|${apiKeyPrefix}`;
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

/**
 * Zero-config provider probe.
 *
 * Performs a fast health check against the configured LMX endpoint
 * (≤2 second timeout). If LMX is reachable, returns the normal LMX
 * provider. If LMX is unreachable or not configured:
 *
 *   - ANTHROPIC_API_KEY is set → silently returns an Anthropic provider
 *   - No ANTHROPIC_API_KEY     → throws a descriptive error
 *
 * In verbose mode (`--verbose`), logs which path was taken.
 *
 * This is the preferred entry-point for the chat startup path so that
 * first-run users with only an Anthropic key work out of the box.
 */
export async function probeProvider(config: OptaConfig): Promise<ProviderClient> {
  const active = config.provider?.active ?? 'lmx';

  // When the user has explicitly configured Anthropic, honour that.
  if (active === 'anthropic') {
    verbose('Provider probe: user configured Anthropic, skipping LMX probe');
    const { AnthropicProvider } = await import('./anthropic.js');
    return new AnthropicProvider(config);
  }

  // Probe LMX with a short timeout so we don't slow down normal usage.
  const PROBE_TIMEOUT_MS = 2_000;
  const host = config.connection.host;
  const port = config.connection.port;

  try {
    const { probeLmxConnection } = await import('../lmx/connection.js');
    const result = await probeLmxConnection(host, port, { timeoutMs: PROBE_TIMEOUT_MS });

    if (result.state !== 'disconnected') {
      verbose(`Provider probe: LMX reachable at ${host}:${port} (state=${result.state}, ${result.latencyMs}ms)`);
      // LMX is reachable — use the normal provider (with FallbackProvider if configured).
      return await getProvider(config);
    }

    verbose(`Provider probe: LMX unreachable at ${host}:${port} — ${result.reason ?? 'no response'}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    verbose(`Provider probe: LMX probe threw — ${msg}`);
  }

  // LMX is unreachable — check for Anthropic fallback.
  const anthropicKey = config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY'] || '';

  if (anthropicKey) {
    verbose('Provider probe: falling back to Anthropic (LMX unreachable, ANTHROPIC_API_KEY present)');
    const { AnthropicProvider } = await import('./anthropic.js');
    return new AnthropicProvider(config);
  }

  // No fallback available — throw a clear, actionable error.
  throw new Error(
    `LMX unreachable at ${host}:${port} and no ANTHROPIC_API_KEY set.\n\n` +
    'Fix options:\n' +
    '  1. Start LMX server:         opta lmx start\n' +
    '  2. Use Anthropic cloud:      export ANTHROPIC_API_KEY=sk-ant-...\n' +
    '  3. Configure a different host: opta config set connection.host <host>',
  );
}

/** Re-export types for convenience. */
export type { ProviderClient } from './base.js';
