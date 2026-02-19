export interface Bot {
  id: string;
  name: string;
  host: string;
  port: number;
  token: string;
  accentColor: string;
  connectionMethod: "lan" | "manual" | "tunnel";
  isEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  botId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  thinkingContent?: string;
  isStreaming: boolean;
  replyToId?: string;
  reactions?: Record<string, boolean>;
  isPinned?: boolean;
}

export interface CronJob {
  id: string;
  name?: string;
  schedule: string;
  payload: string;
  sessionTarget?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface BotConfig {
  model?: string;
  systemPrompt?: string;
  skills?: string[];
  thinking?: string;
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export interface GatewayFrame {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  data?: unknown;
  error?: string;
  event?: string;
}

export interface BotHealth {
  botId: string;
  botName: string;
  latencyMs: number;
  uptime: number;
  messageCount: number;
  status: ConnectionStatus;
  lastPing?: Date;
}
