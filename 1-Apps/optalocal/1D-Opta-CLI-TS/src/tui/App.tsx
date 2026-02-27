import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header } from './Header.js';
import { MessageList } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { InkStatusBar } from './StatusBar.js';
import { SplitPane } from './SplitPane.js';
import { Sidebar } from './Sidebar.js';
import { HintBar } from './HintBar.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useBrowserState } from './hooks/useBrowserState.js';
import { usePermissionState } from './hooks/usePermissionState.js';
import { useSessionState } from './hooks/useSessionState.js';
import { useAppConfig } from './hooks/useAppConfig.js';
import { useAppActions } from './hooks/useAppActions.js';
import { useStreamingEvents } from './hooks/useStreamingEvents.js';
import { useOverlayManager } from './hooks/useOverlayManager.js';
import { useKeyboardSetup } from './hooks/useKeyboardSetup.js';
import { useAutonomyControls } from './hooks/useAutonomyControls.js';
import { useModelSelection } from './hooks/useModelSelection.js';
import { useBrowserIntegration } from './hooks/useBrowserIntegration.js';
import { useSubmitHandler } from './hooks/useSubmitHandler.js';
import { OverlayStack } from './OverlayStack.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import type { ScrollViewHandle } from './ScrollView.js';
import { BrowserManagerRail } from './BrowserManagerRail.js';
import { InsightBlock } from './InsightBlock.js';
import { OptimiserPanel } from './OptimiserPanel.js';
import { estimateTokens } from '../utils/tokens.js';
import type { TuiEmitter } from './adapter.js';
import type { ConnectionState } from './utils.js';
import type { SlashResult } from '../commands/slash/index.js';
import type { ResponseIntentTone } from './response-intent.js';
import { triggerWordsFromDefinitions } from './trigger-router.js';
import { LAYOUT } from './layout.js';
import { ANIMATION } from './animations.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import type { Panel } from './FocusContext.js';
import { AgentSwarmRail } from './AgentSwarmRail.js';
import type { AgentPickerSelection } from './AgentPickerOverlay.js';
import { AgentMonitorPanel } from './AgentMonitorPanel.js';
import { deriveOptimiserIntent } from './optimiser-intent.js';

/** Chrome rows: Header(3) + BrowserManagerRail(3) + StatusBar(3) + HintBar(1) + InputBox(3) = 13 */
const CHROME_HEIGHT = LAYOUT.totalChromeWithRail;
const SAFE_MODE_CHROME_HEIGHT = 4;
const SAFE_MODE_AUTO_WIDTH = 74;
const OPTA_MENU_ANIMATION_STEPS: number = ANIMATION.optaMenuSteps;
/** Rows recovered when an overlay hides BrowserManagerRail(3) + HintBar(1) + InputBox(3). */
const OVERLAY_CHROME_RECOVERY_ROWS = 7;
const SAFE_OVERLAY_CHROME_RECOVERY_ROWS = 3;

export function computeMessageAreaHeight(totalRows: number, safeMode: boolean): number {
  const chromeHeight = safeMode ? SAFE_MODE_CHROME_HEIGHT : CHROME_HEIGHT;
  return Math.max(totalRows - chromeHeight, 0);
}

/** Workflow modes cycled by Shift+Tab. */
export type WorkflowMode = 'normal' | 'plan' | 'research' | 'review';

export interface AssistantResponseMeta {
  elapsedSec: number;
  tokensPerSecond: number;
  intent: string;
  intentTone?: ResponseIntentTone;
  intentOutcome?: 'direct' | 'verified' | 'partial';
}

export interface TuiMessage {
  role: string;
  content: string;
  createdAt?: number;
  toolName?: string;
  toolId?: string;
  toolStatus?: 'running' | 'done' | 'error';
  toolArgs?: Record<string, unknown>;
  toolCalls?: number;
  thinkingTokens?: number;
  thinking?: { text: string; tokens: number };
  imageCount?: number;
  responseMeta?: AssistantResponseMeta;
}

