/**
 * OverlayStack — Extracted from App.tsx.
 *
 * Renders the currently active overlay inside an ErrorBoundary wrapper.
 * When no overlay is active (`activeOverlay === 'none'`), returns null
 * so the caller can show the default message list instead.
 */

import React from 'react';
import { Box } from 'ink';
import { ModelPicker } from './ModelPicker.js';
import type { ModelSelection } from './ModelPicker.js';
import { CommandBrowser } from './CommandBrowser.js';
import { HelpBrowserOverlay } from './HelpBrowserOverlay.js';
import { BrowserControlOverlay, type BrowserPendingApprovalItem } from './BrowserControlOverlay.js';
import { ActionHistoryOverlay } from './ActionHistoryOverlay.js';
import { OnboardingOverlay } from './OnboardingOverlay.js';
import { SettingsOverlay } from './SettingsOverlay.js';
import { OptaMenuOverlay, type OptaMenuResultEntry, type StudioConnectivityState } from './OptaMenuOverlay.js';
import { AgentPickerOverlay, type AgentPickerSelection } from './AgentPickerOverlay.js';
import { SessionBrowserOverlay } from './SessionBrowserOverlay.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { getAllCommands } from '../commands/slash/index.js';
import type { SlashCommandDef } from '../commands/slash/index.js';
import type { KeybindingConfig } from './keybindings.js';
import type { ActionEvent, ActionEventStatus } from './activity.js';
import type { BrowserApprovalEvent } from '../browser/approval-log.js';
import type { BrowserControlAction } from '../browser/control-surface.js';
import type { BrowserRuntimeHealth } from '../browser/runtime-daemon.js';
import type { BrowserSessionMetadata, BrowserSessionStepRecord } from '../browser/types.js';
import type {
  BrowserReplayStepArtifactPreview,
  BrowserReplayVisualDiffPair,
} from '../browser/replay.js';
import type { SubAgentDisplayState } from '../core/subagent-events.js';
import type { WorkflowMode } from './App.js';
import type { ResponseIntentTone } from './response-intent.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mirrors the private SubmitResult interface in App.tsx. */
interface SubmitResult {
  ok: boolean;
  kind: 'noop' | 'slash' | 'shell' | 'prompt';
  command?: string;
  summary: string;
  output?: string;
  error?: string;
}

type ActiveOverlay =
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

export interface OverlayStackProps {
  activeOverlay: ActiveOverlay;
  overlayMaxWidth: number;
  overlayMaxHeight: number;

  // --- Shared close handler ---
  closeOverlay: () => void;

  // --- ModelPicker ---
  currentModel: string;
  connectionHost: string;
  connectionFallbackHosts: string[];
  connectionPort: number;
  connectionAdminKey: string | undefined;
  handleModelPickerSelect: (selection: ModelSelection) => Promise<void>;

  // --- CommandBrowser ---
  handleSubmit: (text: string) => Promise<SubmitResult>;

  // --- HelpBrowserOverlay ---
  keybindings: KeybindingConfig;

  // --- BrowserControlOverlay ---
  browserControlPane: {
    loading: boolean;
    health: BrowserRuntimeHealth | null;
    approvals: BrowserApprovalEvent[];
    message: string;
    messageStatus: ActionEventStatus;
    profileRetentionDays: number;
    profileMaxPersistedProfiles: number;
    profilePersistedCount: number;
  };
  pendingBrowserApprovals: BrowserPendingApprovalItem[];
  browserReplaySessionIds: string[];
  browserReplayPane: {
    loading: boolean;
    selectedSessionId: string | null;
    metadata: BrowserSessionMetadata | null;
    steps: BrowserSessionStepRecord[];
    selectedStepIndex: number;
    stepPreview: BrowserReplayStepArtifactPreview | null;
    visualDiffs: BrowserReplayVisualDiffPair[];
    selectedDiffIndex: number;
    message: string;
    messageStatus: ActionEventStatus;
  };
  handleReplaySelectSession: (sessionId: string) => void;
  handleReplayLoadSession: (sessionId: string) => Promise<void>;
  handleReplaySelectStep: (index: number) => void;
  handleReplaySelectDiff: (index: number) => void;
  runBrowserControlPaneAction: (action: BrowserControlAction) => Promise<void>;
  pruneBrowserControlProfiles: () => Promise<void>;
  refreshBrowserControlPane: () => Promise<void>;

