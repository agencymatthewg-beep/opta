/**
 * Agent run API types (/v1/agents/runs)
 */

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentRunCreateRequest {
  /**
   * Native request payload used by LMX agents runtime.
   */
  request?: Record<string, unknown>;
  /**
   * Legacy single-agent identifier.
   */
  agent?: string;
  /**
   * Legacy structured input payload.
   */
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  object?: 'agent.run';
  id: string;
  status: AgentRunStatus;
  request?: Record<string, unknown>;
  steps?: Array<Record<string, unknown>>;
  result?: unknown;
  output?: unknown;
  error?: string | null;
  resolved_model?: string | null;
  created_at: number;
  updated_at: number;
}

export interface AgentRunListResponse {
  object?: 'list';
  data: AgentRun[];
  total: number;
}

export interface AgentRunListOptions {
  limit?: number;
  offset?: number;
  status?: AgentRunStatus;
}

export interface AgentRunEvent {
  event?: string;
  type: string;
  data?: Record<string, unknown> | string;
  id?: string;
  run_id?: string;
  created_at?: string | number;
}

export interface AgentRunEventsResponse {
  object?: 'list';
  events: AgentRunEvent[];
  run_id?: string;
}