/** Live activity item accumulated during streaming, cleared on turn:end. */
export interface TurnActivityItem {
  type: 'tool' | 'thinking';
  toolName?: string;
  toolId?: string;
  toolStatus?: 'running' | 'done' | 'error';
  toolArgs?: Record<string, unknown>;
  thinkingTokens?: number;
}

export interface SlashCommandResult {
  result: SlashResult;
  output: string;
  newModel?: string;
}

interface AppProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  initialMessages?: TuiMessage[];
  requireLoadedModel?: boolean;
  initialModelLoaded?: boolean;
  onMessage?: (text: string) => Promise<string>;
  emitter?: TuiEmitter;
  onSubmit?: (text: string) => void;
  onCancelTurn?: () => void;
  onSlashCommand?: (input: string) => Promise<SlashCommandResult>;
  title?: string;
  onModeChange?: (mode: WorkflowMode) => void;
}

function AppInner({
  model: initialModel,
  sessionId,
  connectionStatus = true,
  initialMessages = [],
  requireLoadedModel = false,
  initialModelLoaded = true,
  onMessage,
  emitter,
  onSubmit,
  onCancelTurn,
  onSlashCommand,
  title: initialTitle,
  onModeChange,
}: AppProps) {
  const { exit } = useApp();
  const { width, height } = useTerminalSize();

  // --- Domain hooks ---
  const {
    messages, setMessages,
    isLoading, setIsLoading,
    workflowMode, setWorkflowMode,
    bypassPermissions, setBypassPermissions,
    liveActivity, setLiveActivity,
    liveStreamingText, setLiveStreamingText,
    liveThinkingText, setLiveThinkingText,
    currentModel, setCurrentModel,
    tokens, setTokens,
    promptTokens, setPromptTokens,
    completionTokens, setCompletionTokens,
    toolCallCount, setToolCallCount,
    elapsed, setElapsed,
    speed, setSpeed,
    cost,
    sessionTitle, setSessionTitle,
    modelLoaded, setModelLoaded,
    turnPhase, setTurnPhase,
    connectionState, setConnectionState,
    turnElapsed, setTurnElapsed,
    setFirstTokenLatency,
    setTurnSpeed,
    turnCompletionTokens, setTurnCompletionTokens,
    contextLimit, setContextLimit,
    registeredToolCount, setRegisteredToolCount,
    autonomyLevel, setAutonomyLevel,
    autonomyMode, setAutonomyMode,
    activeAgents, setActiveAgents,
  } = useSessionState(initialMessages, initialModel, initialModelLoaded, initialTitle);

  const {
    browserControlPane, setBrowserControlPane,
    pendingBrowserApprovals, setPendingBrowserApprovals,
    browserPolicyConfig, setBrowserPolicyConfig,
    browserReplayPane, setBrowserReplayPane,
  } = useBrowserState();

  const {
    permissionPending, setPermissionPending,
    alwaysMessage, setAlwaysMessage,
  } = usePermissionState();

  // UI state for streaming label
  const [streamingLabel, setStreamingLabel] = useState('thinking');

  // Track whether we're in streaming mode (emitter-based)
  const isStreamingMode = !!emitter;

  const effectiveConnectionState: ConnectionState = modelLoaded ? connectionState : 'error';
  const persistenceEnabled = process.env['VITEST'] !== 'true' && process.env['NODE_ENV'] !== 'test';

  // --- 1. useAppConfig: connection, account, keybindings, heartbeat ---
  const appConfig = useAppConfig({
    currentModel,
    persistenceEnabled,
    setConnectionState,
    setCurrentModel,
    setAutonomyLevel,
    setAutonomyMode,
    setContextLimit,
    setRegisteredToolCount,
    setBrowserPolicyConfig,
  });

  const {
    connectionHost,
    connectionFallbackHosts,
    connectionPort,
    connectionAdminKey,
    studioConnectivity,
    accountState,
    triggerDefinitions,
    skillRuntimeSettings,
    responseIntentTone,
    keybindings,
    reconnectLmx,
  } = appConfig;

  const triggerWords = useMemo(
    () => triggerWordsFromDefinitions(triggerDefinitions),
    [triggerDefinitions],
  );

  // --- 2. useAppActions: action history, status bar, token flushing, refs ---
  const appActions = useAppActions({
    sessionId,
    persistenceEnabled,
    isLoading,
    setLiveStreamingText,
    setTurnElapsed,
  });

  const {
    appendAction,
    summarizeToolArgs,
    flushStreamingTextNow,
    scheduleTokenFlush,
    insights,
    setInsights,
    maxInsights,
    actionHistory,
    statusActionLabel,
    statusActionIcon,
    statusActionStatus,
    setStatusActionLabel,
    setStatusActionIcon,
    setStatusActionStatus,
    currentStreamingTextRef,
    liveActivityRef,
    thinkingTextRef,
    currentTurnPromptRef,
    tokenFlushTimerRef,
    tokenRateWindowRef,
  } = appActions;

  // Imperative scroll handle -- filled by ScrollView via MessageList scrollRef prop
  const scrollRef = useRef<ScrollViewHandle | null>(null);

  // --- 3. useOverlayManager: overlay state, animation, toggle callbacks ---
  const overlayManager = useOverlayManager({
    appendAction,
    scrollRef,
    permissionPending,
    setMessages,
    bypassPermissions,
    setBypassPermissions,
    workflowMode,
    setWorkflowMode,
    onModeChange,
    setResponseIntentTone: appConfig.setResponseIntentTone,
  });

  const {
    activeOverlay,
    setActiveOverlay,
    sidebarVisible,
    showAgentPanel,
    setShowAgentPanel,
    followMode,
    safeModeOverride,
    thinkingExpanded,
    overlayActive,
    optaMenuAnimationPhase,
    optaMenuAnimationFrame,
    optaMenuResults,
    setOptaMenuResults,
    handleClear,
    handleToggleSidebar,
    handleScrollUp,
    handleScrollDown,
    handleExpandThinking,
    closeOverlay,
    toggleOverlay,
    handleOpenOptaMenu,
    handleOpenBrowserControl,
    handleOpenActionHistory,
    handleOpenOnboarding,
    handleOpenSettings,
    handleOpenAgentPicker,
    handleOpenSessionBrowser,
    handleSettingsSave,
    handleToggleSafeMode,
    handleCycleMode,
    handleToggleBypass,
    handleToggleFollow,
  } = overlayManager;

  // --- 4. useAutonomyControls ---
  const {
    handleAutonomyUp,
    handleAutonomyDown,
    handleAutonomyToggleMode,
  } = useAutonomyControls({
    autonomyLevel,
    setAutonomyLevel: appConfig.setAutonomyLevel,
    autonomyMode,
    setAutonomyMode: appConfig.setAutonomyMode,
    appendAction,
    setMessages,
  });

  // --- 5. useModelSelection ---
  const {
    handleHelp,
    handleModelSwitch,
    handleModelPickerSelect,
  } = useModelSelection({
    currentModel,
    setCurrentModel,
    setModelLoaded,
    setConnectionState,
    setContextLimit,
    connectionHost,
    connectionFallbackHosts,
    connectionPort,
    connectionAdminKey,
    appendAction,
    setActiveOverlay,
    setMessages,
    permissionPending,
    toggleOverlay,
  });

  // --- 6. useBrowserIntegration ---
  const browserIntegration = useBrowserIntegration({
    browserControlPane,
    setBrowserControlPane,
    browserReplayPane,
    setBrowserReplayPane,
    activeOverlay,
    appendAction,
  });

  const {
    runBrowserControlPaneAction,
    pruneBrowserControlProfiles,
    refreshBrowserControlPane,
    browserReplaySessionIds,
    handleReplaySelectSession,
    handleReplaySelectStep,
    handleReplaySelectDiff,
    handleReplayLoadSession,
  } = browserIntegration;

  // --- 7. useStreamingEvents: emitter listener wiring ---
  useStreamingEvents({
    emitter: emitter ?? null,
    currentStreamingTextRef,
    liveActivityRef,
    thinkingTextRef,
    currentTurnPromptRef,
    tokenFlushTimerRef,
    tokenRateWindowRef,
    scrollRef,
    setIsLoading,
    setLiveActivity,
    setLiveStreamingText,
    setLiveThinkingText,
    setModelLoaded,
    setConnectionState,
    setTurnPhase,
    setToolCallCount,
    setTokens,
    setPromptTokens,
    setCompletionTokens,
    setElapsed,
    setSpeed,
    setFirstTokenLatency,
    setTurnSpeed,
    setTurnCompletionTokens,
    setSessionTitle,
    setMessages,
    setActiveAgents,
    setShowAgentPanel,
    setStreamingLabel,
    setStatusActionLabel,
    setStatusActionIcon,
    setStatusActionStatus,
    setInsights,
    maxInsights,
    setPermissionPending,
    setPendingBrowserApprovals,
    setAlwaysMessage,
    flushStreamingTextNow,
    scheduleTokenFlush,
    appendAction,
    summarizeToolArgs,
    browserPolicyConfig,
    responseIntentTone,
  });

  // --- Submit handler hook ---
  const {
    handleSubmit,
    handleOptaMenuRunCommand,
  } = useSubmitHandler({
    appendAction,
    exit,
    isStreamingMode,
    modelLoaded,
    onMessage,
    onModeChange,
    onSlashCommand,
    onSubmit,
    requireLoadedModel,
    setWorkflowMode,
    skillRuntimeSettings,
    triggerDefinitions,
    workflowMode,
    responseIntentTone,
    setActiveOverlay,
    setMessages,
    setCurrentModel,
    setAutonomyLevel,
    setAutonomyMode,
    setIsLoading,
    setTurnPhase,
    setElapsed,
    currentTurnPromptRef,
    setOptaMenuResults,
    emitter,
  });

  // --- Panel focus cycling (G32) ---
  const PANEL_ORDER: Panel[] = ['input', 'messages', 'sidebar'];
  const [activePanel, setActivePanel] = useState<Panel>('input');
  const handleNextPanel = useCallback(() => {
    setActivePanel(prev => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]!;
    });
  }, []);
  const handlePreviousPanel = useCallback(() => {
    setActivePanel(prev => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]!;
    });
  }, []);

  // --- Agent picker select handler ---
  const handleAgentPickerSelect = useCallback((selection: AgentPickerSelection) => {
    const { profile } = selection;
    appendAction({
      kind: 'info',
      status: 'info',
      icon: profile.icon,
      label: `Spawning ${profile.label} agent`,
      detail: `mode=${profile.mode} budget=${profile.budget.maxToolCalls} calls`,
    });
    closeOverlay();
    // Dispatch the spawn via the emitter if available, otherwise
    // submit a slash command that the agent loop can process.
    if (onSubmit) {
      onSubmit(`/agent spawn ${profile.id}`);
    }
  }, [appendAction, closeOverlay, onSubmit]);

  // --- Session browser handlers ---
  const handleSessionResume = useCallback((targetSessionId: string) => {
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '📋',
      label: `Resuming session ${targetSessionId.slice(0, 8)}…`,
    });
    closeOverlay();
    if (onSubmit) {
      onSubmit(`/session resume ${targetSessionId}`);
    }
  }, [appendAction, closeOverlay, onSubmit]);

  const handleSessionDelete = useCallback((targetSessionId: string) => {
    void import('../memory/store.js').then(({ deleteSession }) => {
      void deleteSession(targetSessionId).then(() => {
        appendAction({
          kind: 'info',
          status: 'info',
          icon: '\u2717',
          label: `Deleted session ${targetSessionId.slice(0, 8)}`,
        });
      });
    });
  }, [appendAction]);

  // --- 8. useKeyboardSetup: keybinding wiring ---
  useKeyboardSetup({
    activeOverlay,
    setActiveOverlay,
    overlayActive,
    permissionPending,
    isLoading,
    turnPhase,
    connectionState,
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
    handleOpenBrowserControl,
    handleOpenActionHistory,
    handleOpenSettings,
    handleOpenOnboarding,
    handleOpenSessionBrowser,
    closeOverlay,
    setShowAgentPanel,
    browserControlPaneHealth: browserControlPane.health,
    runBrowserControlPaneAction,
    refreshBrowserControlPane,
    reconnectLmx,
    onCancelTurn,
    appendAction,
    onNextPanel: handleNextPanel,
    onPreviousPanel: handlePreviousPanel,
    keybindings,
  });

  // --- Derived state ---
  const contextUsage = useMemo(() => ({
    used: promptTokens + completionTokens,
    total: contextLimit,
  }), [promptTokens, completionTokens, contextLimit]);
  const liveThinkingTokens = useMemo(
    () => (liveThinkingText ? estimateTokens(liveThinkingText) : 0),
    [liveThinkingText],
  );

  // Responsive layout: derive narrow modes from terminal width
  const safeMode = safeModeOverride || width <= SAFE_MODE_AUTO_WIDTH;
  const narrowMode = safeMode || width < 80;
  const compactHeader = safeMode || width < 72;
  const compactStatus = safeMode || width < 110;

  // Auto-hide sidebar when terminal is narrow or safe-mode is enabled
  const effectiveSidebarVisible = (safeMode || narrowMode) ? false : sidebarVisible;

  const optimiserIntent = useMemo(
    () => deriveOptimiserIntent({
      sessionTitle,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      liveActivity: liveActivity.map((activity) => ({
        type: activity.type,
        toolName: activity.toolName,
        toolStatus: activity.toolStatus,
      })),
      turnPhase,
      streamingLabel,
      actionLabel: statusActionLabel,
    }),
    [liveActivity, messages, sessionTitle, statusActionLabel, streamingLabel, turnPhase],
  );

  const overlayChromeSuppressed = overlayActive;
  const optaMenuAnimationProgress = Math.max(0, Math.min(
    1,
    optaMenuAnimationFrame / OPTA_MENU_ANIMATION_STEPS,
  ));
  const baseMessageAreaHeight = computeMessageAreaHeight(height, safeMode);
  const overlayRecoveryRows = safeMode ? SAFE_OVERLAY_CHROME_RECOVERY_ROWS : OVERLAY_CHROME_RECOVERY_ROWS;
  const messageAreaHeight = Math.max(
    Math.min(
      baseMessageAreaHeight + (overlayChromeSuppressed ? overlayRecoveryRows : 0),
      height,
    ),
    0,
  );
  // Effective message area width: subtract sidebar width + border + padding when visible
  // SplitPane sidebar is 28 cols wide + 2 for border + 2 for paddingX = 32 total
  const SIDEBAR_TOTAL_WIDTH = 32;
  const messageAreaWidth = effectiveSidebarVisible
    ? Math.max(width - SIDEBAR_TOTAL_WIDTH, 40)
    : width;

  const showInsightBlock = messageAreaHeight > 1 && insights.length > 0;
  const showOptimiserPanel = activeOverlay === 'none'
    && !safeMode
    && messageAreaHeight >= 20
    && messageAreaWidth >= 96;
  const reservedRows = (showInsightBlock ? 2 : 0) + (showOptimiserPanel ? 6 : 0);
  const messageViewportHeight = messageAreaHeight > 0
    ? Math.max(messageAreaHeight - 2 - reservedRows, 1)
    : 0;

  const overlayMaxWidth = Math.max(Math.min(messageAreaWidth - 2, width - 4), 24);
  const overlayMaxHeight = Math.max(Math.min(messageAreaHeight - 2, height - 8), 10);

  const mainContent = (
    <Box flexDirection="column" flexGrow={1}>
      <Box
        flexDirection="column"
        height={messageAreaHeight}
        overflow="hidden"
        width="100%"
      >
        {activeOverlay === 'none' ? (
          <>
            {messageViewportHeight > 0 ? (
              <MessageList
                messages={messages}
                height={messageViewportHeight}
                focusable={false}
                terminalWidth={messageAreaWidth}
                thinkingExpanded={thinkingExpanded}
                connectionState={effectiveConnectionState}
                model={currentModel}
                contextTotal={contextUsage.total}
                toolCount={registeredToolCount}
                liveActivity={liveActivity}
                liveStreamingText={liveStreamingText}
                autoFollow={followMode}
                scrollRef={scrollRef}
                safeMode={safeMode}
              />
            ) : null}
            {showInsightBlock ? <InsightBlock insights={insights} /> : null}
            {showOptimiserPanel ? (
              <OptimiserPanel
                goal={optimiserIntent.goal}
                flowSteps={optimiserIntent.flowSteps}
                turnPhase={turnPhase}
                safeMode={safeMode}
              />
            ) : null}
          </>
        ) : (
          <OverlayStack
            activeOverlay={activeOverlay}
            overlayMaxWidth={overlayMaxWidth}
            overlayMaxHeight={overlayMaxHeight}
            closeOverlay={closeOverlay}
            currentModel={currentModel}
            connectionHost={connectionHost}
            connectionFallbackHosts={connectionFallbackHosts}
            connectionPort={connectionPort}
            connectionAdminKey={connectionAdminKey}
            handleModelPickerSelect={handleModelPickerSelect}
            handleSubmit={handleSubmit}
            keybindings={keybindings}
            browserControlPane={browserControlPane}
            pendingBrowserApprovals={pendingBrowserApprovals}
            browserReplaySessionIds={browserReplaySessionIds}
            browserReplayPane={browserReplayPane}
            handleReplaySelectSession={handleReplaySelectSession}
            handleReplayLoadSession={handleReplayLoadSession}
            handleReplaySelectStep={handleReplaySelectStep}
            handleReplaySelectDiff={handleReplaySelectDiff}
            runBrowserControlPaneAction={runBrowserControlPaneAction}
            pruneBrowserControlProfiles={pruneBrowserControlProfiles}
            refreshBrowserControlPane={refreshBrowserControlPane}
            actionHistory={actionHistory}
            handleSettingsSave={handleSettingsSave}
            responseIntentTone={responseIntentTone}
            workflowMode={workflowMode}
            autonomyLevel={autonomyLevel}
            autonomyMode={autonomyMode}
            sidebarVisible={effectiveSidebarVisible}
            safeMode={safeMode}
            bypassPermissions={bypassPermissions}
            followMode={followMode}
            studioConnectivity={studioConnectivity}
            optaMenuAnimationPhase={optaMenuAnimationPhase}
            optaMenuAnimationProgress={optaMenuAnimationProgress}
            optaMenuResults={optaMenuResults}
            activeAgents={activeAgents}
            handleAgentPickerSelect={handleAgentPickerSelect}
            sessionId={sessionId}
            handleSessionResume={handleSessionResume}
            handleSessionDelete={handleSessionDelete}
            handleOptaMenuRunCommand={handleOptaMenuRunCommand}
            handleOpenBrowserControl={handleOpenBrowserControl}
            handleOpenActionHistory={handleOpenActionHistory}
            handleToggleSidebar={handleToggleSidebar}
            handleToggleSafeMode={handleToggleSafeMode}
            handleToggleBypass={handleToggleBypass}
            handleToggleFollow={handleToggleFollow}
            handleAutonomyUp={handleAutonomyUp}
            handleAutonomyDown={handleAutonomyDown}
            handleAutonomyToggleMode={handleAutonomyToggleMode}
            setActiveOverlay={setActiveOverlay}
          />
        )}
      </Box>

      {/* Keybind hints -- visible only when idle */}
      {!overlayChromeSuppressed ? (
        <HintBar
          workflowMode={workflowMode}
          bypassPermissions={bypassPermissions}
          isLoading={isLoading || overlayActive}
          safeMode={safeMode}
        />
      ) : null}

      {/* Permission/input area hidden while overlays are active to avoid layout conflicts. */}
      {!overlayChromeSuppressed ? (
        permissionPending ? (
          <ErrorBoundary label="PermissionPrompt">
            <PermissionPrompt
              toolName={permissionPending.toolName}
              args={permissionPending.args}
              onDecision={permissionPending.resolve}
            />
          </ErrorBoundary>
        ) : (
          <Box>
            <InputBox
              onSubmit={handleSubmit}
              mode="normal"
              workflowMode={workflowMode}
              bypassPermissions={bypassPermissions}
              safeMode={safeMode}
              triggerWords={triggerWords}
              isLoading={isLoading || !!permissionPending || overlayActive}
            />
        </Box>
      )
      ) : null}

      {/* Brief "always allow" confirmation */}
      {alwaysMessage && (
        <Box paddingX={1}>
          <Text color="green">{'\u2714'} {alwaysMessage}</Text>
        </Box>
      )}
    </Box>
  );

  const sidebarContent = (
    <Sidebar
      model={currentModel}
      sessionId={sessionId}
      tokens={{ prompt: promptTokens, completion: completionTokens, total: tokens }}
      tools={toolCallCount}
      cost={cost}
      mode="normal"
      elapsed={elapsed}
      speed={speed}
      title={sessionTitle}
      connectionState={effectiveConnectionState}
      contextUsage={contextUsage}
      liveThinkingText={liveThinkingText}
      liveThinkingTokens={liveThinkingTokens}
      thinkingExpanded={thinkingExpanded}
      thinkingActive={isLoading && (turnPhase === 'waiting' || turnPhase === 'streaming' || turnPhase === 'tool-call')}
    />
  );

  return (
    <Box flexDirection="column" height={height} width="100%">
      <Header
        model={currentModel}
        sessionId={sessionId}
        connectionStatus={connectionStatus}
        title={sessionTitle}
        compact={compactHeader}
        connectionState={effectiveConnectionState}
        safeMode={safeMode}
      />

      <SplitPane
        main={mainContent}
        sidebar={sidebarContent}
        sidebarWidth={28}
        sidebarVisible={effectiveSidebarVisible}
      />

      {!overlayChromeSuppressed ? (
        <BrowserManagerRail
          safeMode={safeMode}
          browserHealth={browserControlPane.health}
          pendingApprovals={pendingBrowserApprovals}
          recentApprovals={browserControlPane.approvals}
          busy={browserControlPane.loading}
          message={browserControlPane.message}
          messageStatus={browserControlPane.messageStatus}
        />
      ) : null}

      {!overlayChromeSuppressed && activeAgents.length > 0 ? (
        <AgentSwarmRail
          agents={activeAgents}
          terminalWidth={width}
          onClear={() => setActiveAgents([])}
        />
      ) : null}

      {showAgentPanel && activeAgents.length > 0 ? (
        <AgentMonitorPanel
          agents={activeAgents}
          onClose={() => setShowAgentPanel(false)}
          height={Math.min(activeAgents.length + 4, Math.floor(height * 0.4))}
        />
      ) : null}

      <InkStatusBar
        model={currentModel}
        tokens={tokens}
        cost={cost}
        tools={toolCallCount}
        speed={speed}
        compact={compactStatus}
        connectionState={effectiveConnectionState}
        turnElapsed={turnElapsed}
        turnPhase={turnPhase}
        promptTokens={promptTokens}
        completionTokens={completionTokens}
        turnCompletionTokens={turnCompletionTokens}
        contextUsed={contextUsage.used}
        contextTotal={contextUsage.total}
        bypassPermissions={bypassPermissions}
        streamingLabel={streamingLabel}
        safeMode={safeMode}
        actionLabel={statusActionLabel}
        actionIcon={statusActionIcon}
        actionStatus={statusActionStatus}
        actionCount={actionHistory.length}
        pendingApprovals={pendingBrowserApprovals.length}
        highRiskPendingApprovals={pendingBrowserApprovals.filter((item) => item.risk === 'high').length}
        mediumRiskPendingApprovals={pendingBrowserApprovals.filter((item) => item.risk === 'medium').length}
        highestPendingApprovalRisk={pendingBrowserApprovals
          .map((item) => item.risk)
          .sort((left, right) => {
            const rank = { low: 1, medium: 2, high: 3 } as const;
            return rank[right] - rank[left];
          })[0]}
        accountUser={accountState?.user ?? null}
        activeHost={connectionHost}
        primaryHost={connectionHost}
        onReconnect={reconnectLmx}
      />
    </Box>
  );
}

export function App(props: AppProps) {
  return <AppInner {...props} />;
}
