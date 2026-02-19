/**
 * Opta Cloud Sync Types
 *
 * TypeScript interfaces matching the Supabase cloud_sync schema.
 * Used by the sync engine, device manager, and session cloud backup.
 *
 * @see supabase/migrations/001_cloud_sync.sql
 */

// ---------------------------------------------------------------------------
// Device Types
// ---------------------------------------------------------------------------

/** Device roles in the Opta ecosystem */
export type DeviceRole = 'llm_host' | 'workstation';

/** Helper node configuration for LLM inference delegation */
export interface HelperConfig {
  endpoint_url: string;
  models: string[];
  max_vram_gb: number;
}

/** Device capabilities reported via heartbeat */
export interface DeviceCapabilities {
  models_loaded: string[];
  vram_gb: number;
  vram_total_gb: number;
  os?: string;
  arch?: string;
}

/** A registered device in the Opta ecosystem */
export interface Device {
  id: string;
  user_id: string;
  name: string;
  role: DeviceRole;
  helper_enabled: boolean;
  helper_config: HelperConfig | null;
  hostname: string | null;
  lan_ip: string | null;
  lan_port: number;
  tunnel_url: string | null;
  capabilities: DeviceCapabilities | null;
  last_seen_at: string;
  /** Set by application logic based on last_seen_at freshness (within 2 minutes) */
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Session Types
// ---------------------------------------------------------------------------

/** Cloud-synced session metadata */
export interface CloudSession {
  id: string;
  user_id: string;
  device_id: string | null;
  title: string;
  model: string;
  message_count: number;
  token_count: number;
  /** Source session UUID if this session was branched */
  parent_id: string | null;
  /** Message index in the parent session where branching occurred */
  branch_point: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Message Types
// ---------------------------------------------------------------------------

/** Valid message roles */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Token usage breakdown for assistant messages */
export interface TokenUsage {
  prompt: number;
  completion: number;
}

/** Cloud-synced message within a session */
export interface CloudMessage {
  /** Deterministic ID: {session_id}-msg-{index} */
  id: string;
  session_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  tool_calls: unknown[] | null;
  token_usage: TokenUsage | null;
  created_at: string;
  index: number;
}

// ---------------------------------------------------------------------------
// Supabase Database Type Map
// ---------------------------------------------------------------------------

/**
 * Typed Supabase client schema for the public tables.
 *
 * Usage with @supabase/supabase-js:
 * ```ts
 * import { createClient } from '@supabase/supabase-js';
 * import type { Database } from '@/types/cloud';
 *
 * const supabase = createClient<Database>(url, key);
 * const { data } = await supabase.from('devices').select('*');
 * // data is Device[] | null
 * ```
 */
export interface Database {
  public: {
    Tables: {
      devices: {
        Row: Device;
        Insert: Omit<Device, 'id' | 'created_at' | 'updated_at' | 'last_seen_at' | 'is_online'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          is_online?: boolean;
        };
        Update: Partial<
          Omit<Device, 'id' | 'created_at'> & {
            updated_at?: string;
          }
        >;
      };
      cloud_sessions: {
        Row: CloudSession;
        Insert: Omit<CloudSession, 'created_at' | 'updated_at' | 'message_count' | 'token_count'> & {
          created_at?: string;
          updated_at?: string;
          message_count?: number;
          token_count?: number;
        };
        Update: Partial<
          Omit<CloudSession, 'id' | 'user_id' | 'created_at'> & {
            updated_at?: string;
          }
        >;
      };
      cloud_messages: {
        Row: CloudMessage;
        Insert: Omit<CloudMessage, 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Omit<CloudMessage, 'id' | 'session_id' | 'user_id' | 'created_at'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      device_role: DeviceRole;
      message_role: MessageRole;
    };
  };
}
