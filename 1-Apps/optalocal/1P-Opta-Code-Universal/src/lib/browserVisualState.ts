import type { PermissionRequest, TimelineItem } from "../types";

export type BrowserConnectionState =
  | "connected"
  | "connecting"
  | "disconnected";

export type BrowserVisualState =
  | "idle"
  | "active"
  | "working"
  | "blocked"
  | "offline";

export interface BrowserVisualSummary {
  state: BrowserVisualState;
  activityText: string;
  browserEventCount: number;
  pendingPermissionCount: number;
}

interface DeriveBrowserVisualStateInput {
  connectionState: BrowserConnectionState;
  isStreaming: boolean;
  pendingPermissions: PermissionRequest[];
  timelineItems: TimelineItem[];
}

const BROWSER_TOOL_PATTERN = /(^|[^a-z0-9])browser_[a-z0-9_]+/i;

export function isBrowserToolName(name: string | null | undefined): boolean {
  if (!name) return false;
  return BROWSER_TOOL_PATTERN.test(name);
}

export function getBrowserActivityText(state: BrowserVisualState): string {
  if (state === "working") return "working";
  if (state === "blocked") return "awaiting permission";
  if (state === "active") return "active";
  if (state === "offline") return "offline";
  return "idle";
}

export function getBrowserVisualShortLabel(state: BrowserVisualState): string {
  if (state === "working") return "working";
  if (state === "blocked") return "blocked";
  if (state === "active") return "active";
  if (state === "offline") return "offline";
  return "idle";
}

export function deriveBrowserVisualState({
  connectionState,
  isStreaming,
  pendingPermissions,
  timelineItems,
}: DeriveBrowserVisualStateInput): BrowserVisualSummary {
  const browserEventCount = timelineItems.filter(
    (item) => item.kind === "tool" && isBrowserToolName(item.title),
  ).length;
  const pendingPermissionCount = pendingPermissions.filter((request) =>
    isBrowserToolName(request.toolName),
  ).length;

  let state: BrowserVisualState = "idle";
  if (connectionState !== "connected") {
    state = "offline";
  } else if (pendingPermissionCount > 0) {
    state = "blocked";
  } else if (isStreaming && browserEventCount > 0) {
    state = "working";
  } else if (browserEventCount > 0) {
    state = "active";
  }

  return {
    state,
    activityText: getBrowserActivityText(state),
    browserEventCount,
    pendingPermissionCount,
  };
}
