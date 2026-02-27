import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { formatTokens } from '../utils/tokens.js';
import { type ConnectionState, connectionDot, shortModelName, contextBar, contextBarColor } from './utils.js';
import { TUI_COLORS } from './palette.js';
import { actionStatusColor, type ActionEventStatus } from './activity.js';
import { OPTA_ORBIT_FRAMES } from '../ui/spinner.js';
import { LAYOUT } from './layout.js';

const STATUS_RING = [...OPTA_ORBIT_FRAMES];
const PHASE_GLYPH: Record<string, string> = {
  waiting: '◍',
  'tool-call': '⚙',
  streaming: '✦',
  connecting: '◌',
};
const PHASE_NEXT_STEP: Record<string, string> = {
  waiting: 'build execution plan',
  'tool-call': 'validate tool result',
  streaming: 'refine final response',
  connecting: 'restore model transport',
};

interface InkStatusBarProps {
  model: string;
  tokens: number;
  cost: string;
  tools: number;
  speed: number;
  mode?: string;
  sessionId?: string;
  /** When true, show only connection dot + model + elapsed (if active). */
  compact?: boolean;
  connectionState?: ConnectionState;
  turnElapsed?: number;
  turnPhase?: string;
  promptTokens?: number;
  completionTokens?: number;
  contextUsed?: number;
  contextTotal?: number;
  bypassPermissions?: boolean;
  /** Label describing the current streaming activity (e.g. "thinking", "running edit_file"). */
  streamingLabel?: string;
  /** Minimal rendering mode for ultra-narrow terminals. */
  safeMode?: boolean;
  /** Live action feed label shown in the center lane. */
  actionLabel?: string;
  /** Emoji/icon for the current action feed item. */
  actionIcon?: string;
  /** Current action status tone for center lane. */
  actionStatus?: ActionEventStatus;
  /** Number of action history entries recorded this session. */
  actionCount?: number;
  /** Count of pending browser approvals across the session. */
  pendingApprovals?: number;
  /** Count of high-risk pending browser approvals. */
  highRiskPendingApprovals?: number;
  /** Count of medium-risk pending browser approvals. */
  mediumRiskPendingApprovals?: number;
  /** Highest current pending approval risk level, if any. */
  highestPendingApprovalRisk?: 'low' | 'medium' | 'high';
  /** Number of completion tokens generated in the active turn. */
  turnCompletionTokens?: number;
  /** Currently authenticated user (from account state). */
  accountUser?: { email?: string; phone?: string } | null;
  /** Currently active LMX host (may differ from primary config if fallback active). */
  activeHost?: string;
  /** Config primary host — used to detect fallback. */
  primaryHost?: string;
  /** Called when user requests reconnect (r key when connection error). */
  onReconnect?: () => void;
}

const ACTIVE_PHASES = new Set(['streaming', 'waiting', 'tool-call', 'connecting']);

