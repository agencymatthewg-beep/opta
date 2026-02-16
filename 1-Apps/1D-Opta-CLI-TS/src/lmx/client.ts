import { debug } from '../core/debug.js';

// --- Response Types ---

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

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
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

    return response.json() as Promise<T>;
  }

  async health(): Promise<LmxHealthResponse> {
    return this.fetch<LmxHealthResponse>('/admin/health');
  }

  async status(): Promise<LmxStatusResponse> {
    return this.fetch<LmxStatusResponse>('/admin/status');
  }

  async models(): Promise<LmxModelsResponse> {
    return this.fetch<LmxModelsResponse>('/admin/models');
  }

  async loadModel(modelId: string): Promise<LmxLoadResponse> {
    return this.fetch<LmxLoadResponse>('/admin/models/load', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
  }

  async unloadModel(modelId: string): Promise<LmxUnloadResponse> {
    return this.fetch<LmxUnloadResponse>('/admin/models/unload', {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId }),
    });
  }
}
