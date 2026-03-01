import type { LmxConnectionState } from './connection.js';
import { probeLmxConnection } from './connection.js';
import { discoverLmxHosts } from './mdns-discovery.js';

export interface LmxEndpointConfig {
  host: string;
  port: number;
  adminKey?: string;
  fallbackHosts?: string[];
  /** When true (default), scan the LAN for LMX servers if no primary is configured. */
  autoDiscover?: boolean;
}

export interface ResolvedLmxEndpoint {
  host: string;
  port: number;
  source: 'primary' | 'fallback';
  state: LmxConnectionState | 'unknown';
  /** Canonical WebSocket URL from server discovery, if available. */
  wsUrl?: string;
}

interface ResolveEndpointOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Delay before committing to a fallback host when primary is still in flight. */
  primaryGraceMs?: number;
}

const DEFAULT_PROBE_TIMEOUT_MS = 1_500;
const ENDPOINT_CACHE_TTL_MS = 30_000;
const DEFAULT_PRIMARY_GRACE_MS = 125;

interface CachedEndpoint {
  host: string;
  expiresAt: number;
}

const endpointCache = new Map<string, CachedEndpoint>();

interface ProbeOutcome {
  host: string;
  index: number;
  source: 'primary' | 'fallback';
  state: LmxConnectionState;
  completionOrder: number;
  wsUrl?: string;
}

function normalizeHost(host: string): string {
  return host.trim();
}

export function listCandidateHosts(config: Pick<LmxEndpointConfig, 'host' | 'fallbackHosts'>): string[] {
  const hosts = [config.host, ...(config.fallbackHosts ?? [])]
    .map(normalizeHost)
    .filter((host) => host.length > 0);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const host of hosts) {
    const key = host.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(host);
  }

  return deduped;
}

function makeCacheKey(port: number, hosts: readonly string[]): string {
  return `${port}|${hosts.map((host) => host.toLowerCase()).join(',')}`;
}

function cacheEndpoint(key: string, host: string): void {
  endpointCache.set(key, {
    host,
    expiresAt: Date.now() + ENDPOINT_CACHE_TTL_MS,
  });
}

export function clearLmxEndpointCache(): void {
  endpointCache.clear();
}

function makeAbortError(message: string): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

function selectEarliest(
  outcomes: Iterable<ProbeOutcome>,
  predicate: (outcome: ProbeOutcome) => boolean,
): ProbeOutcome | undefined {
  let selected: ProbeOutcome | undefined;
  for (const outcome of outcomes) {
    if (!predicate(outcome)) continue;
    if (!selected || outcome.completionOrder < selected.completionOrder) {
      selected = outcome;
    }
  }
  return selected;
}

