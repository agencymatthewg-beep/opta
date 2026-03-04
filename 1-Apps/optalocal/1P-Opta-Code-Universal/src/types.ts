export type {
  DaemonBackgroundListResponse,
  DaemonBackgroundOutputOptions,
  DaemonBackgroundOutputResponse,
  DaemonBackgroundStartRequest,
  DaemonBackgroundStatusResponse,
  DaemonConnectionOptions,
  DaemonLmxAvailableModel,
  DaemonLmxDiscoveryResponse,
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
  kind:
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | "event"
  | "permission"
  | "thinking";
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

export type SessionSubmitMode = "chat" | "do" | "plan" | "review" | "research";

export type SessionOutputFormat = "markdown" | "text" | "json";
export type SessionAutonomyMode = "execution" | "ceo";

export interface SessionTurnOverrides {
  model?: string;
  provider?: string;
  dangerous?: boolean;
  auto?: boolean;
  noCommit?: boolean;
  noCheckpoints?: boolean;
  format?: SessionOutputFormat;
  autonomyMode?: SessionAutonomyMode;
  autonomyLevel?: number;
}

/* ═══════════════════════════════════════════════════════
   V1 Design Types — Blended Modular Workspace
   ═══════════════════════════════════════════════════════ */

export interface OptaProject {
  id: string;
  name: string;
  color: string;
  icon?: string;
  rootPath?: string;
  createdAt: string;
  updatedAt: string;
  aiConfig: {
    systemPrompt?: string;
    preferredModel?: string;
    autonomyLevel?: 1 | 2 | 3 | 4 | 5;
    autonomyMode?: SessionAutonomyMode;
    temperature?: number;
  };
  notes: {
    id: string;
    title: string;
    body: string;
    pinned: boolean;
  }[];
  settings: {
    defaultWorkspace?: string;
    sessionRetention?: "all" | "recent-10" | "recent-30";
    autoCommit?: boolean;
  };
}

export type WidgetId =
  | "atpo"
  | "benchmark"
  | "runtime"
  | "next-steps"
  | "tool-log"
  | "plan-completion"
  | "cli-stream";

export type WidgetSize = "S" | "M" | "T";

export interface WidgetSlot {
  id: string;
  widgetId: WidgetId | null;
  size: WidgetSize;
}

export interface WidgetLayout {
  projectId: string;
  slots: WidgetSlot[];
}

export interface AgentBarItem {
  sessionId: string;
  sessionTitle: string;
  projectName?: string;
  state: "streaming" | "awaiting-review" | "blocked" | "completed";
  elapsedMs: number;
}
