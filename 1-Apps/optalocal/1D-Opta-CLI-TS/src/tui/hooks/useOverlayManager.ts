import { useState, useCallback, useEffect } from 'react';
import type { ScrollViewHandle } from '../ScrollView.js';
import type { OptaMenuResultEntry } from '../OptaMenuOverlay.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';
import type { PermissionRequest } from '../adapter.js';
import type { PermissionDecision } from '../PermissionPrompt.js';
import type { WorkflowMode } from '../App.js';
import { ANIMATION } from '../animations.js';
import { isResponseIntentTone, type ResponseIntentTone } from '../response-intent.js';

const OPTA_MENU_ANIMATION_STEPS: number = ANIMATION.optaMenuSteps;
const OPTA_MENU_ANIMATION_FRAME_MS: number = ANIMATION.optaMenuFrameMs;

/** Ordered cycle of workflow modes (Shift+Tab). */
const WORKFLOW_MODES: WorkflowMode[] = ['normal', 'plan', 'research', 'review'];

export type ActiveOverlay =
  | 'none'
  | 'model-picker'
  | 'command-browser'
  | 'help-browser'
  | 'opta-menu'
  | 'browser-control'
  | 'action-history'
  | 'onboarding'
  | 'settings'
  | 'agent-picker'
  | 'session-browser';

export interface AppendActionEvent {
  kind: ActionEventKind;
  status?: ActionEventStatus;
  icon?: string;
  label: string;
  detail?: string;
}

export interface UseOverlayManagerOptions {
  appendAction: (event: AppendActionEvent) => void;
  scrollRef: React.RefObject<ScrollViewHandle | null>;
  permissionPending:
    | (PermissionRequest & { resolve: (decision: PermissionDecision) => void })
    | null;
  setMessages: React.Dispatch<React.SetStateAction<import('../App.js').TuiMessage[]>>;
  bypassPermissions: boolean;
  setBypassPermissions: React.Dispatch<React.SetStateAction<boolean>>;
  workflowMode: WorkflowMode;
  setWorkflowMode: React.Dispatch<React.SetStateAction<WorkflowMode>>;
  onModeChange?: (mode: WorkflowMode) => void;
  setResponseIntentTone: React.Dispatch<React.SetStateAction<ResponseIntentTone>>;
}

export interface UseOverlayManagerReturn {
  activeOverlay: ActiveOverlay;
  setActiveOverlay: React.Dispatch<React.SetStateAction<ActiveOverlay>>;
  sidebarVisible: boolean;
  setSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>;
  showAgentPanel: boolean;
  setShowAgentPanel: React.Dispatch<React.SetStateAction<boolean>>;
  followMode: boolean;
  setFollowMode: React.Dispatch<React.SetStateAction<boolean>>;
  safeModeOverride: boolean;
  setSafeModeOverride: React.Dispatch<React.SetStateAction<boolean>>;
  thinkingExpanded: boolean;
  setThinkingExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether any overlay is currently active (convenience derived flag). */
  overlayActive: boolean;
  // Animation state
  optaMenuAnimationPhase: 'opening' | 'open' | 'closing';
  optaMenuAnimationFrame: number;
  optaMenuResults: OptaMenuResultEntry[];
  setOptaMenuResults: React.Dispatch<React.SetStateAction<OptaMenuResultEntry[]>>;
  // Toggle callbacks
  handleClear: () => void;
  handleToggleSidebar: () => void;
  handleScrollUp: () => void;
  handleScrollDown: () => void;
  handleExpandThinking: () => void;
  // Menu callbacks
  openOptaMenu: () => void;
  closeOptaMenu: () => void;
  // Overlay control
  closeOverlay: () => void;
  toggleOverlay: (name: Exclude<ActiveOverlay, 'none'>) => void;
  // Open handlers
  handleOpenOptaMenu: () => void;
  handleOpenBrowserControl: () => void;
  handleOpenActionHistory: () => void;
  handleOpenOnboarding: () => void;
  handleOpenSettings: () => void;
  handleOpenAgentPicker: () => void;
  handleOpenSessionBrowser: () => void;
  // Settings/mode handlers
  handleSettingsSave: (changes: Record<string, unknown>) => void;
  handleToggleSafeMode: () => void;
  handleCycleMode: () => void;
  handleToggleBypass: () => void;
  handleToggleFollow: () => void;
}