  // --- ActionHistoryOverlay ---
  actionHistory: ActionEvent[];

  // --- OnboardingOverlay ---
  handleSettingsSave: (changes: Record<string, unknown>) => void;

  // --- SettingsOverlay ---
  responseIntentTone: ResponseIntentTone;

  // --- AgentPickerOverlay ---
  activeAgents: SubAgentDisplayState[];
  handleAgentPickerSelect: (selection: AgentPickerSelection) => void;

  // --- SessionBrowserOverlay ---
  sessionId: string;
  handleSessionResume: (sessionId: string) => void;
  handleSessionDelete: (sessionId: string) => void;

  // --- OptaMenuOverlay ---
  workflowMode: WorkflowMode;
  autonomyLevel: number;
  autonomyMode: 'execution' | 'ceo';
  sidebarVisible: boolean;
  safeMode: boolean;
  bypassPermissions: boolean;
  followMode: boolean;
  studioConnectivity: StudioConnectivityState;
  optaMenuAnimationPhase: 'opening' | 'open' | 'closing';
  optaMenuAnimationProgress: number;
  optaMenuResults: OptaMenuResultEntry[];
  handleOptaMenuRunCommand: (command: string) => Promise<void>;
  handleOpenBrowserControl: () => void;
  handleOpenActionHistory: () => void;
  handleToggleSidebar: () => void;
  handleToggleSafeMode: () => void;
  handleToggleBypass: () => void;
  handleToggleFollow: () => void;
  handleAutonomyUp: () => void;
  handleAutonomyDown: () => void;
  handleAutonomyToggleMode: () => void;
  setActiveOverlay: (v: ActiveOverlay) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverlayStack(props: OverlayStackProps): React.ReactElement | null {
  const { activeOverlay } = props;

  if (activeOverlay === 'none') return null;

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center" paddingX={1} paddingY={1}>
      {activeOverlay === 'model-picker' ? (
        <ErrorBoundary label="ModelPicker">
          <ModelPicker
            currentModel={props.currentModel}
            connectionHost={props.connectionHost}
            connectionFallbackHosts={props.connectionFallbackHosts}
            connectionPort={props.connectionPort}
            connectionAdminKey={props.connectionAdminKey}
            onSelect={props.handleModelPickerSelect}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'command-browser' ? (
        <ErrorBoundary label="CommandBrowser">
          <CommandBrowser
            commands={getAllCommands()}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            onSelect={async (cmd) => {
              props.closeOverlay();
              await props.handleSubmit(cmd);
            }}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'help-browser' ? (
        <ErrorBoundary label="HelpBrowser">
          <HelpBrowserOverlay
            commands={getAllCommands()}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            keybindings={props.keybindings}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'browser-control' ? (
        <ErrorBoundary label="BrowserControl">
          <BrowserControlOverlay
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            browserHealth={props.browserControlPane.health}
            browserApprovals={props.browserControlPane.approvals}
            pendingApprovals={props.pendingBrowserApprovals}
            browserBusy={props.browserControlPane.loading}
            browserMessage={props.browserControlPane.message}
            browserMessageStatus={props.browserControlPane.messageStatus}
            profileRetentionDays={props.browserControlPane.profileRetentionDays}
            profileMaxPersistedProfiles={props.browserControlPane.profileMaxPersistedProfiles}
            profilePersistedCount={props.browserControlPane.profilePersistedCount}
            replaySessionIds={props.browserReplaySessionIds}
            replaySelectedSessionId={props.browserReplayPane.selectedSessionId}
            replayLoading={props.browserReplayPane.loading}
            replayMessage={props.browserReplayPane.message}
            replayMessageStatus={props.browserReplayPane.messageStatus}
            replayMetadata={props.browserReplayPane.metadata}
            replaySteps={props.browserReplayPane.steps}
            replaySelectedStepIndex={props.browserReplayPane.selectedStepIndex}
            replaySelectedStepPreview={props.browserReplayPane.stepPreview}
            replayVisualDiffs={props.browserReplayPane.visualDiffs}
            replaySelectedDiffIndex={props.browserReplayPane.selectedDiffIndex}
            onReplaySelectSession={props.handleReplaySelectSession}
            onReplayLoadSession={(sessionId) => {
              void props.handleReplayLoadSession(sessionId);
            }}
            onReplaySelectStep={props.handleReplaySelectStep}
            onReplaySelectDiff={props.handleReplaySelectDiff}
            onBrowserControlAction={(action) => {
              void props.runBrowserControlPaneAction(action);
            }}
            onBrowserPruneProfiles={() => {
              void props.pruneBrowserControlProfiles();
            }}
            onBrowserRefresh={() => {
              void props.refreshBrowserControlPane();
            }}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'action-history' ? (
        <ErrorBoundary label="ActionHistory">
          <ActionHistoryOverlay
            history={props.actionHistory}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            browserHealth={props.browserControlPane.health}
            browserApprovals={props.browserControlPane.approvals}
            browserBusy={props.browserControlPane.loading}
            browserMessage={props.browserControlPane.message}
            browserMessageStatus={props.browserControlPane.messageStatus}
            onBrowserControlAction={(action) => {
              void props.runBrowserControlPaneAction(action);
            }}
            onBrowserRefresh={() => {
              void props.refreshBrowserControlPane();
            }}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'onboarding' ? (
        <ErrorBoundary label="Onboarding">
          <OnboardingOverlay
            animationPhase="open"
            animationProgress={1}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            onClose={props.closeOverlay}
            onComplete={(config) => {
              props.handleSettingsSave(config);
              props.closeOverlay();
            }}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'settings' ? (
        <ErrorBoundary label="Settings">
          <SettingsOverlay
            animationPhase="open"
            animationProgress={1}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            config={{
              'tui.responseIntentTone': props.responseIntentTone,
            }}
            onClose={props.closeOverlay}
            onSave={(changes) => {
              props.handleSettingsSave(changes);
            }}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'agent-picker' ? (
        <ErrorBoundary label="AgentPicker">
          <AgentPickerOverlay
            activeAgents={props.activeAgents}
            onSelect={props.handleAgentPickerSelect}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : activeOverlay === 'session-browser' ? (
        <ErrorBoundary label="SessionBrowser">
          <SessionBrowserOverlay
            currentSessionId={props.sessionId}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            onResume={(sessionId) => {
              props.handleSessionResume(sessionId);
              props.closeOverlay();
            }}
            onDelete={props.handleSessionDelete}
            onClose={props.closeOverlay}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary label="OptaMenu">
          <OptaMenuOverlay
            workflowMode={props.workflowMode}
            currentModel={props.currentModel}
            autonomyLevel={props.autonomyLevel}
            autonomyMode={props.autonomyMode}
            connectionHost={props.connectionHost}
            connectionPort={props.connectionPort}
            maxWidth={props.overlayMaxWidth}
            maxHeight={props.overlayMaxHeight}
            sidebarVisible={props.sidebarVisible}
            safeMode={props.safeMode}
            bypassPermissions={props.bypassPermissions}
            followMode={props.followMode}
            studioConnectivity={props.studioConnectivity}
            animationPhase={props.optaMenuAnimationPhase}
            animationProgress={props.optaMenuAnimationProgress}
            menuResults={props.optaMenuResults}
            onClose={props.closeOverlay}
            onOpenModelPicker={() => props.setActiveOverlay('model-picker')}
            onOpenCommandBrowser={() => props.setActiveOverlay('command-browser')}
            onOpenHelpBrowser={() => props.setActiveOverlay('help-browser')}
            onOpenBrowserControl={props.handleOpenBrowserControl}
            onOpenActionHistory={props.handleOpenActionHistory}
            onOpenSettings={() => props.setActiveOverlay('settings')}
            onOpenOnboarding={() => props.setActiveOverlay('onboarding')}
            onRunCommand={props.handleOptaMenuRunCommand}
            onToggleSidebar={props.handleToggleSidebar}
            onToggleSafeMode={props.handleToggleSafeMode}
            onToggleBypass={props.handleToggleBypass}
            onToggleFollow={props.handleToggleFollow}
            onAutonomyUp={props.handleAutonomyUp}
            onAutonomyDown={props.handleAutonomyDown}
            onAutonomyToggleMode={props.handleAutonomyToggleMode}
          />
        </ErrorBoundary>
      )}
    </Box>
  );
}
