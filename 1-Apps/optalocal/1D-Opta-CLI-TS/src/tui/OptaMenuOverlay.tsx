import { useMemo, useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { LAYOUT, computeMenuWidth, computeMenuHeight } from './layout.js';
import { ANIMATION, animateHeight, animateWidth } from './animations.js';
import { TUI_COLORS } from './palette.js';
import type {
  MenuPageId,
  MenuItem,
  GuidedFlowState,
  OptaMenuOverlayProps,
} from './menu/types.js';
import {
  PAGE_ORDER,
  PAGE_INDEX,
} from './menu/types.js';
import {
  labelWithState,
  connectivityLabel,
  autonomySlider,
  buildGuidedCommand,
  guidedFlowPrompt,
} from './menu/helpers.js';
import { MenuItemList } from './menu/MenuItemList.js';
import { MenuInfoPanel } from './menu/MenuInfoPanel.js';
import { GuidedFlowInput } from './menu/GuidedFlowInput.js';
import { errorMessage } from '../utils/errors.js';

// Re-export public types for external consumers
export type { StudioConnectivityState, OptaMenuOverlayProps, OptaMenuResultEntry } from './menu/types.js';

export function OptaMenuOverlay({
  workflowMode,
  currentModel,
  autonomyLevel = 2,
  autonomyMode = 'execution',
  connectionHost,
  connectionPort,
  maxWidth,
  maxHeight,
  sidebarVisible,
  safeMode,
  bypassPermissions,
  followMode,
  studioConnectivity = 'checking',
  animationPhase = 'open',
  animationProgress = 1,
  menuResults = [],
  onClose,
  onOpenModelPicker,
  onOpenCommandBrowser,
  onOpenHelpBrowser,
  onOpenBrowserControl,
  onOpenActionHistory,
  onRunCommand,
  onToggleSidebar,
  onToggleSafeMode,
  onToggleBypass,
  onToggleFollow,
  onAutonomyUp,
  onAutonomyDown,
  onAutonomyToggleMode,
  onOpenSettings,
  onOpenOnboarding,
}: OptaMenuOverlayProps) {
  const [selectedPage, setSelectedPage] = useState<MenuPageId>('benchmark');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [guidedFlow, setGuidedFlow] = useState<GuidedFlowState | null>(null);
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? LAYOUT.fallbackColumns;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? LAYOUT.fallbackRows;
  const rows = computeMenuHeight(stdoutRows, maxHeight);
  const width = computeMenuWidth(columns, maxWidth);
  const normalizedProgress = Number.isFinite(animationProgress)
    ? Math.max(0, Math.min(1, animationProgress))
    : 1;
  const visualRows = Math.max(10, Math.floor(rows * animateHeight(normalizedProgress)));
  const animatedWidth = Math.max(40, Math.floor(width * animateWidth(normalizedProgress)));
  const transitionActive = animationPhase !== 'open' || normalizedProgress < ANIMATION.considerFullyOpenAt;
  const showCoreContent = normalizedProgress >= ANIMATION.showCoreContentAt;
  const showActionsList = normalizedProgress >= ANIMATION.showActionsListAt;
  const infoPanelVisibleByAnimation = normalizedProgress >= ANIMATION.showInfoPanelAt;

  // Lock dimensions once fully open so terminal resize mid-session doesn't
  // cause the menu to jump size while the user is navigating.
  const [lockedDimensions, setLockedDimensions] = useState<{ rows: number; width: number } | null>(null);
  useEffect(() => {
    if (animationPhase === 'open' && !lockedDimensions) {
      setLockedDimensions({ rows: visualRows, width: animatedWidth });
    }
    if (animationPhase !== 'open') {
      setLockedDimensions(null);
    }
  }, [animationPhase, visualRows, animatedWidth, lockedDimensions]);
  const stableRows = lockedDimensions?.rows ?? visualRows;
  const stableWidth = lockedDimensions?.width ?? animatedWidth;

  const isStudioDown = studioConnectivity === 'unreachable';
  const hideRemoteFirstActions = isStudioDown || studioConnectivity === 'local';

  const pageItems = useMemo<Record<MenuPageId, MenuItem[]>>(() => {
    const benchmarkItems: MenuItem[] = [
      {
        action: 'run-slash',
        label: 'Benchmark Suite (Serve)',
        description: 'Generate all 3 benchmark apps and host them locally',
        command: '!opta benchmark --serve --force',
        color: '#38bdf8',
        recommended: true,
        infoTitle: 'Launch the full benchmark experience',
        infoBody: 'This runs the integrated benchmark flow: Opta landing page, premium chess UX, and the AI news research app in one reproducible suite.',
        learnMoreCommand: '!opta benchmark --serve --force',
      },
      {
        action: 'run-slash',
        label: 'Generate Benchmark Only',
        description: 'Create or refresh benchmark artifacts without hosting',
        command: '!opta benchmark --force',
        color: '#22d3ee',
        infoTitle: 'Build benchmark artifacts for testing',
        infoBody: 'Use this when you want stable benchmark files for review, CI, or snapshot comparisons without running a local server.',
        learnMoreCommand: '!opta benchmark --force',
      },
      {
        action: 'run-slash',
        label: 'Benchmark Smoke (JSON)',
        description: 'Run a fast benchmark smoke check with JSON output',
        command: '!opta benchmark --force --words 500 --max-results 3 --json',
        color: '#14b8a6',
        infoTitle: 'Quick system validation path',
        infoBody: 'This verifies that generation, research fallback behavior, and manifest output still work with current CLI systems.',
        learnMoreCommand: '!opta benchmark --force --words 500 --max-results 3 --json',
      },
      {
        action: 'run-slash',
        label: 'Inspect Benchmark Files',
        description: 'List generated benchmark suite files',
        command: '!ls -la apps/opta-benchmark-suite',
        color: '#a78bfa',
        infoTitle: 'Review generated artifacts quickly',
        infoBody: 'Use this to confirm outputs and file layout so teammates can navigate benchmark assets from a shared structure.',
        learnMoreCommand: '!ls -la apps/opta-benchmark-suite',
      },
      {
        action: 'run-slash',
        label: 'Benchmark Manifest',
        description: 'Inspect generated manifest and quality metadata',
        command: '!cat apps/opta-benchmark-suite/benchmark-manifest.json',
        color: '#8b5cf6',
        infoTitle: 'Read benchmark metadata and source provenance',
        infoBody: 'Shows generated app paths, provider fallback details, citation counts, and timestamped benchmark metadata.',
        learnMoreCommand: '!cat apps/opta-benchmark-suite/benchmark-manifest.json',
      },
      {
        action: 'run-slash',
        label: 'Benchmark Validation Pass',
        description: 'Run benchmark with stable defaults and JSON summary',
        command: '!opta benchmark --force --json --words 650 --max-results 10',
        color: '#06b6d4',
        infoTitle: 'Validate benchmark pipeline end-to-end',
        infoBody: 'Useful for regression checks after CLI/TUI changes when you need a deterministic summary payload for comparisons.',
        learnMoreCommand: '!opta benchmark --force --json --words 650 --max-results 10',
      },
      {
        action: 'help-browser',
        label: 'Educational Help Browser',
        description: 'Open structured help topics and command education',
        color: '#f59e0b',
        infoTitle: 'Menu-centered learning path',
        infoBody: 'The Help Browser is the educational companion to this menu and is designed to teach commands, keybinds, and workflows while you operate.',
      },
      {
        action: 'command-browser',
        label: 'Slash Command Lessons',
        description: 'Browse slash commands with examples and categories',
        color: '#6366f1',
        infoTitle: 'Discover command capabilities',
        infoBody: 'Use command browsing to learn the system by intent, then execute directly from this menu for fast iteration.',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
        infoTitle: 'Return to conversation mode',
        infoBody: 'Close the hub and continue execution in chat once you have the benchmark or educational context you need.',
      },
    ];

    const operationsItems: MenuItem[] = [
      {
        action: 'run-slash',
        label: 'Status Check',
        description: `Run /status for ${connectionHost}:${connectionPort}`,
        command: '/status',
        color: '#22d3ee',
        recommended: isStudioDown,
        infoTitle: 'Check system baseline',
        infoBody: 'Status check confirms model/runtime connectivity before deeper operations. Start here when behavior feels unclear.',
        learnMoreCommand: '/status',
      },
      {
        action: 'run-slash',
        label: 'Doctor Check + Fix',
        description: 'Run diagnostics and auto-remediate fixable issues',
        command: '/doctor --fix',
        color: '#10b981',
        recommended: isStudioDown,
        infoTitle: 'Run guided diagnostics with auto-fix',
        infoBody: 'Doctor verifies configuration, host health, and common failure modes — then applies auto-fixes for daemon restart, missing config dirs, and other remediable issues.',
        learnMoreCommand: '/doctor',
      },
      {
        action: 'run-slash',
        label: 'LMX Scan',
        description: 'Refresh model inventory, aliases, and loaded state',
        command: '/scan',
        color: '#38bdf8',
        infoTitle: 'Refresh model and runtime discovery data',
        infoBody: 'Scan gives the canonical list of loaded/on-disk models and role routing, which informs benchmark and model menu actions.',
        learnMoreCommand: '/scan',
      },
      {
        action: 'run-slash',
        label: 'Update Local',
        description: 'Update local CLI/build only',
        command: '/update --target local',
        color: '#14b8a6',
        recommended: isStudioDown,
        infoTitle: 'Refresh local runtime',
        infoBody: 'Use local-only updates when Studio is unavailable or when you want to validate behavior against your current machine first.',
        learnMoreCommand: '/update --target local',
      },
      {
        action: 'open-settings',
        label: 'Settings',
        description: 'Edit connection, model, safety, paths and advanced config',
        color: '#10b981',
        infoTitle: 'Opta Settings',
        infoBody: 'Open the interactive settings browser to view and change all configuration values. Changes take effect on next session start.',
      },
      {
        action: 'close',
        label: 'Close Menu',
        description: 'Return to chat',
        infoTitle: 'Exit Opta Menu',
        infoBody: 'Close this hub once you have selected your next action, then continue in chat with full context.',
      },
    ];

    const connectivityItems: MenuItem[] = [
      {
        action: 'run-slash',
        label: 'API Key Show',
        description: 'Show current Opta inference key (masked)',
        command: '/key show',
        color: '#10b981',
      },
      {
        action: 'run-slash',
        label: 'API Key Copy',
        description: 'Copy current Opta inference key',
        command: '/key copy',
        color: '#14b8a6',
      },
      {
        action: 'run-slash',
        label: 'LMX Server Status',
        description: 'Check LMX runtime status',
        command: '/serve',
        color: '#a78bfa',
        infoTitle: 'Inspect LMX runtime',
        infoBody: 'LMX status confirms inference engine availability, which is foundational for interactive benchmark quality.',
        learnMoreCommand: '/serve',
      },
      {
        action: 'run-slash',
        label: 'LMX Start',
        description: 'Start or ensure LMX is running',
        command: '/serve start',
        color: '#f59e0b',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
        infoTitle: 'Exit connectivity tools',
        infoBody: 'Return to chat after credentials and runtime checks are complete.',
      },
    ];

    const modelItems: MenuItem[] = [
      {
        action: 'model-picker',
        label: 'Model Manager',
        description: `Switch model (current: ${currentModel})`,
        color: '#22d3ee',
        infoTitle: 'Choose the active model',
        infoBody: 'Model choice changes response quality, speed, and tool behavior. Use this before benchmark runs for consistent comparisons.',
      },
      {
        action: 'autonomy-up',
        label: 'Autonomy +1',
        description: `Raise autonomy level (L${autonomyLevel} ${autonomySlider(autonomyLevel)})`,
        color: '#22d3ee',
        infoTitle: 'Increase autonomous execution rigor',
        infoBody: 'Higher levels increase runtime budget, delegation scope, and multi-cycle autonomous execution depth.',
      },
      {
        action: 'autonomy-down',
        label: 'Autonomy -1',
        description: `Lower autonomy level (L${autonomyLevel} ${autonomySlider(autonomyLevel)})`,
        color: '#06b6d4',
      },
      {
        action: 'autonomy-toggle-mode',
        label: `CEO Mode (${autonomyMode === 'ceo' ? 'on' : 'off'})`,
        description: autonomyMode === 'ceo'
          ? 'Switch to execution profile'
          : 'Enable CEO profile (live-data + reports)',
        color: '#f97316',
        infoTitle: 'CEO mode overlays governance + reporting',
        infoBody: 'CEO mode adds clarifying checkpoints, live-data verification expectations, and executive-grade reporting discipline.',
      },
      {
        action: 'run-slash',
        label: 'Autonomy Profile Status',
        description: 'Show active autonomy profile and budgets',
        command: '/autonomy',
        color: '#ef4444',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
        infoTitle: 'Exit model tools',
        infoBody: 'Return to chat after model and autonomy settings are configured.',
      },
    ];

    const runtimeItems: MenuItem[] = [
      {
        action: 'toggle-sidebar',
        label: labelWithState('Toggle Sidebar', sidebarVisible),
        description: 'Show/hide right sidebar',
        color: '#22d3ee',
      },
      {
        action: 'toggle-safe-mode',
        label: labelWithState('Toggle Safe Mode', safeMode),
        description: 'Guardrails for command execution',
        color: '#f59e0b',
        infoTitle: 'Safety-first execution controls',
        infoBody: 'Safe mode emphasizes guardrails and predictable UX behavior, useful for demos and educational walkthroughs.',
      },
      {
        action: 'toggle-bypass',
        label: labelWithState('Toggle Bypass', bypassPermissions),
        description: 'Bypass permission prompts (dangerous)',
        color: '#ef4444',
      },
      {
        action: 'toggle-follow',
        label: labelWithState('Toggle Follow', followMode),
        description: 'Auto-follow latest streaming output',
        color: '#10b981',
        infoTitle: 'Streaming readability control',
        infoBody: 'Follow mode keeps view pinned to live output, which is helpful when teaching tool flow and agent behavior.',
      },
      {
        action: 'browser-control',
        label: 'Browser Control',
        description: 'Inspect browser runtime + replay sessions',
        color: '#8b5cf6',
      },
      {
        action: 'action-history',
        label: 'Actions History',
        description: 'Open live/recorded tool action timeline',
        color: '#6366f1',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
        infoTitle: 'Exit runtime controls',
        infoBody: 'Close the runtime panel when visual and safety settings are configured.',
      },
    ];

    const lmxOpsItems: MenuItem[] = [
      {
        action: 'run-slash',
        label: 'Health Probe',
        description: 'Run liveness/readiness/admin health checks',
        command: '/models health --ready --admin',
        color: '#22d3ee',
      },
      {
        action: 'run-slash',
        label: 'Agent Runs',
        description: 'List recent agent runs across all states',
        command: '/agents list --limit 20',
        color: '#f59e0b',
      },
      {
        action: 'run-slash',
        label: 'Skills Catalog',
        description: 'List available skills and registry metadata',
        command: '/lmx-skills',
        color: '#10b981',
      },
      {
        action: 'run-slash',
        label: 'RAG Collections',
        description: 'List vector collections and document totals',
        command: '/rag collections',
        color: '#a78bfa',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
      },
    ];

    // ── Simple Settings ─────────────────────────────────────────────────────
    // Occasionally-touched settings: account setup, key provisioning, updates.
    const simpleSettingsItems: MenuItem[] = [
      {
        action: 'open-onboarding',
        label: 'Setup Wizard',
        description: 'Re-run the initial device configuration wizard',
        color: '#a78bfa',
        infoTitle: 'Setup Wizard',
        infoBody: 'Walk through the guided setup process to reconfigure LMX connection, default model, SSH, paths, and preferences.',
      },
      {
        action: 'run-slash',
        label: hideRemoteFirstActions ? 'API Key Create (local)' : 'API Key Create + Sync',
        description: hideRemoteFirstActions
          ? 'Create key locally without remote propagation'
          : 'Create key and push to configured Studio host',
        command: hideRemoteFirstActions ? '/key create --no-remote' : '/key create',
        color: '#22d3ee',
        infoTitle: 'Provision inference credentials',
        infoBody: hideRemoteFirstActions
          ? 'Creates a local key without remote propagation; recommended when Studio connectivity is degraded.'
          : 'Creates an inference key and syncs it to Studio so CLI, server, and external clients stay aligned.',
      },
      {
        action: 'run-slash',
        label: 'Update Studio',
        description: 'Update Studio host over SSH',
        command: '/update --target remote',
        color: '#f59e0b',
      },
      {
        action: 'run-slash',
        label: 'Update Both',
        description: 'Update local + Studio in one run',
        command: '/update --target both',
        color: '#f97316',
      },
      {
        action: 'command-browser',
        label: 'Command Browser',
        description: 'Browse all Opta functions via slash commands',
        color: '#a78bfa',
        infoTitle: 'Discover commands by purpose',
        infoBody: 'Command Browser helps you learn capabilities through categories and descriptions, then execute immediately.',
      },
      {
        action: 'help-browser',
        label: 'Help Browser',
        description: 'Search help topics and keybinds',
        color: '#f59e0b',
        infoTitle: 'Learn while operating',
        infoBody: 'Help Browser is the educational layer for keybindings, command families, and practical usage examples.',
      },
      {
        action: 'run-slash',
        label: 'Server Status',
        description: 'Check Opta daemon status',
        command: '/server status',
        color: '#6366f1',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
      },
    ];

    // ── Config Curation ──────────────────────────────────────────────────────
    // Model lifecycle management, LMX admin, preset tuning. Less frequent.
    const configCurationItems: MenuItem[] = [
      {
        action: 'run-slash',
        label: 'Model Performance',
        description: `Inspect overrides/defaults for ${currentModel}`,
        command: `/models info ${currentModel}`,
        color: '#38bdf8',
        infoTitle: 'Inspect model-level runtime tuning',
        infoBody: 'Shows backend, request telemetry, and active performance/global defaults from LMX.',
        learnMoreCommand: `/models info ${currentModel}`,
      },
      {
        action: 'run-slash',
        label: 'Unload Current Model',
        description: `Unload ${currentModel} to free memory`,
        command: `/unload ${currentModel}`,
        color: '#f97316',
      },
      {
        action: 'run-slash',
        label: 'List Presets',
        description: 'View all loaded LMX presets',
        command: '/presets',
        color: '#22c55e',
      },
      {
        action: 'run-slash',
        label: 'Reload Presets',
        description: 'Re-read preset files from LMX disk config',
        command: '/presets reload',
        color: '#16a34a',
      },
      {
        action: 'run-slash',
        label: 'Reload LMX Config',
        description: 'Apply updated model/preset/server config',
        command: '/serve reload',
        color: '#a78bfa',
      },
      {
        action: 'run-slash',
        label: 'LMX Diagnose',
        description: 'Run provider and runtime diagnostics',
        command: '/diagnose',
        color: '#38bdf8',
      },
      {
        action: 'run-slash',
        label: 'LMX Restart',
        description: 'Restart LMX runtime process',
        command: '/serve restart',
        color: '#f97316',
      },
      {
        action: 'run-slash',
        label: 'LMX Logs',
        description: 'Tail current LMX service logs',
        command: '/serve logs',
        color: '#6366f1',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
      },
    ];

    // ── Advanced Autist ──────────────────────────────────────────────────────
    // Power-user tools: quantize, autotune, RAG, agents, skills, compatibility.
    const advancedAutistItems: MenuItem[] = [
      {
        action: 'run-slash',
        label: 'Model Memory Breakdown',
        description: 'Inspect per-model memory usage',
        command: '/memory',
        color: '#10b981',
      },
      {
        action: 'run-slash',
        label: 'Model Metrics Summary',
        description: 'Inspect request and latency metrics',
        command: '/metrics',
        color: '#6366f1',
      },
      {
        action: 'run-slash',
        label: 'Helper Node Health',
        description: 'Inspect embedding/reranking helper node health',
        command: '/helpers',
        color: '#0ea5e9',
      },
      {
        action: 'run-slash',
        label: 'Predictor Stats',
        description: 'Inspect next-model predictor telemetry',
        command: '/predictor',
        color: '#0284c7',
      },
      {
        action: 'run-slash',
        label: 'Benchmark Current Model',
        description: `Measure tok/s and TTFT for ${currentModel}`,
        command: `/benchmark ${currentModel}`,
        color: '#f59e0b',
      },
      {
        action: 'run-slash',
        label: 'Probe Backend Fit',
        description: `Probe backend compatibility for ${currentModel}`,
        command: `/probe ${currentModel}`,
        color: '#f59e0b',
        infoTitle: 'Probe model/backend compatibility before risky loads',
        infoBody: 'Runs LMX backend probe to identify recommended runtime before long load/autotune cycles.',
      },
      {
        action: 'run-slash',
        label: 'Compatibility Ledger',
        description: 'Show compatibility outcomes + summary',
        command: `/compatibility --model ${currentModel} --summary --limit 20`,
        color: '#eab308',
      },
      {
        action: 'run-slash',
        label: 'Compatibility Detail',
        description: 'View latest compatibility rows without summary compression',
        command: `/compatibility --model ${currentModel} --limit 30`,
        color: '#ca8a04',
      },
      {
        action: 'run-slash',
        label: 'Autotune Current Model',
        description: 'Benchmark candidate profiles and persist best',
        command: `/autotune ${currentModel}`,
        color: '#fb7185',
      },
      {
        action: 'run-slash',
        label: 'Show Tuned Profile',
        description: `Inspect stored autotune profile for ${currentModel}`,
        command: `/autotune-status ${currentModel}`,
        color: '#f43f5e',
      },
      {
        action: 'run-slash',
        label: 'Quantize Jobs',
        description: 'List quantization jobs and status',
        command: '/quantize list',
        color: '#f97316',
      },
      {
        action: 'run-slash',
        label: 'Quantize Current (4-bit)',
        description: `Start 4-bit quantization for ${currentModel}`,
        command: `/quantize start ${currentModel} --bits 4`,
        color: '#fb7185',
      },
      {
        action: 'guided-quantize-status',
        label: 'Quantize Status (Guided)',
        description: 'Enter quantization job id and inspect state',
        color: '#f43f5e',
      },
      {
        action: 'run-slash',
        label: 'Runtime Events',
        description: 'Capture recent admin events stream',
        command: '/events --limit 10 --timeout 20',
        color: '#ea580c',
      },
      {
        action: 'guided-agent-status',
        label: 'Agent Status (Guided)',
        description: 'Enter run id and inspect one run in detail',
        color: '#f97316',
      },
      {
        action: 'guided-agent-events',
        label: 'Agent Events (Guided)',
        description: 'Enter run id and tail execution events',
        color: '#fb923c',
      },
      {
        action: 'guided-agent-start',
        label: 'Agent Start (Guided)',
        description: 'Enter prompt text and create a new run',
        color: '#f97316',
      },
      {
        action: 'guided-agent-cancel',
        label: 'Agent Cancel (Guided)',
        description: 'Enter run id and confirm cancellation',
        color: '#ef4444',
      },
      {
        action: 'run-slash',
        label: 'Skills Tool Catalog',
        description: 'List MCP tools exposed by the skill bridge',
        command: '/lmx-skills tools',
        color: '#92400e',
      },
      {
        action: 'guided-skill-show',
        label: 'Skill Detail (Guided)',
        description: 'Enter skill name/reference for detail view',
        color: '#0ea5e9',
      },
      {
        action: 'guided-skill-run',
        label: 'Skill Run (Guided)',
        description: 'Enter skill name and execute it',
        color: '#22c55e',
      },
      {
        action: 'guided-skill-mcp-call',
        label: 'Skill MCP Call (Guided)',
        description: 'Enter tool name and confirm tool invocation',
        color: '#0ea5e9',
      },
      {
        action: 'guided-skill-openclaw',
        label: 'Skill OpenClaw (Guided)',
        description: 'Enter tool name and confirm OpenClaw invoke',
        color: '#38bdf8',
      },
      {
        action: 'guided-rag-query',
        label: 'RAG Query (Guided)',
        description: 'Enter collection + query text (collection | query)',
        color: '#a78bfa',
      },
      {
        action: 'guided-rag-ingest-file',
        label: 'RAG Ingest File (Guided)',
        description: 'Enter collection + file path (collection | /path/file)',
        color: '#8b5cf6',
      },
      {
        action: 'guided-rag-context',
        label: 'RAG Context (Guided)',
        description: 'Enter query + collections (query | c1,c2)',
        color: '#7c3aed',
      },
      {
        action: 'guided-rag-delete',
        label: 'RAG Delete (Guided)',
        description: 'Enter collection and confirm deletion',
        color: '#dc2626',
      },
      {
        action: 'close',
        label: 'Back to Chat',
        description: 'Close menu',
      },
    ];

    const maybeFilterRemote = (items: MenuItem[]): MenuItem[] => {
      if (!hideRemoteFirstActions) return items;
      return items.filter((item) => item.label !== 'Update Studio' && item.label !== 'Update Both');
    };

    return {
      benchmark: benchmarkItems,
      operations: maybeFilterRemote(operationsItems),
      connectivity: connectivityItems,
      models: modelItems,
      'lmx-ops': lmxOpsItems,
      runtime: runtimeItems,
      'simple-settings': maybeFilterRemote(simpleSettingsItems),
      'config-curation': configCurationItems,
      'advanced-autist': advancedAutistItems,
    };
  }, [
    bypassPermissions,
    connectionHost,
    connectionPort,
    currentModel,
    autonomyLevel,
    autonomyMode,
    followMode,
    hideRemoteFirstActions,
    isStudioDown,
    safeMode,
    sidebarVisible,
  ]);

  const items = pageItems[selectedPage];
  const pageMeta = PAGE_ORDER[PAGE_INDEX[selectedPage]];
  const selectedItem = items[selectedIndex] ?? items[0];
  const compactLayout = visualRows < 30;
  const showInfoContent = showInfoPanel && !compactLayout && infoPanelVisibleByAnimation;
  const selectedCommand = selectedItem?.command;
  const selectedCommandResult = useMemo(() => {
    if (!selectedCommand) return null;
    return menuResults.find((entry) => entry.command === selectedCommand) ?? null;
  }, [menuResults, selectedCommand]);
  const latestMenuResults = useMemo(() => menuResults.slice(0, 4), [menuResults]);
  const itemViewportRows = Math.max(4,
    stableRows - (showInfoContent ? LAYOUT.menuInfoPanelRows : LAYOUT.menuChromeRows),
  );
  const itemWindow = useMemo(() => {
    if (items.length <= itemViewportRows) {
      return { start: 0, end: items.length };
    }
    const half = Math.floor(itemViewportRows / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + itemViewportRows;
    if (end > items.length) {
      end = items.length;
      start = Math.max(0, end - itemViewportRows);
    }
    return { start, end };
  }, [itemViewportRows, items.length, selectedIndex]);

  const setPage = (page: MenuPageId): void => {
    setSelectedPage(page);
    setSelectedIndex(0);
  };

  const runMenuCommand = useCallback((command: string) => {
    if (!command || pendingCommand) return;
    setPendingCommand(command);
    Promise.resolve(onRunCommand(command))
      .catch((err: unknown) => {
        console.error(`[menu] Command failed: ${errorMessage(err)}`);
      })
      .finally(() => {
        setPendingCommand((prev) => (prev === command ? null : prev));
      });
  }, [onRunCommand, pendingCommand]);

  useInput((input, key) => {
    if (guidedFlow) {
      const promptMeta = guidedFlowPrompt(guidedFlow.kind);
      if (key.escape) {
        setGuidedFlow(null);
        return;
      }
      if (guidedFlow.phase === 'confirm') {
        const lower = input.toLowerCase();
        if (lower === 'y') {
          const command = buildGuidedCommand(guidedFlow.kind, guidedFlow.value);
          if (command) runMenuCommand(command);
        }
        if (lower === 'y' || lower === 'n' || key.return || key.escape) {
          setGuidedFlow(null);
        }
        return;
      }

      if (key.return) {
        const command = buildGuidedCommand(guidedFlow.kind, guidedFlow.value);
        if (!command) {
          const hint = guidedFlow.value.trim()
            ? promptMeta.placeholder
            : 'Input cannot be empty';
          setGuidedFlow((prev) => prev ? { ...prev, error: hint } : prev);
          return;
        }
        // Clear any previous validation error before proceeding
        if (promptMeta.destructive) {
          setGuidedFlow((prev) => prev ? { ...prev, phase: 'confirm', error: undefined } : prev);
          return;
        }
        runMenuCommand(command);
        setGuidedFlow(null);
        return;
      }
      if (key.backspace || key.delete) {
        setGuidedFlow((prev) => prev ? { ...prev, value: prev.value.slice(0, -1) } : prev);
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.tab) {
        setGuidedFlow((prev) => prev ? { ...prev, value: prev.value + input, error: undefined } : prev);
      }
      return;
    }

    if (transitionActive) {
      if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
        onClose();
      }
      return;
    }

    if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
      onClose();
      return;
    }
    if (key.leftArrow || key.backspace || key.delete) {
      if (key.leftArrow) {
        const prevIndex = (PAGE_INDEX[selectedPage] + PAGE_ORDER.length - 1) % PAGE_ORDER.length;
        setPage(PAGE_ORDER[prevIndex]!.id);
      } else {
        onClose();
      }
      return;
    }
    if (key.rightArrow) {
      const nextIndex = (PAGE_INDEX[selectedPage] + 1) % PAGE_ORDER.length;
      setPage(PAGE_ORDER[nextIndex]!.id);
      return;
    }
    if (input === 'h' && !key.ctrl && !key.meta) {
      const prevIndex = (PAGE_INDEX[selectedPage] + PAGE_ORDER.length - 1) % PAGE_ORDER.length;
      setPage(PAGE_ORDER[prevIndex]!.id);
      return;
    }
    if (input === 'l' && !key.ctrl && !key.meta) {
      const nextIndex = (PAGE_INDEX[selectedPage] + 1) % PAGE_ORDER.length;
      setPage(PAGE_ORDER[nextIndex]!.id);
      return;
    }
    if (input === 'k' && !key.ctrl && !key.meta) {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      return;
    }
    if (input === 'j' && !key.ctrl && !key.meta) {
      setSelectedIndex((prev) => (prev + 1) % items.length);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev + 1) % items.length);
      return;
    }
    if ((input === 'i' || input === '?') && !key.ctrl && !key.meta) {
      setShowInfoPanel((prev) => !prev);
      return;
    }
    if (input === 'I' && !key.ctrl && !key.meta) {
      if (selectedItem?.learnMoreCommand) {
        runMenuCommand(selectedItem.learnMoreCommand);
        return;
      }
      setShowInfoPanel(true);
      return;
    }
    if (input === 'b' && !key.ctrl && !key.meta) {
      setPage('benchmark');
      return;
    }

    if (!key.ctrl && !key.meta) {
      const numeric = Number(input);
      if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= PAGE_ORDER.length) {
        setPage(PAGE_ORDER[numeric - 1]!.id);
        return;
      }
    }

    if (!key.return) return;
    const item = items[selectedIndex];
    if (!item) return;
    if (pendingCommand && item.action === 'run-slash') return;
    if (item.action === 'model-picker') onOpenModelPicker();
    else if (item.action === 'command-browser') onOpenCommandBrowser();
    else if (item.action === 'help-browser') onOpenHelpBrowser();
    else if (item.action === 'browser-control') onOpenBrowserControl();
    else if (item.action === 'action-history') onOpenActionHistory();
    else if (item.action === 'open-settings') onOpenSettings?.();
    else if (item.action === 'open-onboarding') onOpenOnboarding?.();
    else if (item.action === 'run-slash' && item.command) runMenuCommand(item.command);
    else if (item.action === 'guided-agent-status') setGuidedFlow({ kind: 'agent-status', value: '', phase: 'input' });
    else if (item.action === 'guided-agent-start') setGuidedFlow({ kind: 'agent-start', value: '', phase: 'input' });
    else if (item.action === 'guided-agent-events') setGuidedFlow({ kind: 'agent-events', value: '', phase: 'input' });
    else if (item.action === 'guided-agent-cancel') setGuidedFlow({ kind: 'agent-cancel', value: '', phase: 'input' });
    else if (item.action === 'guided-skill-show') setGuidedFlow({ kind: 'skill-show', value: '', phase: 'input' });
    else if (item.action === 'guided-skill-run') setGuidedFlow({ kind: 'skill-run', value: '', phase: 'input' });
    else if (item.action === 'guided-skill-mcp-call') setGuidedFlow({ kind: 'skill-mcp-call', value: '', phase: 'input' });
    else if (item.action === 'guided-skill-openclaw') setGuidedFlow({ kind: 'skill-openclaw', value: '', phase: 'input' });
    else if (item.action === 'guided-quantize-status') setGuidedFlow({ kind: 'quantize-status', value: '', phase: 'input' });
    else if (item.action === 'guided-rag-query') setGuidedFlow({ kind: 'rag-query', value: '', phase: 'input' });
    else if (item.action === 'guided-rag-ingest-file') setGuidedFlow({ kind: 'rag-ingest-file', value: '', phase: 'input' });
    else if (item.action === 'guided-rag-context') setGuidedFlow({ kind: 'rag-context', value: '', phase: 'input' });
    else if (item.action === 'guided-rag-delete') setGuidedFlow({ kind: 'rag-delete', value: '', phase: 'input' });
    else if (item.action === 'toggle-sidebar') onToggleSidebar();
    else if (item.action === 'toggle-safe-mode') onToggleSafeMode();
    else if (item.action === 'toggle-bypass') onToggleBypass();
    else if (item.action === 'toggle-follow') onToggleFollow();
    else if (item.action === 'autonomy-up') onAutonomyUp?.();
    else if (item.action === 'autonomy-down') onAutonomyDown?.();
    else if (item.action === 'autonomy-toggle-mode') onAutonomyToggleMode?.();
    else onClose();
  });

  const transitionLabel = animationPhase === 'opening'
    ? 'Opening Opta Menu...'
    : animationPhase === 'closing'
      ? 'Closing Opta Menu...'
      : '';
  const transitionGlyph = animationPhase === 'opening'
    ? '◔'
    : animationPhase === 'closing'
      ? '◕'
      : '●';

  const selectedResultPreview = (selectedCommandResult?.outputSnippet ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);

  const guidedCommandPreview = guidedFlow
    ? (buildGuidedCommand(guidedFlow.kind, guidedFlow.value) ?? '')
    : '';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={TUI_COLORS.borderSoft}
      width={stableWidth}
      minHeight={stableRows}
      paddingX={2}
      paddingY={1}
      overflow="hidden"
    >
      <Box justifyContent="space-between">
        <Text color="#ffffff" bold>
          Opta Menu{transitionActive ? ` · ${transitionGlyph}` : ''}
        </Text>
        <Text dimColor>{transitionActive ? `${Math.round(normalizedProgress * 100)}%` : 'Esc close'}</Text>
      </Box>

      {transitionActive ? (
        <Box marginTop={1}>
          <Text dimColor>{transitionGlyph} {transitionLabel}</Text>
        </Box>
      ) : null}

      {showCoreContent ? (
        <>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Model: <Text>{currentModel}</Text> · mode <Text color={TUI_COLORS.info}>{workflowMode}</Text></Text>
            <Text dimColor>
              Autonomy: <Text>{autonomySlider(autonomyLevel)} L{autonomyLevel}/5</Text> · profile{' '}
              <Text color={autonomyMode === 'ceo' ? '#f97316' : '#38bdf8'}>{autonomyMode}</Text>
            </Text>
            <Text dimColor>
              LMX: <Text>{connectionHost}:{connectionPort}</Text> · Studio SSH <Text color={isStudioDown ? '#f59e0b' : '#10b981'}>{connectivityLabel(studioConnectivity)}</Text>
            </Text>
          </Box>

          <Box marginTop={1} marginBottom={1} flexDirection="column">
            <Text dimColor>{`Left/Right switch page · Up/Down navigate · Enter select · 1-${PAGE_ORDER.length} pages`}</Text>
            <Text dimColor>i or ? toggle info panel · Shift+I run learn-more · Enter keeps menu open · b jump Benchmark</Text>
            {isStudioDown ? (
              <Text color="#f59e0b">Studio SSH unavailable: prioritizing local recovery actions.</Text>
            ) : null}
          </Box>

          {guidedFlow ? (
            <GuidedFlowInput
              guidedFlow={guidedFlow}
              guidedCommandPreview={guidedCommandPreview}
            />
          ) : null}

          <Box marginBottom={1} flexDirection="row" flexWrap="wrap">
            {PAGE_ORDER.map((page, index) => {
              const active = page.id === selectedPage;
              return (
                <Box key={page.id} marginRight={1}>
                  <Text
                    color={active ? '#ffffff' : TUI_COLORS.dim}
                    backgroundColor={active ? TUI_COLORS.borderSoft : undefined}
                  >
                    {active ? ` [ ${page.label} ] ` : `   ${page.label}   `}
                  </Text>
                </Box>
              );
            })}
          </Box>

          <Text color="#ffffff" bold>—— {pageMeta?.label ?? 'Menu'} ——</Text>

          <MenuItemList
            items={items}
            selectedPage={selectedPage}
            selectedIndex={selectedIndex}
            pendingCommand={pendingCommand}
            itemWindow={itemWindow}
            transitionGlyph={transitionGlyph}
            showActionsList={showActionsList}
            viewportRows={itemViewportRows}
          />

          <MenuInfoPanel
            selectedItem={selectedItem}
            pageMeta={pageMeta}
            showInfoContent={showInfoContent}
            compactLayout={compactLayout}
            pendingCommand={pendingCommand}
            selectedCommandResult={selectedCommandResult}
            selectedResultPreview={selectedResultPreview}
            latestMenuResults={latestMenuResults}
          />
        </>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{transitionGlyph} Stabilising menu layout...</Text>
          <Text dimColor>Use Esc to close while transition runs.</Text>
        </Box>
      )}
    </Box>
  );
}
