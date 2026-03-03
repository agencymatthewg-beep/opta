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
 * agent turn. If LMX is unreachable it returns the first available cloud
 * provider (Anthropic/Gemini/OpenAI/Opencode Zen) using configured keys.
 */

import type { ProviderClient } from './base.js';
import type { OptaConfig } from '../core/config.js';
import { resolveLmxApiKey } from '../lmx/api-key.js';
import { verbose } from '../core/debug.js';
import { errorMessage } from '../utils/errors.js';
import { instantiateOrInvoke } from '../utils/newable.js';

let cachedProvider: ProviderClient | null = null;
let cachedProviderKey = '';

function providerCacheKey(config: OptaConfig): string {
  const active = config.provider.active;
  const fallback = config.provider.fallbackOnFailure ? '+fb' : '';
  if (active === 'lmx') {
    const fallbackHosts = config.connection.fallbackHosts
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0)
      .join(',');
    const apiKeyPrefix = resolveLmxApiKey(config.connection).slice(0, 8);
    return `lmx${fallback}|${config.connection.host}:${config.connection.port}|${fallbackHosts}|${apiKeyPrefix}`;
  }
  let apiKey = '';
  if (active === 'anthropic') apiKey = config.provider.anthropic.apiKey || process.env['ANTHROPIC_API_KEY'] || '';
  if (active === 'gemini') apiKey = config.provider.gemini.apiKey || process.env['GEMINI_API_KEY'] || '';
  if (active === 'openai') apiKey = config.provider.openai.apiKey || process.env['OPENAI_API_KEY'] || '';
  if (active === 'opencode_zen') apiKey = config.provider.opencode_zen.apiKey || process.env['OPENCODE_ZEN_API_KEY'] || '';
  
  return `${active}|${apiKey.slice(0, 8)}`;
}

