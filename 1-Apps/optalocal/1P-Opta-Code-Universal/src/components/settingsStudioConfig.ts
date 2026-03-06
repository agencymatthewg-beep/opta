import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AppWindow,
  Brain,
  Cable,
  Cpu,
  Globe,
  Grid3X3,
  HardDrive,
  KeyRound,
  Layers,
  Logs,
  Network,
  SlidersHorizontal,
  Shield,
  SquareTerminal,
  Terminal,
  Timer,
  Zap,
} from "lucide-react";

export type SettingsTabId =
  | "connection-network"
  | "lmx-models"
  | "daemon-runtime"
  | "autonomy-policies"
  | "permissions-safety"
  | "browser-research"
  | "atpo"
  | "tools-agents-learning"
  | "mcp-integrations"
  | "environment-profiles"
  | "config-studio"
  | "accounts-vault"
  | "tiles-workspace-layout"
  | "apps-catalog"
  | "session-memory"
  | "background-jobs"
  | "daemon-logs"
  | "cli-system-advanced";

export type SettingsCategoryGroup =
  | "core"
  | "behaviour"
  | "workspace"
  | "system";

export const SETTINGS_GROUP_LABELS: Record<SettingsCategoryGroup, string> = {
  core: "Core",
  behaviour: "Behaviour",
  workspace: "Workspace",
  system: "System",
};

export interface SettingsCategory {
  id: SettingsTabId;
  title: string;
  desc: string;
  icon: LucideIcon;
  supportsDeepLayer: boolean;
  accentColor: string;
  group: SettingsCategoryGroup;
}

export interface SettingsStudioKeyboardAdapter {
  adjustSelected?:
    (event: KeyboardEvent, element: HTMLElement) => boolean;
  resolveHighlightTarget?: (element: HTMLElement) => HTMLElement;
}

export interface SettingsStudioModuleRegistration {
  id: SettingsTabId;
  title: string;
  accent: string;
  supportsDeepLayer: boolean;
  render: "native";
  keyboardAdapter?: SettingsStudioKeyboardAdapter;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  // ── Core ───────────────────────────────────────────────────────────
  {
    id: "connection-network",
    title: "Connection",
    desc: "Daemon host, port, and network discovery",
    icon: Network,
    supportsDeepLayer: true,
    accentColor: "#10b981",
    group: "core",
  },
  {
    id: "lmx-models",
    title: "Models",
    desc: "Local models, providers, and inference routing",
    icon: Cpu,
    supportsDeepLayer: true,
    accentColor: "#a78bfa",
    group: "core",
  },
  {
    id: "daemon-runtime",
    title: "AI Engine",
    desc: "Daemon lifecycle, health, and runtime controls",
    icon: Terminal,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "core",
  },
  // ── Behaviour ──────────────────────────────────────────────────────
  {
    id: "autonomy-policies",
    title: "Behaviour",
    desc: "How much the AI does on its own",
    icon: Activity,
    supportsDeepLayer: true,
    accentColor: "#c084fc",
    group: "behaviour",
  },
  {
    id: "permissions-safety",
    title: "Safety",
    desc: "Tool approvals, permissions, and guardrails",
    icon: Shield,
    supportsDeepLayer: true,
    accentColor: "#f59e0b",
    group: "behaviour",
  },
  {
    id: "browser-research",
    title: "Browser",
    desc: "AI web browsing and research tools",
    icon: Globe,
    supportsDeepLayer: true,
    accentColor: "#22d3ee",
    group: "behaviour",
  },
  {
    id: "atpo",
    title: "Atpo",
    desc: "Automated supervisor — oversight and cost controls",
    icon: Zap,
    supportsDeepLayer: true,
    accentColor: "#f472b6",
    group: "behaviour",
  },
  {
    id: "tools-agents-learning",
    title: "Tools & Agents",
    desc: "Sub-agents, tool memory, and learning",
    icon: Brain,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "behaviour",
  },
  {
    id: "mcp-integrations",
    title: "Integrations",
    desc: "MCP servers and third-party connections",
    icon: Cable,
    supportsDeepLayer: true,
    accentColor: "#22d3ee",
    group: "behaviour",
  },
  // ── Workspace ──────────────────────────────────────────────────────
  {
    id: "accounts-vault",
    title: "Account",
    desc: "Login, API keys, and secrets vault",
    icon: KeyRound,
    supportsDeepLayer: true,
    accentColor: "#f472b6",
    group: "workspace",
  },
  {
    id: "environment-profiles",
    title: "Profiles",
    desc: "Environment profiles and context switching",
    icon: Layers,
    supportsDeepLayer: true,
    accentColor: "#8b5cf6",
    group: "workspace",
  },
  {
    id: "config-studio",
    title: "Config",
    desc: "Raw config editor, reset flows, and overrides",
    icon: SlidersHorizontal,
    supportsDeepLayer: true,
    accentColor: "#60a5fa",
    group: "workspace",
  },
  {
    id: "tiles-workspace-layout",
    title: "Layout",
    desc: "Workspace tiles, panels, and display density",
    icon: Grid3X3,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "workspace",
  },
  {
    id: "session-memory",
    title: "Memory",
    desc: "Session memory, recall, and retention",
    icon: HardDrive,
    supportsDeepLayer: true,
    accentColor: "#c084fc",
    group: "workspace",
  },
  // ── System ─────────────────────────────────────────────────────────
  {
    id: "apps-catalog",
    title: "Apps",
    desc: "Install, remove, and manage Opta app modules",
    icon: AppWindow,
    supportsDeepLayer: true,
    accentColor: "#a78bfa",
    group: "system",
  },
  {
    id: "background-jobs",
    title: "Background",
    desc: "Background tasks and scheduled operations",
    icon: Timer,
    supportsDeepLayer: true,
    accentColor: "#60a5fa",
    group: "system",
  },
  {
    id: "daemon-logs",
    title: "Logs",
    desc: "Live daemon logs with filters and triage",
    icon: Logs,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "system",
  },
  {
    id: "cli-system-advanced",
    title: "Advanced",
    desc: "CLI parity tools and system-level controls",
    icon: SquareTerminal,
    supportsDeepLayer: true,
    accentColor: "#94a3b8",
    group: "system",
  },
];

