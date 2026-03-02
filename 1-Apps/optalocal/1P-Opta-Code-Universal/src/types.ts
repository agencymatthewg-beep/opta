export type {
  DaemonBackgroundListResponse,
  DaemonBackgroundOutputOptions,
  DaemonBackgroundOutputResponse,
  DaemonBackgroundStartRequest,
  DaemonBackgroundStatusResponse,
  DaemonConnectionOptions,
  DaemonLmxAvailableModel,
  DaemonLmxLoadOptions,
  DaemonLmxMemoryResponse,
  DaemonLmxModelDetail,
  DaemonLmxStatusResponse,
} from "@opta/daemon-client/types";

export interface PaletteCommand {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  requiresQuery?: boolean;
  run: (query: string) => Promise<void> | void;
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

export interface TurnStats {
  tokens: number;
  speed: number;
  elapsed: number;
  toolCalls: number;
}

export interface TimelineItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "system" | "event" | "permission" | "thinking";
  title: string;
  body?: string;
  createdAt?: string;
  /** Populated for kind=system turn.done events */
  stats?: TurnStats;
  /** True for tool.end cards to distinguish from tool.start */
  isToolResult?: boolean;
}

export interface RuntimeSnapshot {
  sessionCount: number;
  activeTurnCount: number;
  queuedTurnCount: number;
  subscriberCount: number;
}
