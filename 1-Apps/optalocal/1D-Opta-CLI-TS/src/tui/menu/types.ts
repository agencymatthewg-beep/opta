import type { WorkflowMode } from '../App.js';
import type { ActionEventStatus } from '../activity.js';

export type MenuAction =
  | 'model-picker'
  | 'command-browser'
  | 'help-browser'
  | 'browser-control'
  | 'action-history'
  | 'open-settings'
  | 'open-onboarding'
  | 'run-slash'
  | 'guided-agent-status'
  | 'guided-agent-start'
  | 'guided-agent-events'
  | 'guided-agent-cancel'
  | 'guided-skill-show'
  | 'guided-skill-run'
  | 'guided-skill-mcp-call'
  | 'guided-skill-openclaw'
  | 'guided-quantize-status'
  | 'guided-rag-query'
  | 'guided-rag-ingest-file'
  | 'guided-rag-context'
  | 'guided-rag-delete'
  | 'autonomy-up'
  | 'autonomy-down'
  | 'autonomy-toggle-mode'
  | 'toggle-sidebar'
  | 'toggle-safe-mode'
  | 'toggle-bypass'
  | 'toggle-follow'
  | 'close';

export type MenuPageId =
  | 'benchmark'
  | 'operations'
  | 'connectivity'
  | 'models'
  | 'lmx-ops'
  | 'runtime'
  | 'simple-settings'
  | 'config-curation'
  | 'advanced-autist';
export type MenuAnimationPhase = 'opening' | 'open' | 'closing';

export type StudioConnectivityState = 'checking' | 'reachable' | 'unreachable' | 'local';

export interface MenuPage {
  id: MenuPageId;
  label: string;
  color: string;
}

export interface MenuItem {
  action: MenuAction;
  label: string;
  description: string;
  color?: string;
  command?: string;
  recommended?: boolean;
  infoTitle?: string;
  infoBody?: string;
  learnMoreCommand?: string;
}

export type GuidedFlowKind =
  | 'agent-status'
  | 'agent-start'
  | 'agent-events'
  | 'agent-cancel'
  | 'skill-show'
  | 'skill-run'
  | 'skill-mcp-call'
  | 'skill-openclaw'
  | 'quantize-status'
  | 'rag-query'
  | 'rag-ingest-file'
  | 'rag-context'
  | 'rag-delete';

export interface GuidedFlowState {
  kind: GuidedFlowKind;
  value: string;
  phase: 'input' | 'confirm';
  /** Validation error message shown below input when format is invalid. */
  error?: string;
}

export interface OptaMenuResultEntry {
  id: string;
  at: number;
  command: string;
  status: ActionEventStatus;
  summary: string;
  outputSnippet?: string;
}

export interface OptaMenuOverlayProps {
  workflowMode: WorkflowMode;
  currentModel: string;
  autonomyLevel?: number;
  autonomyMode?: 'execution' | 'ceo';
  connectionHost: string;
  connectionPort: number;
  /** Optional external width cap from parent layout (message pane width). */
  maxWidth?: number;
  /** Optional external height cap from parent layout (message pane height). */
  maxHeight?: number;
  sidebarVisible: boolean;
  safeMode: boolean;
  bypassPermissions: boolean;
  followMode: boolean;
  studioConnectivity?: StudioConnectivityState;
  /** Optional transition phase from App-level overlay animation controller. */
  animationPhase?: MenuAnimationPhase;
  /** Optional transition progress (0..1) for open/close animation. */
  animationProgress?: number;
  /** Latest command outcomes triggered from the Opta Menu. */
  menuResults?: OptaMenuResultEntry[];
  onClose: () => void;
  onOpenModelPicker: () => void;
  onOpenCommandBrowser: () => void;
  onOpenHelpBrowser: () => void;
  onOpenBrowserControl: () => void;
  onOpenActionHistory: () => void;
  onRunCommand: (command: string) => Promise<void> | void;
  onToggleSidebar: () => void;
  onToggleSafeMode: () => void;
  onToggleBypass: () => void;
  onToggleFollow: () => void;
  onAutonomyUp?: () => void;
  onAutonomyDown?: () => void;
  onAutonomyToggleMode?: () => void;
  onOpenSettings?: () => void;
  onOpenOnboarding?: () => void;
}

export const PAGE_ORDER: MenuPage[] = [
  { id: 'benchmark',       label: 'Benchmark + Info',  color: '#38bdf8' },
  { id: 'operations',      label: 'Operations',         color: '#22d3ee' },
  { id: 'connectivity',    label: 'Connectivity',        color: '#10b981' },
  { id: 'models',          label: 'Models',              color: '#a78bfa' },
  { id: 'lmx-ops',         label: 'LMX Ops',             color: '#f97316' },
  { id: 'runtime',         label: 'Runtime',             color: '#f59e0b' },
  { id: 'simple-settings', label: 'Simple Settings',    color: '#6366f1' },
  { id: 'config-curation', label: 'Config Curation',    color: '#14b8a6' },
  { id: 'advanced-autist', label: 'Advanced Autist',    color: '#dc2626' },
];

export const PAGE_INDEX = PAGE_ORDER.reduce<Record<MenuPageId, number>>((acc, page, index) => {
  acc[page.id] = index;
  return acc;
}, {} as Record<MenuPageId, number>);