export async function resolveLmxEndpoint(
  config: LmxEndpointConfig,
  options?: ResolveEndpointOptions,
): Promise<ResolvedLmxEndpoint> {
  if (options?.signal?.aborted) {
    throw makeAbortError('LMX endpoint resolution aborted');
  }

  let candidates = listCandidateHosts(config);
  const normalizedPrimary = normalizeHost(config.host);

  // Auto-discover LMX servers on the LAN when enabled and no explicit host is configured
  if (config.autoDiscover !== false && candidates.length === 0) {
    try {
      const discovered = await discoverLmxHosts(1500);
      const discoveredHosts = discovered.map((d) => d.host);
      // Rebuild candidates with discovered hosts prepended
      candidates = listCandidateHosts({
        host: discoveredHosts[0] ?? config.host,
        fallbackHosts: [...discoveredHosts.slice(1), ...(config.fallbackHosts ?? [])],
      });
    } catch { /* discovery is best-effort */ }
  }

  const primaryHost = candidates[0] ?? (normalizedPrimary.length > 0 ? normalizedPrimary : 'localhost');
  const cacheKey = makeCacheKey(config.port, candidates);

  const cached = endpointCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const stillPresent = candidates.some((host) => host.toLowerCase() === cached.host.toLowerCase());
    if (stillPresent) {
      return {
        host: cached.host,
        port: config.port,
        source: cached.host.toLowerCase() === primaryHost.toLowerCase() ? 'primary' : 'fallback',
        state: 'unknown',
      };
    }
  }

  if (candidates.length === 0) {
    return {
      host: primaryHost,
      port: config.port,
      source: 'primary',
      state: 'unknown',
    };
  }

  const timeoutMs = Math.max(250, options?.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
  const primaryGraceMs = Math.max(0, Math.min(timeoutMs, options?.primaryGraceMs ?? DEFAULT_PRIMARY_GRACE_MS));
  const primaryIndex = candidates.findIndex((host) => host.toLowerCase() === primaryHost.toLowerCase());
  const signal = options?.signal;

  return new Promise<ResolvedLmxEndpoint>((resolve, reject) => {
    let settled = false;
    let remaining = candidates.length;
    let completionOrder = 0;
    const outcomes = new Map<number, ProbeOutcome>();
    let pendingFallbackConnected: ProbeOutcome | undefined;
    let fallbackGraceTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (fallbackGraceTimer) {
        clearTimeout(fallbackGraceTimer);
        fallbackGraceTimer = undefined;
      }
      signal?.removeEventListener('abort', onAbort);
    };

    const settle = (endpoint: ResolvedLmxEndpoint) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (endpoint.state === 'connected' || endpoint.state === 'degraded') {
        cacheEndpoint(cacheKey, endpoint.host);
      }
      resolve(endpoint);
    };

    const settleUnknownPrimary = () => {
      settle({
        host: primaryHost,
        port: config.port,
        source: 'primary',
        state: 'unknown',
      });
    };

    const settleOutcome = (outcome: ProbeOutcome) => {
      settle({
        host: outcome.host,
        port: config.port,
        source: outcome.source,
        state: outcome.state,
        wsUrl: outcome.wsUrl,
      });
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(makeAbortError('LMX endpoint resolution aborted'));
    };

    const getPrimaryOutcome = () => (primaryIndex >= 0 ? outcomes.get(primaryIndex) : undefined);

    const finalizeIfAllDone = () => {
      if (settled || remaining > 0) return;

      const primaryOutcome = getPrimaryOutcome();
      if (primaryOutcome?.state === 'connected') {
        settleOutcome(primaryOutcome);
        return;
      }

      const fallbackConnected = selectEarliest(
        outcomes.values(),
        (outcome) => outcome.source === 'fallback' && outcome.state === 'connected',
      );
      if (fallbackConnected) {
        settleOutcome(fallbackConnected);
        return;
      }

      if (primaryOutcome?.state === 'degraded') {
        settleOutcome(primaryOutcome);
        return;
      }

      const fallbackDegraded = selectEarliest(
        outcomes.values(),
        (outcome) => outcome.source === 'fallback' && outcome.state === 'degraded',
      );
      if (fallbackDegraded) {
        settleOutcome(fallbackDegraded);
        return;
      }

      settleUnknownPrimary();
    };

    const armFallbackGraceTimer = () => {
      if (settled || fallbackGraceTimer || !pendingFallbackConnected) return;
      fallbackGraceTimer = setTimeout(() => {
        fallbackGraceTimer = undefined;
        if (settled) return;

        const primaryOutcome = getPrimaryOutcome();
        if (primaryOutcome?.state === 'connected') {
          settleOutcome(primaryOutcome);
          return;
        }

        if (pendingFallbackConnected) {
          settleOutcome(pendingFallbackConnected);
        }
      }, primaryGraceMs);
    };

    const handleOutcome = (outcome: ProbeOutcome) => {
      if (settled) return;

      outcomes.set(outcome.index, outcome);
      remaining -= 1;

      const primaryOutcome = getPrimaryOutcome();

      if (outcome.source === 'primary') {
        if (outcome.state === 'connected') {
          settleOutcome(outcome);
          return;
        }

        if (pendingFallbackConnected && (outcome.state === 'degraded' || outcome.state === 'disconnected')) {
          settleOutcome(pendingFallbackConnected);
          return;
        }
      } else if (outcome.state === 'connected') {
        if (
          !pendingFallbackConnected
          || outcome.completionOrder < pendingFallbackConnected.completionOrder
        ) {
          pendingFallbackConnected = outcome;
        }

        if (primaryOutcome) {
          if (primaryOutcome.state === 'connected') {
            settleOutcome(primaryOutcome);
            return;
          }

          if (primaryOutcome.state === 'degraded' || primaryOutcome.state === 'disconnected') {
            settleOutcome(pendingFallbackConnected);
            return;
          }
        } else {
          armFallbackGraceTimer();
        }
      }

      finalizeIfAllDone();
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }

    for (const [index, host] of candidates.entries()) {
      const source = host.toLowerCase() === primaryHost.toLowerCase() ? 'primary' : 'fallback';
      void probeLmxConnection(host, config.port, {
        timeoutMs,
        adminKey: config.adminKey,
      }).then((probe) => {
        handleOutcome({
          host,
          index,
          source,
          state: probe.state,
          completionOrder: completionOrder++,
          wsUrl: probe.discovery?.endpoints.websocket_url,
        });
      }).catch(() => {
        handleOutcome({
          host,
          index,
          source,
          state: 'disconnected',
          completionOrder: completionOrder++,
        });
      });
    }
  });
}