export const SETTINGS_TAB_SEQUENCE: SettingsTabId[] = SETTINGS_CATEGORIES.map(
  (category) => category.id,
);

export const SETTINGS_CATEGORIES_BY_GROUP: Record<
  SettingsCategoryGroup,
  SettingsCategory[]
> = {
  core: SETTINGS_CATEGORIES.filter((c) => c.group === "core"),
  behaviour: SETTINGS_CATEGORIES.filter((c) => c.group === "behaviour"),
  workspace: SETTINGS_CATEGORIES.filter((c) => c.group === "workspace"),
  system: SETTINGS_CATEGORIES.filter((c) => c.group === "system"),
};

const LEGACY_SETTINGS_TAB_MAP: Record<string, SettingsTabId> = {
  // legacy internal IDs
  connection: "connection-network",
  lmx: "lmx-models",
  daemon: "daemon-runtime",
  autonomy: "autonomy-policies",
  genui: "autonomy-policies",
  "model-provider": "lmx-models",
  fleet: "tools-agents-learning",
  permissions: "permissions-safety",
  safety: "permissions-safety",
  browser: "browser-research",
  research: "browser-research",
  "tools-agents": "tools-agents-learning",
  learning: "tools-agents-learning",
  policy: "autonomy-policies",
  mcp: "mcp-integrations",
  secrets: "accounts-vault",
  account: "accounts-vault",
  // simplified group names → canonical IDs
  infrastructure: "connection-network",
  control: "autonomy-policies",
  security: "accounts-vault",
  workspace: "environment-profiles",
};

export function isSettingsTabId(value: string): value is SettingsTabId {
  return SETTINGS_TAB_SEQUENCE.includes(value as SettingsTabId);
}

export function normalizeSettingsTabId(value: string | null | undefined): SettingsTabId {
  if (value && isSettingsTabId(value)) {
    return value;
  }
  if (value && LEGACY_SETTINGS_TAB_MAP[value]) {
    return LEGACY_SETTINGS_TAB_MAP[value];
  }
  return SETTINGS_TAB_SEQUENCE[0] ?? "connection-network";
}
