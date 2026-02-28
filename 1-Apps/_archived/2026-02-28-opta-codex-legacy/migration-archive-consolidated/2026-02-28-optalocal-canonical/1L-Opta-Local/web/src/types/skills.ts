/**
 * Skills API types (/v1/skills, /v1/skills/mcp/*, /mcp/*)
 */

export interface SkillDefinition {
  schema?: string;
  name: string;
  namespace?: string;
  version?: string;
  qualified_name?: string;
  reference?: string;
  description?: string;
  kind?: string;
  timeout_sec?: number;
  permission_tags?: string[];
  risk_tags?: string[];
  input_schema?: Record<string, unknown>;
}

export interface SkillsListResponse {
  object?: 'list';
  data?: SkillDefinition[];
  /**
   * Compatibility key for older local clients/tests.
   */
  skills?: SkillDefinition[];
  total?: number;
}

export interface SkillExecuteRequest {
  arguments?: object;
  approved?: boolean;
  timeout_sec?: number;
}

export interface SkillExecuteResponse {
  skill: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  duration_ms: number;
  timed_out?: boolean;
  denied?: boolean;
  requires_approval?: boolean;
}

export interface SkillsMcpResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface SkillsMcpListResponse {
  ok: boolean;
  resources: SkillsMcpResource[];
}

export interface SkillsMcpReadRequest {
  uri: string;
}

export interface SkillsMcpReadContent {
  uri: string;
  mimeType?: string;
  text: string;
}

export interface SkillsMcpReadResponse {
  ok: boolean;
  contents?: SkillsMcpReadContent[];
  error?: string;
}

export interface SkillsMcpCallRequest {
  name: string;
  arguments?: object;
  approved?: boolean;
}

export interface SkillsMcpCallResponse {
  skill_name: string;
  kind: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  duration_ms: number;
  timed_out?: boolean;
  denied?: boolean;
  requires_approval?: boolean;
}