export function useOverlayManager(options: UseOverlayManagerOptions): UseOverlayManagerReturn {
  const {
    appendAction,
    scrollRef,
    permissionPending,
    setMessages,
    bypassPermissions,
    setBypassPermissions,
    workflowMode: _workflowMode,
    setWorkflowMode,
    onModeChange,
    setResponseIntentTone,
  } = options;

  // --- Overlay state ---
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [safeModeOverride, setSafeModeOverride] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('none');
  const [followMode, setFollowMode] = useState(true);

  // --- Opta menu animation state ---
  const [optaMenuAnimationPhase, setOptaMenuAnimationPhase] = useState<
    'opening' | 'open' | 'closing'
  >('open');
  const [optaMenuAnimationFrame, setOptaMenuAnimationFrame] =
    useState<number>(OPTA_MENU_ANIMATION_STEPS);
  const [optaMenuResults, setOptaMenuResults] = useState<OptaMenuResultEntry[]>([]);

  const overlayActive = activeOverlay !== 'none';

  // --- Opta menu animation controller (open/close frames) ---
  useEffect(() => {
    if (activeOverlay !== 'opta-menu') {
      if (
        optaMenuAnimationPhase !== 'open' ||
        optaMenuAnimationFrame !== OPTA_MENU_ANIMATION_STEPS
      ) {
        setOptaMenuAnimationPhase('open');
        setOptaMenuAnimationFrame(OPTA_MENU_ANIMATION_STEPS);
      }
      return;
    }

    if (optaMenuAnimationPhase === 'open') {
      return;
    }

    if (
      optaMenuAnimationPhase === 'opening' &&
      optaMenuAnimationFrame >= OPTA_MENU_ANIMATION_STEPS
    ) {
      setOptaMenuAnimationPhase('open');
      return;
    }

    if (optaMenuAnimationPhase === 'closing' && optaMenuAnimationFrame <= 0) {
      setActiveOverlay('none');
      setOptaMenuAnimationPhase('open');
      setOptaMenuAnimationFrame(OPTA_MENU_ANIMATION_STEPS);
      return;
    }

    const delta = optaMenuAnimationPhase === 'opening' ? 1 : -1;
    const timer = setTimeout(() => {
      setOptaMenuAnimationFrame((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next > OPTA_MENU_ANIMATION_STEPS) return OPTA_MENU_ANIMATION_STEPS;
        return next;
      });
    }, OPTA_MENU_ANIMATION_FRAME_MS);

    return () => clearTimeout(timer);
  }, [activeOverlay, optaMenuAnimationFrame, optaMenuAnimationPhase]);

  // --- Toggle callbacks ---
  const handleClear = useCallback(() => setMessages([]), [setMessages]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => !prev);
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🧭',
      label: 'Sidebar toggled',
      detail: sidebarVisible ? 'off' : 'on',
    });
  }, [appendAction, sidebarVisible]);

  const handleScrollUp = useCallback(() => scrollRef.current?.scrollBy(-3), [scrollRef]);
  const handleScrollDown = useCallback(() => scrollRef.current?.scrollBy(3), [scrollRef]);
  const handleExpandThinking = useCallback(() => setThinkingExpanded((prev) => !prev), []);

  // --- Menu callbacks ---
  const openOptaMenu = useCallback(() => {
    setActiveOverlay('opta-menu');
    setOptaMenuAnimationFrame(0);
    setOptaMenuAnimationPhase('opening');
  }, []);

  const closeOptaMenu = useCallback(() => {
    setOptaMenuAnimationPhase('closing');
    setOptaMenuAnimationFrame((prev) => {
      if (prev <= 0) return 1;
      return Math.min(prev, OPTA_MENU_ANIMATION_STEPS);
    });
  }, []);

  // --- Overlay control ---
  const closeOverlay = useCallback(() => {
    if (activeOverlay === 'opta-menu') {
      closeOptaMenu();
      return;
    }
    setActiveOverlay('none');
  }, [activeOverlay, closeOptaMenu]);

  const toggleOverlay = useCallback((overlay: Exclude<ActiveOverlay, 'none'>) => {
    setActiveOverlay((prev) => (prev === overlay ? 'none' : overlay));
  }, []);

  // --- Open handlers ---
  const handleOpenOptaMenu = useCallback(() => {
    if (permissionPending) return;
    const opening = activeOverlay !== 'opta-menu' || optaMenuAnimationPhase === 'closing';
    if (opening) {
      openOptaMenu();
    } else {
      closeOptaMenu();
    }
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🟣',
      label: opening ? 'Opened Opta Menu' : 'Closed Opta Menu',
    });
  }, [
    permissionPending,
    activeOverlay,
    optaMenuAnimationPhase,
    openOptaMenu,
    closeOptaMenu,
    appendAction,
  ]);

  const handleOpenBrowserControl = useCallback(() => {
    if (permissionPending) return;
    const opening = activeOverlay !== 'browser-control';
    toggleOverlay('browser-control');
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🌐',
      label: opening ? 'Opened Browser Control' : 'Closed Browser Control',
    });
  }, [activeOverlay, permissionPending, toggleOverlay, appendAction]);

  const handleOpenActionHistory = useCallback(() => {
    if (permissionPending) return;
    const opening = activeOverlay !== 'action-history';
    toggleOverlay('action-history');
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🕘',
      label: opening ? 'Opened Actions History' : 'Closed Actions History',
    });
  }, [activeOverlay, permissionPending, toggleOverlay, appendAction]);

  const handleOpenOnboarding = useCallback(() => {
    if (permissionPending) return;
    const opening = activeOverlay !== 'onboarding';
    toggleOverlay('onboarding');
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🚀',
      label: opening ? 'Opened Setup Wizard' : 'Closed Setup Wizard',
    });
  }, [activeOverlay, permissionPending, toggleOverlay, appendAction]);

  const handleOpenSettings = useCallback(() => {
    if (permissionPending) return;
    if (activeOverlay === 'settings') return;
    setActiveOverlay('settings');
    appendAction({ kind: 'info', status: 'info', icon: '⚙️', label: 'Opened Settings' });
  }, [activeOverlay, permissionPending, appendAction]);

  const handleOpenAgentPicker = useCallback(() => {
    if (permissionPending) return;
    const opening = activeOverlay !== 'agent-picker';
    toggleOverlay('agent-picker');
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '\uD83E\uDD16',
      label: opening ? 'Opened Agent Picker' : 'Closed Agent Picker',
    });
  }, [activeOverlay, permissionPending, toggleOverlay, appendAction]);

  const handleOpenSessionBrowser = useCallback(() => {
    if (permissionPending) return;
    const opening = activeOverlay !== 'session-browser';
    toggleOverlay('session-browser');
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '\uD83D\uDCCB',
      label: opening ? 'Opened Session Browser' : 'Closed Session Browser',
    });
  }, [activeOverlay, permissionPending, toggleOverlay, appendAction]);

  // --- Settings/mode handlers ---
  const handleSettingsSave = useCallback(
    (changes: Record<string, unknown>) => {
      const toneValue = changes['tui.responseIntentTone'];
      if (isResponseIntentTone(toneValue)) {
        setResponseIntentTone(toneValue);
      }
      import('../../core/config.js')
        .then(({ saveConfig }) => {
          saveConfig(changes).catch(() => {
            /* non-fatal */
          });
        })
        .catch(() => {
          /* ignore */
        });
    },
    [setResponseIntentTone]
  );

  const handleToggleSafeMode = useCallback(() => {
    setSafeModeOverride((prev) => !prev);
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🛡️',
      label: 'Safe mode toggled',
      detail: safeModeOverride ? 'off' : 'on',
    });
  }, [appendAction, safeModeOverride]);

  const handleCycleMode = useCallback(() => {
    setWorkflowMode((prev) => {
      const idx = WORKFLOW_MODES.indexOf(prev);
      const next = WORKFLOW_MODES[(idx + 1) % WORKFLOW_MODES.length]!;
      onModeChange?.(next);
      return next;
    });
  }, [onModeChange, setWorkflowMode]);

  const handleToggleBypass = useCallback(() => {
    setBypassPermissions((prev) => !prev);
    appendAction({
      kind: 'permission',
      status: 'info',
      icon: '⚠️',
      label: 'Permission bypass toggled',
      detail: bypassPermissions ? 'off' : 'on',
    });
  }, [appendAction, bypassPermissions, setBypassPermissions]);

  const handleToggleFollow = useCallback(() => {
    setFollowMode((prev) => !prev);
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🧲',
      label: 'Auto follow toggled',
      detail: followMode ? 'off' : 'on',
    });
  }, [appendAction, followMode]);

  return {
    activeOverlay,
    setActiveOverlay,
    sidebarVisible,
    setSidebarVisible,
    showAgentPanel,
    setShowAgentPanel,
    followMode,
    setFollowMode,
    safeModeOverride,
    setSafeModeOverride,
    thinkingExpanded,
    setThinkingExpanded,
    overlayActive,
    // Animation state
    optaMenuAnimationPhase,
    optaMenuAnimationFrame,
    optaMenuResults,
    setOptaMenuResults,
    // Toggle callbacks
    handleClear,
    handleToggleSidebar,
    handleScrollUp,
    handleScrollDown,
    handleExpandThinking,
    // Menu callbacks
    openOptaMenu,
    closeOptaMenu,
    // Overlay control
    closeOverlay,
    toggleOverlay,
    // Open handlers
    handleOpenOptaMenu,
    handleOpenBrowserControl,
    handleOpenActionHistory,
    handleOpenOnboarding,
    handleOpenSettings,
    handleOpenAgentPicker,
    handleOpenSessionBrowser,
    // Settings/mode handlers
    handleSettingsSave,
    handleToggleSafeMode,
    handleCycleMode,
    handleToggleBypass,
    handleToggleFollow,
  };
}
