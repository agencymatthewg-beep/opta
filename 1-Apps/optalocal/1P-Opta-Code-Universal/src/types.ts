import type { ActivationState } from "@opta/protocol-shared";

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
  activationState?: ActivationState;
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
  | "cli-stream"
  | "git-diff"
  // Widget System v2 — status & utility tiles
  | "lmx-status"
  | "context-bar"
  | "active-tool"
  | "session-memory"
  | "model-switcher"
  | "latency-sparkline"
  | "daemon-ring"
  | "command-bar"
  | "working-dir"
  | "browser-session";

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

/* ═══════════════════════════════════════════════════════
   Domain Types — Session Manager
   ═══════════════════════════════════════════════════════ */

export interface SessionDetail extends DaemonSessionSummary {
  messageCount?: number;
  model?: string;
  tags?: string[];
  sizeBytes?: number;
}

export interface SessionSearchResult {
  sessions: SessionDetail[];
  total: number;
  query?: string;
}

export interface SessionExportResult {
  sessionId: string;
  path: string;
  format: "json" | "markdown" | "text";
  sizeBytes?: number;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Environment Profiles
   ═══════════════════════════════════════════════════════ */

export interface EnvProfile {
  name: string;
  vars: Record<string, string>;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnvProfilesState {
  profiles: EnvProfile[];
  activeProfile: string | null;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Daemon Control
   ═══════════════════════════════════════════════════════ */

export type DaemonProcessState = "running" | "stopped" | "starting" | "stopping" | "unknown";

export interface DaemonControlStatus {
  state: DaemonProcessState;
  pid?: number;
  uptime?: number;
  version?: string;
  port?: number;
  logPath?: string;
  installedAs?: "launchd" | "systemd" | "schtasks" | "manual" | null;
}

export interface DaemonLogEntry {
  timestamp?: string;
  level?: "info" | "warn" | "error" | "debug";
  message: string;
  raw: string;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — System Info
   ═══════════════════════════════════════════════════════ */

export type DoctorCheckStatus = "pass" | "warn" | "fail" | "skip";

export interface DoctorCheck {
  name: string;
  status: DoctorCheckStatus;
  message?: string;
  fix?: string;
}

export interface SystemInfo {
  currentVersion: string;
  latestVersion: string | null;
  upToDate: boolean | null;
  updateAvailable: boolean | null;
  checks: DoctorCheck[];
  doctorSummary: {
    passed: number;
    warnings: number;
    failures: number;
  };
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Model Aliases
   ═══════════════════════════════════════════════════════ */

export interface ModelAlias {
  alias: string;
  target: string;
  provider?: string;
  description?: string;
}

export interface ModelHealthCheck {
  modelId: string;
  status: "healthy" | "degraded" | "unavailable";
  latencyMs?: number;
  error?: string;
}

export interface ModelLibraryEntry {
  repoId: string;
  name: string;
  description?: string;
  tags?: string[];
  sizeBytes?: number;
  sizeHuman?: string;
  quantization?: string;
  downloads?: number;
  isLocal?: boolean;
  isLoaded?: boolean;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Audio
   ═══════════════════════════════════════════════════════ */

export interface AudioTranscribeResult {
  text: string;
  language?: string;
  durationMs?: number;
  confidence?: number;
}

export interface AudioTtsResult {
  audioPath?: string;
  audioUrl?: string;
  durationMs?: number;
  format?: string;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Browser Runtime
   ═══════════════════════════════════════════════════════ */

export interface BrowserRuntimeSlot {
  slotId: string;
  state: "idle" | "active" | "closing";
  url?: string;
  title?: string;
  createdAt?: string;
}

export interface BrowserRuntimeStatus {
  enabled: boolean;
  slots: BrowserRuntimeSlot[];
  activeSessions: number;
  maxSessions: number;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Account & Vault
   ═══════════════════════════════════════════════════════ */

export interface AccountStatus {
  loggedIn: boolean;
  email?: string;
  userId?: string;
  tier?: string;
  plan?: string;
}

export type VaultSyncStatus = "synced" | "behind" | "ahead" | "conflict" | "offline" | "unknown";

export interface VaultStatus {
  syncStatus: VaultSyncStatus;
  keyCount: number;
  ruleCount: number;
  lastSync?: string;
  remoteVersion?: number;
  localVersion?: number;
}

export type KeychainProvider = "anthropic" | "lmx" | "gemini" | "openai" | "opencode-zen";

export interface KeychainStatus {
  providers: Record<KeychainProvider, { stored: boolean; lastSet?: string }>;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Connection Discovery
   ═══════════════════════════════════════════════════════ */

export interface LanDiscoveryTarget {
  host: string;
  port: number;
  name?: string;
  source: "mdns" | "scan" | "manual";
  reachable?: boolean;
  latencyMs?: number;
  daemonVersion?: string;
}

/* ═══════════════════════════════════════════════════════
   Domain Types — Async Operation Result
   ═══════════════════════════════════════════════════════ */

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
}
