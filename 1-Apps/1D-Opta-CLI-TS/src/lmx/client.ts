import { debug } from '../core/debug.js';
import type { z } from 'zod';

// --- Public Response Types (what commands consume) ---

export interface LmxHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version?: string;
  uptime_seconds?: number;
}

export interface LmxModelDetail {
  model_id: string;
  status: 'loaded' | 'loading' | 'unloading';
  memory_bytes?: number;
  context_length?: number;
  is_default?: boolean;
  loaded_at?: string;
  request_count?: number;
}

export interface LmxStatusResponse {
  status: string;
  version?: string;
  uptime_seconds?: number;
  models: LmxModelDetail[];
  memory?: {
    used_bytes: number;
    total_bytes: number;
    threshold: number;
  };
}

export interface LmxModelsResponse {
  models: LmxModelDetail[];
}

export interface LmxLoadResponse {
  model_id: string;
  status: 'loaded';
  memory_bytes?: number;
  load_time_seconds?: number;
}

export interface LmxUnloadResponse {
  model_id: string;
  status: 'unloaded';
  freed_bytes?: number;
}

// --- Raw LMX Server Response Types (what the API actually returns) ---

interface RawAdminModelDetail {
  id: string;
  loaded: boolean;
  memory_gb: number;
  loaded_at: number;
  use_batching: boolean;
  request_count: number;
  last_used_at: number;
  context_length?: number | null;
}

interface RawAdminModelsResponse {
  loaded: RawAdminModelDetail[];
  count: number;
}

interface RawAdminStatusResponse {
  version: string;
  uptime_seconds: number;
  loaded_models: number;
  models: string[];
  memory: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    usage_percent: number;
    threshold_percent: number;
  };
}

interface RawAdminLoadResponse {
  success: boolean;
  model_id: string;
  memory_after_load_gb?: number;
  time_to_load_ms?: number;
}

interface RawAdminUnloadResponse {
  success: boolean;
  model_id: string;
  memory_freed_gb?: number;
}

// --- Context Limit Lookup ---

const CONTEXT_LIMIT_TABLE: Record<string, number> = {
  'glm-4.7-flash': 128_000,
  'qwen2.5-72b': 32_768,
  'step-3.5-flash': 32_768,
  'qwq-32b': 32_768,
  'deepseek-r1-distill': 32_768,
  'wizardlm': 4_096,
  'gemma-3-4b': 8_192,
};

export function lookupContextLimit(modelId: string): number {
  const lower = modelId.toLowerCase();
  for (const [pattern, limit] of Object.entries(CONTEXT_LIMIT_TABLE)) {
    if (lower.includes(pattern)) return limit;
  }
  return 32_768;
}

const GB_TO_BYTES = 1e9;

// --- LMX Admin Client ---

export class LmxClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(opts: { host: string; port: number; adminKey?: string }) {
    this.baseUrl = `http://${opts.host}:${opts.port}`;
    this.headers = { 'Content-Type': 'application/json' };
    if (opts.adminKey) {
      this.headers['X-Admin-Key'] = opts.adminKey;
    }
  }

  private async fetch<T>(path: string, init?: RequestInit, validator?: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    debug(`LMX ${init?.method ?? 'GET'} ${url}`);

    const response = await fetch(url, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`LMX ${response.status}: ${body || response.statusText}`);
    }

    const data: unknown = await response.json();
    if (validator) return validator.parse(data);
    return data as T;
  }

  async health(): Promise<LmxHealthResponse> {
    return this.fetch<LmxHealthResponse>('/admin/health');
  }

  async status(): Promise<LmxStatusResponse> {
    const raw = await this.fetch<RawAdminStatusResponse>('/admin/status');
    return {
      status: 'ok',
      version: raw.version,
      uptime_seconds: raw.uptime_seconds,
      models: raw.models.map((id) => ({
        model_id: id,
        status: 'loaded' as const,
      })),
      memory: raw.memory
        ? {
            used_bytes: raw.memory.used_gb * GB_TO_BYTES,
            total_bytes: raw.memory.total_gb * GB_TO_BYTES,
            threshold: raw.memory.threshold_percent,
          }
        : undefined,
    };
  }

  async models(): Promise<LmxModelsResponse> {
    const raw = await this.fetch<RawAdminModelsResponse>('/admin/models');
    return {
      models: raw.loaded.map((m) => ({
        model_id: m.id,
        status: 'loaded' as const,
        memory_bytes: m.memory_gb ? m.memory_gb * GB_TO_BYTES : undefined,
        context_length: m.context_length ?? lookupContextLimit(m.id),
        loaded_at: m.loaded_at ? new Date(m.loaded_at * 1000).toISOString() : undefined,
        request_count: m.request_count,
      })),
    };
  }

  async loadModel(modelId: string): Promise<LmxLoadResponse> {
    const raw = await this.fetch<RawAdminLoadResponse>('/admin/models/load', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
    return {
      model_id: raw.model_id,
      status: 'loaded',
      memory_bytes: raw.memory_after_load_gb
        ? raw.memory_after_load_gb * GB_TO_BYTES
        : undefined,
      load_time_seconds: raw.time_to_load_ms
        ? raw.time_to_load_ms / 1000
        : undefined,
    };
  }

  async unloadModel(modelId: string): Promise<LmxUnloadResponse> {
    const raw = await this.fetch<RawAdminUnloadResponse>('/admin/models/unload', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
    return {
      model_id: raw.model_id,
      status: 'unloaded',
      freed_bytes: raw.memory_freed_gb
        ? raw.memory_freed_gb * GB_TO_BYTES
        : undefined,
    };
  }
}
