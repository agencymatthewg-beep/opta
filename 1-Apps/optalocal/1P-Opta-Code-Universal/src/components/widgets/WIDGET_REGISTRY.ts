// src/components/widgets/WIDGET_REGISTRY.ts
import type { WidgetId } from "../../types";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  accentVar: string;
  group: "ai" | "system" | "project";
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  // Existing
  { id: "atpo", label: "Plan Progress", description: "Active plan phases and steps", accentVar: "--opta-neon-pink", group: "ai" },
  { id: "cli-stream", label: "CLI Logs", description: "Live daemon event stream", accentVar: "--opta-neon-cyan", group: "system" },
  { id: "git-diff", label: "Git Diff", description: "Uncommitted file changes", accentVar: "--opta-neon-amber", group: "project" },
  // v2 — Quick Wins
  { id: "lmx-status", label: "AI Server", description: "Connection status and loaded model", accentVar: "--opta-neon-cyan", group: "system" },
  { id: "context-bar", label: "Context", description: "Token usage vs context limit", accentVar: "--opta-primary", group: "ai" },
  { id: "active-tool", label: "Active Tool", description: "Current tool being executed", accentVar: "--opta-neon-green", group: "ai" },
  // v2 — Worth Exploring
  { id: "session-memory", label: "Session Stats", description: "Turn count, tokens, compaction history", accentVar: "--opta-primary", group: "ai" },
  { id: "model-switcher", label: "Switch Model", description: "Quick-select from loaded LMX models", accentVar: "--opta-neon-cyan", group: "ai" },
  { id: "latency-sparkline", label: "Speed", description: "Token generation speed over recent turns", accentVar: "--opta-neon-cyan", group: "system" },
  { id: "daemon-ring", label: "Connection", description: "Daemon health and latency", accentVar: "--opta-primary", group: "system" },
  { id: "command-bar", label: "Quick Commands", description: "Your most-used slash commands", accentVar: "--opta-primary", group: "project" },
  { id: "working-dir", label: "Working Directory", description: "Current project path", accentVar: "--opta-neon-amber", group: "project" },
  { id: "browser-session", label: "Browser", description: "Active browser automation sessions", accentVar: "--opta-neon-cyan", group: "ai" },
];