export async function getProvider(config: OptaConfig): Promise<ProviderClient> {
  const key = providerCacheKey(config);
  if (cachedProvider && cachedProviderKey === key) {
    return cachedProvider;
  }

  const active = config.provider.active;

  if (active === 'anthropic') {
    const { AnthropicProvider } = await import('./anthropic.js');
    cachedProvider = instantiateOrInvoke<ProviderClient>(AnthropicProvider, config);
  } else if (active === 'gemini' || active === 'openai' || active === 'opencode_zen') {
    const { CloudProvider } = await import('./cloud.js');
    cachedProvider = instantiateOrInvoke<ProviderClient>(CloudProvider, active, config);
  } else {
    const { LmxProvider } = await import('./lmx.js');
    const lmx = instantiateOrInvoke<ProviderClient>(LmxProvider, config);

    if (config.provider.fallbackOnFailure) {
      const { FallbackProvider } = await import('./fallback.js');
      cachedProvider = instantiateOrInvoke<ProviderClient>(FallbackProvider, lmx, config);
    } else {
      cachedProvider = lmx;
    }
  }

  cachedProviderKey = key;
  if (!cachedProvider) throw new Error('Failed to initialize provider');
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
  const active = config.provider.active;

  // When the user has explicitly configured a cloud provider, honour that.
  if (active !== 'lmx') {
    const providerLabel = active;
    verbose(`Provider probe: user configured ${providerLabel}, skipping LMX probe`);
    if (active === 'anthropic') {
      const { AnthropicProvider } = await import('./anthropic.js');
      return instantiateOrInvoke<ProviderClient>(AnthropicProvider, config);
    }

    const { CloudProvider } = await import('./cloud.js');
    return instantiateOrInvoke<ProviderClient>(CloudProvider, active, config);
  }

  // Probe LMX with a short timeout budget so startup stays responsive.
  // We check the primary host first, then any configured fallbacks.
  const PROBE_TIMEOUT_BUDGET_MS = 2_000;
  const primaryHost = config.connection.host;
  const port = config.connection.port;
  const probeTargets = [primaryHost, ...config.connection.fallbackHosts]
    .map((host) => host.trim())
    .filter((host) => host.length > 0)
    .filter((host, index, list) => list.findIndex((item) => item.toLowerCase() === host.toLowerCase()) === index);

  const attemptedEndpoints: string[] = [];
  const probeFailures: string[] = [];
  const deadline = Date.now() + PROBE_TIMEOUT_BUDGET_MS;

  for (let index = 0; index < probeTargets.length; index += 1) {
    const host = probeTargets[index];
    if (!host) continue;
    const remainingTargets = probeTargets.length - index;
    const remainingBudgetMs = Math.max(250, deadline - Date.now());
    const timeoutMs =
      probeTargets.length === 1
        ? PROBE_TIMEOUT_BUDGET_MS
        : Math.max(250, Math.floor(remainingBudgetMs / remainingTargets));
    attemptedEndpoints.push(`${host}:${port}`);

    try {
      const { probeLmxConnection } = await import('../lmx/connection.js');
      const result = await probeLmxConnection(host, port, { timeoutMs });

      if (result.state !== 'disconnected') {
        verbose(
          `Provider probe: LMX reachable at ${host}:${port} ` +
            `(state=${result.state}, ${result.latencyMs}ms)`
        );
        // LMX is reachable — use the normal provider (with FallbackProvider if configured).
        return await getProvider(config);
      }

      const reason = result.reason ?? 'no response';
      probeFailures.push(`${host}:${port} (${reason})`);
      verbose(`Provider probe: LMX unreachable at ${host}:${port} — ${reason}`);
    } catch (err) {
      const reason = errorMessage(err);
      probeFailures.push(`${host}:${port} (${reason})`);
      verbose(`Provider probe: LMX probe threw for ${host}:${port} — ${reason}`);
    }
  }

  // LMX is unreachable — check cloud fallback keys in preference order.
  const cloudCandidates: Array<{ provider: 'anthropic' | 'gemini' | 'openai' | 'opencode_zen'; envVar: string }> = [
    { provider: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
    { provider: 'gemini', envVar: 'GEMINI_API_KEY' },
    { provider: 'openai', envVar: 'OPENAI_API_KEY' },
    { provider: 'opencode_zen', envVar: 'OPENCODE_ZEN_API_KEY' },
  ];

  for (const candidate of cloudCandidates) {
    let configured = false;
    if (candidate.provider === 'anthropic') {
      configured = !!(config.provider.anthropic.apiKey || process.env[candidate.envVar]);
    } else if (candidate.provider === 'gemini') {
      configured = !!(config.provider.gemini.apiKey || process.env[candidate.envVar]);
    } else if (candidate.provider === 'openai') {
      configured = !!(config.provider.openai.apiKey || process.env[candidate.envVar]);
    } else if (candidate.provider === 'opencode_zen') {
      configured = !!(config.provider.opencode_zen.apiKey || process.env[candidate.envVar]);
    }

    if (configured) {
      verbose(
        `Provider probe: falling back to ${candidate.provider} (LMX unreachable, key available)`
      );
      const { CloudProvider } = await import('./cloud.js');
      return instantiateOrInvoke<ProviderClient>(CloudProvider, candidate.provider, config);
    }
  }

  // No fallback available — throw machine-readable remediation metadata.
  const attemptedSummary =
    attemptedEndpoints.length > 0 ? attemptedEndpoints.join(', ') : `${primaryHost}:${port}`;
  throw new Error(
    JSON.stringify({
      code: 'lmx_unreachable',
      attemptedEndpoints,
      attemptedSummary,
      probeFailures,
      autoActions: ['discover_hosts', 'try_fallback', 'launch_onboarding'],
      humanHint: 'Run opta onboard to repair connection automatically.',
      noCloudFallbackConfigured: true,
      cloudFallbackEnvVar: ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENCODE_ZEN_API_KEY'],
      target: `${primaryHost}:${port}`,
      fallbackHostsConfigured: probeTargets.length > 1,
    })
  );
}

/** Re-export types for convenience. */
export type { ProviderClient } from './base.js';
