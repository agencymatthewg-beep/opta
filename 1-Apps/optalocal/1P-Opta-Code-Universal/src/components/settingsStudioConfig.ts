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
} from "lucide-react";

export type SettingsTabId =
  | "connection-network"
  | "lmx-models"
  | "daemon-runtime"
  | "autonomy-policies"
  | "permissions-safety"
  | "browser-research"
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
  | "infrastructure"
  | "control"
  | "security"
  | "workspace";

export const SETTINGS_GROUP_LABELS: Record<SettingsCategoryGroup, string> = {
  infrastructure: "Infrastructure",
  control: "Control & Ops",
  security: "Security & Identity",
  workspace: "Workspace",
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
  {
    id: "connection-network",
    title: "Connection & Network",
    desc: "Daemon host, sockets, and connectivity flow",
    icon: Network,
    supportsDeepLayer: true,
    accentColor: "#10b981",
    group: "infrastructure",
  },
  {
    id: "lmx-models",
    title: "LMX & Models",
    desc: "Inference routing, local models, and providers",
    icon: Cpu,
    supportsDeepLayer: true,
    accentColor: "#a78bfa",
    group: "infrastructure",
  },
  {
    id: "daemon-runtime",
    title: "Daemon Runtime",
    desc: "Daemon lifecycle, health, and execution runtime",
    icon: Terminal,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "infrastructure",
  },
  {
    id: "autonomy-policies",
    title: "Autonomy & Policies",
    desc: "Autonomy levels, policy controls, and guardrails",
    icon: Activity,
    supportsDeepLayer: true,
    accentColor: "#c084fc",
    group: "control",
  },
  {
    id: "permissions-safety",
    title: "Permissions & Safety",
    desc: "Tool approvals, safety posture, and defaults",
    icon: Shield,
    supportsDeepLayer: true,
    accentColor: "#f59e0b",
    group: "security",
  },
  {
    id: "browser-research",
    title: "Browser & Research",
    desc: "Browser automation and research surfaces",
    icon: Globe,
    supportsDeepLayer: true,
    accentColor: "#22d3ee",
    group: "control",
  },
  {
    id: "tools-agents-learning",
    title: "Tools, Agents & Learning",
    desc: "Tooling operations and learning memory controls",
    icon: Brain,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "control",
  },
  {
    id: "mcp-integrations",
    title: "MCP & Integrations",
    desc: "MCP server and integration management",
    icon: Cable,
    supportsDeepLayer: true,
    accentColor: "#22d3ee",
    group: "control",
  },
  {
    id: "environment-profiles",
    title: "Environment Profiles",
    desc: "Environment profile lifecycle and context routing",
    icon: Layers,
    supportsDeepLayer: true,
    accentColor: "#8b5cf6",
    group: "workspace",
  },
  {
    id: "config-studio",
    title: "Config Studio",
    desc: "Config keys, reset flows, and raw configuration",
    icon: SlidersHorizontal,
    supportsDeepLayer: true,
    accentColor: "#60a5fa",
    group: "workspace",
  },
  {
    id: "accounts-vault",
    title: "Accounts & Vault",
    desc: "Account auth, key controls, and secrets vault",
    icon: KeyRound,
    supportsDeepLayer: true,
    accentColor: "#f472b6",
    group: "security",
  },
  {
    id: "tiles-workspace-layout",
    title: "Tiles & Workspace Layout",
    desc: "Workspace widgets, tile layout, and visibility",
    icon: Grid3X3,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "workspace",
  },
  {
    id: "apps-catalog",
    title: "Apps Catalog",
    desc: "Install, remove, and inspect Opta app modules",
    icon: AppWindow,
    supportsDeepLayer: true,
    accentColor: "#a78bfa",
    group: "workspace",
  },
  {
    id: "session-memory",
    title: "Session Memory",
    desc: "Session memory retrieval and lifecycle operations",
    icon: HardDrive,
    supportsDeepLayer: true,
    accentColor: "#c084fc",
    group: "workspace",
  },
  {
    id: "background-jobs",
    title: "Background Jobs",
    desc: "Start, inspect, and control background processes",
    icon: Timer,
    supportsDeepLayer: true,
    accentColor: "#60a5fa",
    group: "control",
  },
  {
    id: "daemon-logs",
    title: "Daemon Logs",
    desc: "Realtime daemon logs with filters and triage",
    icon: Logs,
    supportsDeepLayer: true,
    accentColor: "#38bdf8",
    group: "infrastructure",
  },
  {
    id: "cli-system-advanced",
    title: "CLI/System Advanced",
    desc: "Full operation parity for advanced workflows",
    icon: SquareTerminal,
    supportsDeepLayer: true,
    accentColor: "#94a3b8",
    group: "control",
  },
];

export const SETTINGS_TAB_SEQUENCE: SettingsTabId[] = SETTINGS_CATEGORIES.map(
  (category) => category.id,
);

export const SETTINGS_CATEGORIES_BY_GROUP: Record<
  SettingsCategoryGroup,
  SettingsCategory[]
> = {
  infrastructure: SETTINGS_CATEGORIES.filter((c) => c.group === "infrastructure"),
  control: SETTINGS_CATEGORIES.filter((c) => c.group === "control"),
  security: SETTINGS_CATEGORIES.filter((c) => c.group === "security"),
  workspace: SETTINGS_CATEGORIES.filter((c) => c.group === "workspace"),
};

const LEGACY_SETTINGS_TAB_MAP: Record<string, SettingsTabId> = {
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
