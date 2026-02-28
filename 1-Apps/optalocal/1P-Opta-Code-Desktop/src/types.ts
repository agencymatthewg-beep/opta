export interface PaletteCommand {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  requiresQuery?: boolean;
  run: (query: string) => Promise<void> | void;
}

export interface DaemonConnectionOptions {
  host: string;
  port: number;
  token: string;
  protocol?: "http" | "https";
}

export interface DaemonSessionSummary {
  sessionId: string;
  title: string;
  workspace: string;
  updatedAt?: string;
}

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  args: Record<string, unknown>;
  sessionId: string;
}

export interface TimelineItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "system" | "event" | "permission" | "thinking";
  title: string;
  body?: string;
  createdAt?: string;
}

export interface RuntimeSnapshot {
  sessionCount: number;
  activeTurnCount: number;
  queuedTurnCount: number;
  subscriberCount: number;
}

export interface DaemonLmxModelDetail {
  model_id: string;
  status: string;
  memory_bytes?: number;
  context_length?: number;
  loaded_at?: string;
  request_count?: number;
}

export interface DaemonLmxStatusResponse {
  status: string;
  version?: string;
  uptime_seconds?: number;
  models: DaemonLmxModelDetail[];
}

export interface DaemonLmxMemoryResponse {
  total_unified_memory_gb: number;
  used_gb: number;
  available_gb: number;
  models: Record<string, { memory_gb: number; loaded: boolean }>;
}

export interface DaemonLmxAvailableModel {
  model_id: string;
  size_bytes?: number;
  quantization?: string;
  modified_at?: string;
}
