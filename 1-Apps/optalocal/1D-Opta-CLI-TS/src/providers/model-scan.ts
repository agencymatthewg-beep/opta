/**
 * Shared model scanning service.
 *
 * Extracts the duplicated model discovery logic from commands/models.ts
 * and commands/slash/lmx.ts into a single, reusable service.
 */

import { LmxClient } from '../lmx/client.js';
import type {
  LmxModelDetail,
  LmxAvailableModel,
  LmxPreset,
  LmxStackRole,
  LmxMemoryResponse,
  LmxRequestOptions,
} from '../lmx/client.js';
import type { ProviderModelInfo } from './base.js';
import type { OptaConfig } from '../core/config.js';

// --- Scan Result ---

export interface ScanResult {
  loaded: LmxModelDetail[];
  available: LmxAvailableModel[];
  presets: LmxPreset[];
  roles: Record<string, LmxStackRole>;
  memory: LmxMemoryResponse | null;
  cloud: ProviderModelInfo[];
  cloudHealthy: boolean;
  lmxReachable: boolean;
}

const FAST_SCAN_REQUEST_OPTS: LmxRequestOptions = {
  timeoutMs: 5_000,
  maxRetries: 0,
};

// --- Formatting Helpers ---

export function shortId(id: string): string {
  return id
    .replace(/^mlx-community\//, '')
    .replace(/^huggingface\//, '');
}

export function fmtGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)}GB`;
}

export function fmtCtx(tokens: number): string {
  return `${(tokens / 1000).toFixed(0)}K ctx`;
}

// --- Role Lookup ---

/**
 * Build a map from model_id to the stack role names assigned to it.
 */
export function buildRoleMap(roles: Record<string, LmxStackRole>): Map<string, string[]> {
  const roleMap = new Map<string, string[]>();
  for (const [role, info] of Object.entries(roles)) {
    if (info.resolved_model) {
      const existing = roleMap.get(info.resolved_model) ?? [];
      existing.push(role);
      roleMap.set(info.resolved_model, existing);
    }
  }
  return roleMap;
}

// --- Core Scan Function ---

/**
 * Gather model data from LMX server and cloud providers in parallel.
 * Both the CLI `opta models scan` command and the `/scan` slash command
 * should call this instead of duplicating the query logic.
 */
export async function scanModels(config: OptaConfig): Promise<ScanResult> {
  const { host, port } = config.connection;
  const client = new LmxClient({
    host,
    fallbackHosts: config.connection.fallbackHosts,
    port,
    adminKey: config.connection.adminKey,
  });

  const result: ScanResult = {
    loaded: [],
    available: [],
    presets: [],
    roles: {},
    memory: null,
    cloud: [],
    cloudHealthy: false,
    lmxReachable: false,
  };

  // Query LMX endpoints in parallel (all may fail if LMX is down)
  const lmxPromises = Promise.all([
    client.models(FAST_SCAN_REQUEST_OPTS).catch(() => null),
    client.available(FAST_SCAN_REQUEST_OPTS).catch(() => null),
    client.presets(FAST_SCAN_REQUEST_OPTS).catch(() => null),
    client.stack(FAST_SCAN_REQUEST_OPTS).catch(() => null),
    client.memory(FAST_SCAN_REQUEST_OPTS).catch(() => null),
  ]);

  // Query Anthropic provider in parallel with LMX
  const anthropicPromise = (async () => {
    if (config.provider?.active === 'anthropic' || config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY']) {
      try {
        const { getProvider } = await import('./manager.js');
        const anthropicConfig = { ...config, provider: { ...config.provider, active: 'anthropic' as const } };
        const provider = await getProvider(anthropicConfig);
        const models = await provider.listModels();
        const health = await provider.health();
        return { models, healthy: health.ok };
      } catch {
        return { models: [] as ProviderModelInfo[], healthy: false };
      }
    }
    return { models: [] as ProviderModelInfo[], healthy: false };
  })();

  const [lmxResults, anthropicResult] = await Promise.all([lmxPromises, anthropicPromise]);
  const [modelsRes, availRes, presetsRes, stackRes, memRes] = lmxResults;

  if (modelsRes) {
    result.loaded = modelsRes.models;
    result.lmxReachable = true;
  }
  if (availRes) {
    result.available = availRes;
    result.lmxReachable = true;
  }
  if (presetsRes) {
    result.presets = presetsRes.presets;
  }
  if (stackRes) {
    result.roles = stackRes.roles;
  }
  if (memRes) {
    result.memory = memRes;
  }

  result.cloud = anthropicResult.models;
  result.cloudHealthy = anthropicResult.healthy;

  return result;
}

// --- Scan Summary ---

export interface ScanSummary {
  loadedCount: number;
  onDiskCount: number;
  presetCount: number;
  cloudCount: number;
}

/**
 * Compute summary counts from a scan result.
 */
export function summarizeScan(scan: ScanResult): ScanSummary {
  const loadedIds = new Set(scan.loaded.map(m => m.model_id));
  return {
    loadedCount: scan.loaded.length,
    onDiskCount: scan.available.filter(a => !loadedIds.has(a.repo_id)).length,
    presetCount: scan.presets.length,
    cloudCount: scan.cloud.length,
  };
}
