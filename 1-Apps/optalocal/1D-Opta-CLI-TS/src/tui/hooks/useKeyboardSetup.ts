import { useCallback } from 'react';
import { useApp, useInput } from 'ink';
import { useKeyboard } from './useKeyboard.js';
import type { KeybindingConfig } from '../keybindings.js';
import type { ActiveOverlay } from './useOverlayManager.js';
import type { PermissionRequest } from '../adapter.js';
import type { PermissionDecision } from '../PermissionPrompt.js';
import type { BrowserRuntimeHealth } from '../../browser/runtime-daemon.js';
import type { BrowserControlAction } from '../../browser/control-surface.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';
import type { ConnectionState } from '../utils.js';

export interface UseKeyboardSetupOptions {
  // Overlay state
  activeOverlay: ActiveOverlay;
  setActiveOverlay: React.Dispatch<React.SetStateAction<ActiveOverlay>>;
  overlayActive: boolean;
  // Permission state
  permissionPending: (PermissionRequest & { resolve: (decision: PermissionDecision) => void }) | null;
  // Turn state
  isLoading: boolean;
  turnPhase: 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done';
  connectionState: ConnectionState;
  effectiveConnectionState: ConnectionState;
  // Handler callbacks
  handleClear: () => void;
  handleToggleSidebar: () => void;
  handleScrollUp: () => void;
  handleScrollDown: () => void;
  handleExpandThinking: () => void;
  handleHelp: () => void;
  handleModelSwitch: () => void;
  handleToggleSafeMode: () => void;
  handleCycleMode: () => void;
  handleToggleBypass: () => void;
  handleToggleFollow: () => void;
  handleOpenOptaMenu: () => void;
  handleOpenBrowserControl: () => void;
  handleOpenActionHistory: () => void;
  handleOpenSettings: () => void;
  handleOpenOnboarding: () => void;
  handleOpenSessionBrowser: () => void;
  // Overlay control
  closeOverlay: () => void;
  // Agent panel
  setShowAgentPanel: React.Dispatch<React.SetStateAction<boolean>>;
  // Browser control
  browserControlPaneHealth: BrowserRuntimeHealth | null;
  runBrowserControlPaneAction: (action: BrowserControlAction) => Promise<void>;
  refreshBrowserControlPane: () => Promise<void>;
  // Connection
  reconnectLmx: () => Promise<void>;
  // Cancel turn
  onCancelTurn?: () => void;
  // Actions
  appendAction: (event: {
    kind: ActionEventKind;
    status?: ActionEventStatus;
    icon?: string;
    label: string;
    detail?: string;
  }) => void;
  // Panel focus
  onNextPanel: () => void;
  onPreviousPanel: () => void;
  // Keybindings
  keybindings: KeybindingConfig;
}

export function useKeyboardSetup(options: UseKeyboardSetupOptions): void {
  const {
    activeOverlay,
    setActiveOverlay,
    overlayActive,
    permissionPending,
    isLoading,
    turnPhase,
    effectiveConnectionState,
    handleClear,
    handleToggleSidebar,
    handleScrollUp,
    handleScrollDown,
    handleExpandThinking,
    handleHelp,
    handleModelSwitch,
    handleToggleSafeMode,
    handleCycleMode,
    handleToggleBypass,
    handleToggleFollow,
    handleOpenOptaMenu,
    handleOpenActionHistory,
    handleOpenSettings,
    handleOpenOnboarding,
    handleOpenSessionBrowser,
    closeOverlay,
    setShowAgentPanel,
    browserControlPaneHealth,
    runBrowserControlPaneAction,
    refreshBrowserControlPane,
    reconnectLmx,
    onCancelTurn,
    appendAction,
    onNextPanel,
    onPreviousPanel,
    keybindings,
  } = options;

  const { exit } = useApp();

  const hasActiveTurn = isLoading || turnPhase === 'waiting' || turnPhase === 'streaming' || turnPhase === 'tool-call' || turnPhase === 'connecting';

  const handleEscape = useCallback(() => {
    if (overlayActive) {
      closeOverlay();
      return;
    }
    if (hasActiveTurn && onCancelTurn) {
      onCancelTurn();
    }
  }, [overlayActive, closeOverlay, hasActiveTurn, onCancelTurn]);

  const handleInterrupt = useCallback(() => {
    if (overlayActive) {
      closeOverlay();
      return;
    }
    if (hasActiveTurn && onCancelTurn) {
      onCancelTurn();
      return;
    }
    exit();
  }, [overlayActive, closeOverlay, hasActiveTurn, onCancelTurn, exit]);

  useKeyboard({
    onExit: exit,
    onInterrupt: handleInterrupt,
    onEscape: handleEscape,
    onSlashMenu: () => {
      if (permissionPending) return;
      const opening = activeOverlay !== 'command-browser';
      setActiveOverlay(opening ? 'command-browser' : 'none');
      appendAction({
        kind: 'slash',
        status: 'info',
        icon: '🧩',
        label: opening ? 'Opened Command Browser' : 'Closed Command Browser',
      });
    },
    onOpenOptaMenu: () => {
      if (permissionPending) return;
      if (activeOverlay === 'settings') return;
      handleOpenOptaMenu();
    },
    onOpenActionHistory: () => {
      if (permissionPending) return;
      handleOpenActionHistory();
    },
    onOpenSettings: handleOpenSettings,
    onOpenOnboarding: handleOpenOnboarding,
    onOpenSessionBrowser: () => {
      if (permissionPending) return;
      handleOpenSessionBrowser();
    },
    onClear: () => {
      if (overlayActive || permissionPending) return;
      handleClear();
    },
    onHelp: handleHelp,
    onToggleSidebar: () => {
      if (overlayActive || permissionPending) return;
      handleToggleSidebar();
    },
    onScrollUp: () => {
      if (overlayActive || permissionPending) return;
      handleScrollUp();
    },
    onScrollDown: () => {
      if (overlayActive || permissionPending) return;
      handleScrollDown();
    },
    onExpandThinking: () => {
      if (overlayActive || permissionPending) return;
      handleExpandThinking();
    },
    onModelSwitch: handleModelSwitch,
    onToggleSafeMode: () => {
      if (overlayActive || permissionPending) return;
      handleToggleSafeMode();
    },
    onCycleMode: () => {
      if (overlayActive || permissionPending) return;
      handleCycleMode();
    },
    onToggleBypass: () => {
      if (overlayActive || permissionPending) return;
      handleToggleBypass();
    },
    onToggleFollow: () => {
      if (overlayActive || permissionPending) return;
      handleToggleFollow();
    },
    onBrowserPause: () => {
      const action = browserControlPaneHealth?.paused ? 'resume' : 'pause';
      void runBrowserControlPaneAction(action);
    },
    onBrowserKill: () => {
      void runBrowserControlPaneAction('kill');
    },
    onBrowserRefresh: () => {
      void refreshBrowserControlPane();
    },
    onToggleAgentPanel: () => {
      if (overlayActive || permissionPending) return;
      setShowAgentPanel(p => !p);
    },
    onNextPanel: () => {
      if (overlayActive || permissionPending) return;
      onNextPanel();
    },
    onPreviousPanel: () => {
      if (overlayActive || permissionPending) return;
      onPreviousPanel();
    },
  }, { bindings: keybindings });

  // Reconnect shortcut: press 'r' when connection is in error state (no overlay, not editing)
  useInput((input) => {
    if (
      input === 'r' &&
      effectiveConnectionState === 'error' &&
      !overlayActive &&
      !permissionPending
    ) {
      void reconnectLmx();
    }
  });
}