export function InkStatusBar({
  model, tokens, cost, speed, mode: _mode, sessionId: _sessionId, compact,
  connectionState, turnElapsed, turnPhase,
  promptTokens, completionTokens,
  contextUsed, contextTotal,
  bypassPermissions,
  streamingLabel = 'thinking',
  safeMode = false,
  actionLabel = 'Idle',
  actionIcon = '🟣',
  actionStatus = 'info',
  actionCount = 0,
  pendingApprovals = 0,
  highRiskPendingApprovals = 0,
  mediumRiskPendingApprovals = 0,
  highestPendingApprovalRisk,
  turnCompletionTokens = 0,
  accountUser,
  activeHost,
  primaryHost,
  onReconnect,
}: InkStatusBarProps) {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? LAYOUT.fallbackColumns;
  const dot = connectionDot(connectionState, true);
  const isActive = turnPhase != null && ACTIVE_PHASES.has(turnPhase);
  const isCompact = compact || safeMode;
  const hasContext = contextUsed != null && contextTotal != null && contextTotal > 0;
  const hasTokenSplit = promptTokens != null && promptTokens > 0;
  const ctxPct = hasContext ? Math.round((contextUsed! / contextTotal!) * 100) : 0;

  // Single shared tick drives both spinner and pulse frames to avoid dual-interval re-renders
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setTick((n) => n + 1), 90);
    return () => clearInterval(t);
  }, [isActive]);

  const spinFrame = tick % STATUS_RING.length;
  const pulseFrame = tick % STATUS_RING.length;

  // Derive a short phase label for the status bar
  const phaseLabel = (() => {
    if (!isActive) return null;
    if (turnPhase === 'waiting') return 'Thinking...';
    if (streamingLabel === 'thinking deeply') return 'Thinking deeply...';
    if (turnPhase === 'tool-call') {
      const toolName = streamingLabel.replace(/^running\s+/, '');
      return toolName;
    }
    if (turnPhase === 'streaming' && streamingLabel === 'thinking') return 'Writing...';
    return streamingLabel;
  })();

  const centerTone = isActive ? TUI_COLORS.accent : actionStatusColor(actionStatus);
  const spinnerColor = isActive ? TUI_COLORS.accent : centerTone;
  const centerLead = isActive ? STATUS_RING[pulseFrame] : '◌';
  const centerMessage = phaseLabel ?? actionLabel;
  const phaseGlyph = isActive ? PHASE_GLYPH[turnPhase ?? ''] ?? '◌' : '';
  const phaseNextStep = isActive ? PHASE_NEXT_STEP[turnPhase ?? ''] : undefined;
  const outputHint = isActive && turnCompletionTokens > 0 ? ` · out ${formatTokens(turnCompletionTokens)}` : '';
  const approvalHint = pendingApprovals > 0
    ? ` · approvals ${pendingApprovals}${highRiskPendingApprovals > 0 ? ` (${highRiskPendingApprovals} high)` : ''}`
    : '';
  const riskHint = pendingApprovals > 0
    ? ` · risk ${highestPendingApprovalRisk ?? 'low'}${mediumRiskPendingApprovals > 0 ? ` (${mediumRiskPendingApprovals} med)` : ''}`
    : '';
  const centerHints = columns >= 120
    ? ` · Shift+Space menu · Ctrl+S settings · Ctrl+E actions (${actionCount})`
    : columns >= 96
      ? ` · Shift+Space menu · Ctrl+S settings · ${actionCount} logs`
      : '';
  const combinedCenterHints = `${outputHint}${centerHints}${approvalHint}${riskHint}`;
  const riskColor = highestPendingApprovalRisk === 'high'
    ? TUI_COLORS.danger
    : highestPendingApprovalRisk === 'medium'
      ? TUI_COLORS.warning
      : highestPendingApprovalRisk === 'low'
        ? TUI_COLORS.success
        : undefined;

  return (
    <Box
      borderStyle={safeMode ? undefined : 'single'}
      borderColor={safeMode ? undefined : (isActive ? TUI_COLORS.border : TUI_COLORS.borderSoft)}
      paddingX={safeMode ? 0 : 1}
      justifyContent="space-between"
      width="100%"
    >
      <Box width="100%" justifyContent="space-between">
        {/* Left: model identity + runtime flags */}
        <Box flexShrink={0}>
          <Text color={dot.color}>{dot.char}</Text>
          <Text> {shortModelName(model)}</Text>
          {bypassPermissions && (
            <>
              <Text dimColor> </Text>
              <Text color={TUI_COLORS.danger} bold>{'⚠ BYPASS'}</Text>
            </>
          )}
          {safeMode && (
            <>
              <Text dimColor> </Text>
              <Text color={TUI_COLORS.warning} bold>SAFE</Text>
            </>
          )}
          {isActive && turnElapsed != null && turnElapsed > 0 && (
            <>
              <Text dimColor> │ </Text>
              <Text dimColor>{'\u23F1'} {turnElapsed.toFixed(1)}s</Text>
            </>
          )}
          {accountUser?.email && (
            <>
              <Text dimColor> │ </Text>
              <Text dimColor>◎ {accountUser.email.length > 20 ? accountUser.email.slice(0, 20) + '\u2026' : accountUser.email}</Text>
            </>
          )}
          {activeHost && primaryHost && activeHost !== primaryHost && (
            <>
              <Text dimColor> </Text>
              <Text color="#f59e0b" bold>(fallback)</Text>
            </>
          )}
        </Box>

        {/* Center: live action feed replacing chat-bottom activity logs */}
        <Box flexGrow={1} justifyContent="center" paddingX={1}>
          <Text color={spinnerColor}>
            {isActive ? STATUS_RING[spinFrame] : centerLead}
          </Text>
          {isActive ? <Text color={spinnerColor}> {phaseGlyph}</Text> : null}
          <Text color={centerTone}> {actionIcon}</Text>
          <Text color={centerTone} wrap="truncate-end"> {centerMessage}</Text>
          {phaseNextStep ? (
            <Text dimColor wrap="truncate-end"> · next {phaseNextStep}</Text>
          ) : null}
          {combinedCenterHints && (
            <Text color={riskColor} dimColor={!riskColor} wrap="truncate-end">{combinedCenterHints}</Text>
          )}
          {connectionState === 'error' && onReconnect && (
            <Text dimColor> · [r] reconnect</Text>
          )}
        </Box>

        {/* Right: context/tokens/cost */}
        {!isCompact && (
          <Box flexShrink={0}>
            {hasContext && (
              <>
                <Text dimColor>CTX </Text>
                <Text color={contextBarColor(contextUsed!, contextTotal!)}>{contextBar(contextUsed!, contextTotal!)}</Text>
                <Text dimColor> {ctxPct}%</Text>
                <Text dimColor> │ </Text>
              </>
            )}
            {hasTokenSplit ? (
              <Text dimColor>{formatTokens(promptTokens!)}{'\u2192'}{formatTokens(completionTokens ?? 0)} tok</Text>
            ) : (
              <Text dimColor>~{formatTokens(tokens)} tok</Text>
            )}
            {speed > 0 && (
              <>
                <Text dimColor> │ </Text>
                <Text dimColor>{speed.toFixed(0)} t/s</Text>
              </>
            )}
            <Text dimColor> │ </Text>
            <Text color={TUI_COLORS.success}>{cost}</Text>
          </Box>
        )}
        {isCompact && (
          <Box flexShrink={0}>
            {hasTokenSplit ? (
              <Text dimColor>{formatTokens(promptTokens!)}{'\u2192'}{formatTokens(completionTokens ?? 0)} tok</Text>
            ) : (
              <Text dimColor>~{formatTokens(tokens)} tok</Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
