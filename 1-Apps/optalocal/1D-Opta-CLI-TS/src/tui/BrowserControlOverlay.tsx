import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { actionStatusColor, type ActionEventStatus } from './activity.js';
import { clamp } from '../utils/common.js';
import { riskColor, riskPriority } from './browser-formatters.js';
import { TUI_COLORS } from './palette.js';
import {
  browserVisualGlyph,
  deriveBrowserVisualState,
  useBrowserVisualTick,
} from './browser-visual-state.js';
import type { BrowserApprovalEvent } from '../browser/approval-log.js';
import type { BrowserControlAction } from '../browser/control-surface.js';
import type { BrowserRiskLevel } from '../browser/policy-engine.js';
import type { BrowserRiskEvidence } from '../browser/policy-engine.js';
import type {
  BrowserReplayStepArtifactPreview,
  BrowserReplayVisualDiffPair,
} from '../browser/replay.js';
import type {
  BrowserRuntimeHealth,
  BrowserRuntimeProfilePruneHealth,
} from '../browser/runtime-daemon.js';
import type { BrowserSessionMetadata, BrowserSessionStepRecord } from '../browser/types.js';

type ReplayFocus = 'sessions' | 'steps';

export interface BrowserPendingApprovalItem {
  requestId: string;
  toolName: string;
  sessionId?: string;
  requestedAt: string;
  risk: BrowserRiskLevel;
  actionKey: string;
  targetHost?: string;
  targetOrigin?: string;
  policyReason?: string;
  riskEvidence?: BrowserRiskEvidence;
}

export interface BrowserControlOverlayProps {
  /** Optional external width cap from parent layout (message pane width). */
  maxWidth?: number;
  /** Optional external height cap from parent layout (message pane height). */
  maxHeight?: number;
  browserHealth?: BrowserRuntimeHealth | null;
  browserApprovals?: BrowserApprovalEvent[];
  pendingApprovals?: BrowserPendingApprovalItem[];
  browserBusy?: boolean;
  browserMessage?: string;
  browserMessageStatus?: ActionEventStatus;
  profileRetentionDays: number;
  profileMaxPersistedProfiles: number;
  profilePersistedCount: number;
  replaySessionIds: string[];
  replaySelectedSessionId?: string | null;
  replayLoading?: boolean;
  replayMessage?: string;
  replayMessageStatus?: ActionEventStatus;
  replayMetadata?: BrowserSessionMetadata | null;
  replaySteps: BrowserSessionStepRecord[];
  replaySelectedStepIndex: number;
  replaySelectedStepPreview?: BrowserReplayStepArtifactPreview | null;
  replayVisualDiffs?: BrowserReplayVisualDiffPair[];
  replaySelectedDiffIndex?: number;
  onReplaySelectSession: (sessionId: string) => void;
  onReplayLoadSession: (sessionId: string) => void;
  onReplaySelectStep: (index: number) => void;
  onReplaySelectDiff?: (index: number) => void;
  onBrowserControlAction: (action: BrowserControlAction) => void;
  onBrowserPruneProfiles: () => void;
  onBrowserRefresh: () => void;
  onClose: () => void;
}

function compactApprovalTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp.length > 19 ? timestamp.slice(0, 19) : timestamp;
  }
  return date.toISOString().slice(5, 19).replace('T', ' ');
}

function compactStepTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp.length > 19 ? timestamp.slice(0, 19) : timestamp;
  }
  return date.toISOString().slice(11, 19);
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KiB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatAgeLabel(fromTimestamp: string, nowMs: number): string {
  const startedAt = Date.parse(fromTimestamp);
  if (!Number.isFinite(startedAt)) return '?';
  const diffSeconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
  return `${Math.floor(diffSeconds / 3600)}h`;
}

interface AgeDisplayProps {
  fromTimestamp: string;
}

function AgeDisplay({ fromTimestamp }: AgeDisplayProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1_000);
    (t as unknown as { unref?: () => void }).unref?.();
    return () => clearInterval(t);
  }, []);
  return <Text>{formatAgeLabel(fromTimestamp, nowMs)}</Text>;
}

function formatPruneInterval(intervalMs: number | undefined): string {
  if (typeof intervalMs !== 'number' || intervalMs <= 0) return '-';
  const hours = intervalMs / (60 * 60 * 1_000);
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

function formatPruneSummary(prune: BrowserRuntimeProfilePruneHealth | undefined): string {
  if (!prune || !prune.enabled) {
    return 'auto-prune disabled';
  }
  if (!prune.lastRunAt || !prune.lastStatus) {
    return `auto-prune every ${formatPruneInterval(prune.intervalMs)} · last run never`;
  }
  const counts = (
    typeof prune.lastListedCount === 'number' &&
    typeof prune.lastKeptCount === 'number' &&
    typeof prune.lastPrunedCount === 'number'
  )
    ? ` · listed=${prune.lastListedCount} kept=${prune.lastKeptCount} pruned=${prune.lastPrunedCount}`
    : '';
  return `auto-prune every ${formatPruneInterval(prune.intervalMs)} · ${prune.lastStatus} ${compactApprovalTimestamp(prune.lastRunAt)} (${prune.lastReason ?? '-'})${counts}`;
}

function formatByteRatio(changedByteRatio: number | undefined): string | null {
  if (typeof changedByteRatio !== 'number' || !Number.isFinite(changedByteRatio)) return null;
  return `${(changedByteRatio * 100).toFixed(1)}%`;
}

function diffRegressionColor(signal: BrowserReplayVisualDiffPair['regressionSignal']): string {
  switch (signal) {
    case 'regression':
      return TUI_COLORS.danger;
    case 'investigate':
      return TUI_COLORS.warning;
    default:
      return TUI_COLORS.success;
  }
}

function diffSeverityColor(severity: BrowserReplayVisualDiffPair['severity']): string {
  switch (severity) {
    case 'high':
      return TUI_COLORS.danger;
    case 'medium':
      return TUI_COLORS.warning;
    default:
      return TUI_COLORS.success;
  }
}

export function BrowserControlOverlay({
  maxWidth,
  maxHeight,
  browserHealth = null,
  browserApprovals = [],
  pendingApprovals = [],
  browserBusy = false,
  browserMessage = '',
  browserMessageStatus = 'info',
  profileRetentionDays,
  profileMaxPersistedProfiles,
  profilePersistedCount,
  replaySessionIds,
  replaySelectedSessionId = null,
  replayLoading = false,
  replayMessage = '',
  replayMessageStatus = 'info',
  replayMetadata = null,
  replaySteps,
  replaySelectedStepIndex,
  replaySelectedStepPreview = null,
  replayVisualDiffs = [],
  replaySelectedDiffIndex = 0,
  onReplaySelectSession,
  onReplayLoadSession,
  onReplaySelectStep,
  onReplaySelectDiff,
  onBrowserControlAction,
  onBrowserPruneProfiles,
  onBrowserRefresh,
  onClose,
}: BrowserControlOverlayProps) {
  const [focus, setFocus] = useState<ReplayFocus>('sessions');
  const [sessionIndex, setSessionIndex] = useState(0);
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 36;
  const rows = Math.max(12, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(78, Math.min(136, columns - 8));
  const width = Math.min(preferred, hardMax);
  const maxSessionsRows = Math.max(3, Math.min(6, rows - 30));
  const maxStepRows = Math.max(4, Math.min(9, rows - 28));
  const maxDiffRows = Math.max(3, Math.min(7, rows - 30));

  useEffect(() => {
    if (replaySessionIds.length === 0) {
      setSessionIndex(0);
      return;
    }

    const fallback = replaySessionIds[0]!;
    const selected = replaySelectedSessionId && replaySessionIds.includes(replaySelectedSessionId)
      ? replaySelectedSessionId
      : fallback;
    const idx = replaySessionIds.indexOf(selected);
    setSessionIndex((prev) => (prev === idx ? prev : idx));
    if (selected !== replaySelectedSessionId) {
      onReplaySelectSession(selected);
    }
  }, [onReplaySelectSession, replaySelectedSessionId, replaySessionIds]);

  useEffect(() => {
    if (replaySteps.length === 0) return;
    const clamped = clamp(replaySelectedStepIndex, 0, replaySteps.length - 1);
    if (clamped !== replaySelectedStepIndex) {
      onReplaySelectStep(clamped);
    }
  }, [onReplaySelectStep, replaySelectedStepIndex, replaySteps.length]);

  useEffect(() => {
    if (!onReplaySelectDiff) return;
    if (replayVisualDiffs.length === 0) return;
    const clamped = clamp(replaySelectedDiffIndex, 0, replayVisualDiffs.length - 1);
    if (clamped !== replaySelectedDiffIndex) {
      onReplaySelectDiff(clamped);
    }
  }, [onReplaySelectDiff, replaySelectedDiffIndex, replayVisualDiffs.length]);

  const sessionWindow = useMemo(() => {
    if (replaySessionIds.length <= maxSessionsRows) {
      return { start: 0, end: replaySessionIds.length };
    }
    const half = Math.floor(maxSessionsRows / 2);
    let start = Math.max(0, sessionIndex - half);
    let end = start + maxSessionsRows;
    if (end > replaySessionIds.length) {
      end = replaySessionIds.length;
      start = Math.max(0, end - maxSessionsRows);
    }
    return { start, end };
  }, [maxSessionsRows, replaySessionIds.length, sessionIndex]);

  const stepWindow = useMemo(() => {
    if (replaySteps.length <= maxStepRows) {
      return { start: 0, end: replaySteps.length };
    }
    const half = Math.floor(maxStepRows / 2);
    let start = Math.max(0, replaySelectedStepIndex - half);
    let end = start + maxStepRows;
    if (end > replaySteps.length) {
      end = replaySteps.length;
      start = Math.max(0, end - maxStepRows);
    }
    return { start, end };
  }, [maxStepRows, replaySelectedStepIndex, replaySteps.length]);

  const diffWindow = useMemo(() => {
    if (replayVisualDiffs.length <= maxDiffRows) {
      return { start: 0, end: replayVisualDiffs.length };
    }
    const half = Math.floor(maxDiffRows / 2);
    let start = Math.max(0, replaySelectedDiffIndex - half);
    let end = start + maxDiffRows;
    if (end > replayVisualDiffs.length) {
      end = replayVisualDiffs.length;
      start = Math.max(0, end - maxDiffRows);
    }
    return { start, end };
  }, [maxDiffRows, replaySelectedDiffIndex, replayVisualDiffs.length]);

  const orderedPendingApprovals = useMemo(
    () => [...pendingApprovals].sort((left, right) => {
      const byRisk = riskPriority(right.risk) - riskPriority(left.risk);
      if (byRisk !== 0) return byRisk;
      return left.requestedAt.localeCompare(right.requestedAt);
    }),
    [pendingApprovals],
  );
  const runtimeVisualState = useMemo(
    () => deriveBrowserVisualState({
      browserHealth,
      pendingApprovals: orderedPendingApprovals,
      busy: browserBusy,
    }),
    [browserBusy, browserHealth, orderedPendingApprovals],
  );
  const runtimeVisualTick = useBrowserVisualTick(true);
  const runtimeVisualGlyph = browserVisualGlyph(runtimeVisualState.kind, runtimeVisualTick);

  useInput((input, key) => {
    if (!key.ctrl && !key.meta && !key.shift) {
      if (input === '1') {
        onBrowserControlAction('start');
        return;
      }
      if (input === '2') {
        onBrowserControlAction('pause');
        return;
      }
      if (input === '3') {
        onBrowserControlAction('resume');
        return;
      }
      if (input === '4') {
        onBrowserControlAction('stop');
        return;
      }
      if (input === '5') {
        onBrowserControlAction('kill');
        return;
      }
      if (input.toLowerCase() === 'x') {
        onBrowserPruneProfiles();
        return;
      }
      if (input.toLowerCase() === 'l') {
        const sessionId = replaySessionIds[sessionIndex];
        if (sessionId) {
          onReplayLoadSession(sessionId);
        }
        return;
      }
      if (input.toLowerCase() === 'j' && replaySteps.length > 0) {
        onReplaySelectStep(clamp(replaySelectedStepIndex + 1, 0, replaySteps.length - 1));
        return;
      }
      if (input.toLowerCase() === 'k' && replaySteps.length > 0) {
        onReplaySelectStep(clamp(replaySelectedStepIndex - 1, 0, replaySteps.length - 1));
        return;
      }
      if (input.toLowerCase() === 'n' && replayVisualDiffs.length > 0 && onReplaySelectDiff) {
        onReplaySelectDiff(clamp(replaySelectedDiffIndex + 1, 0, replayVisualDiffs.length - 1));
        return;
      }
      if (input.toLowerCase() === 'p' && replayVisualDiffs.length > 0 && onReplaySelectDiff) {
        onReplaySelectDiff(clamp(replaySelectedDiffIndex - 1, 0, replayVisualDiffs.length - 1));
        return;
      }
    }

    if (key.ctrl && !key.meta && input.toLowerCase() === 'r') {
      onBrowserRefresh();
      return;
    }

    if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
      onClose();
      return;
    }

    if (key.leftArrow || key.backspace || key.delete) {
      onClose();
      return;
    }

    if (key.tab) {
      setFocus((prev) => (prev === 'sessions' ? 'steps' : 'sessions'));
      return;
    }

    if (key.return) {
      const sessionId = replaySessionIds[sessionIndex];
      if (sessionId) {
        onReplayLoadSession(sessionId);
      }
      return;
    }

    if (key.upArrow) {
      if (focus === 'sessions') {
        const next = clamp(sessionIndex - 1, 0, Math.max(replaySessionIds.length - 1, 0));
        if (next !== sessionIndex) {
          setSessionIndex(next);
          const sessionId = replaySessionIds[next];
          if (sessionId) onReplaySelectSession(sessionId);
        }
      } else if (replaySteps.length > 0) {
        onReplaySelectStep(clamp(replaySelectedStepIndex - 1, 0, replaySteps.length - 1));
      }
      return;
    }

    if (key.downArrow) {
      if (focus === 'sessions') {
        const next = clamp(sessionIndex + 1, 0, Math.max(replaySessionIds.length - 1, 0));
        if (next !== sessionIndex) {
          setSessionIndex(next);
          const sessionId = replaySessionIds[next];
          if (sessionId) onReplaySelectSession(sessionId);
        }
      } else if (replaySteps.length > 0) {
        onReplaySelectStep(clamp(replaySelectedStepIndex + 1, 0, replaySteps.length - 1));
      }
    }
  });

  const selectedStep = replaySteps[replaySelectedStepIndex];
  const selectedStepPreview = (
    selectedStep &&
    replaySelectedStepPreview &&
    replaySelectedStepPreview.sequence === selectedStep.sequence
  ) ? replaySelectedStepPreview : null;
  const selectedDiff = replayVisualDiffs[replaySelectedDiffIndex];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={TUI_COLORS.accent}
      width={width}
      paddingX={2}
      paddingY={1}
      overflow="hidden"
    >
      <Box justifyContent="space-between">
        <Text color={TUI_COLORS.accent} bold>{'🌐'} Browser Control Workspace</Text>
        <Text dimColor>Esc close</Text>
      </Box>

      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>{'↑↓'} navigate · j/k scrub step · n/p diff pair · Tab switch sessions/steps · Enter/L load replay · 1 start · 2 pause · 3 resume · 4 stop · 5 kill · x prune · Ctrl+R refresh</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={TUI_COLORS.accentSoft} bold>Browser Runtime</Text>
        <Text color={runtimeVisualState.color} wrap="truncate-end">
          {runtimeVisualGlyph} state={runtimeVisualState.label} · {runtimeVisualState.reason}
        </Text>
        {browserHealth ? (
          <Text dimColor>
            running={String(browserHealth.running)} paused={String(browserHealth.paused)} killed={String(browserHealth.killed)} sessions={browserHealth.sessionCount}/{browserHealth.maxSessions}
          </Text>
        ) : (
          <Text dimColor>Runtime status unavailable.</Text>
        )}
        {browserHealth?.sessions.slice(0, 2).map((session) => (
          <Text key={session.sessionId} dimColor wrap="truncate-end">
            {session.sessionId.slice(0, 10)} · {session.status} · {session.runtime} · {session.currentUrl ?? '(no url)'}
          </Text>
        ))}
        {browserBusy && <Text color={TUI_COLORS.warning}>Refreshing browser runtime...</Text>}
        {browserMessage && (
          <Text color={actionStatusColor(browserMessageStatus)} wrap="truncate-end">
            {browserMessage}
          </Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={TUI_COLORS.accentSoft} bold>Profile Store</Text>
        <Text dimColor>
          policy: retentionDays={profileRetentionDays} maxPersistedProfiles={profileMaxPersistedProfiles}
        </Text>
        <Text dimColor>persisted={profilePersistedCount} · press x to prune with policy</Text>
        <Text dimColor wrap="truncate-end">{formatPruneSummary(browserHealth?.profilePrune)}</Text>
        {browserHealth?.profilePrune?.lastStatus === 'error' && browserHealth.profilePrune.lastError && (
          <Text color={TUI_COLORS.danger} wrap="truncate-end">
            prune error: {browserHealth.profilePrune.lastError}
          </Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={TUI_COLORS.accentSoft} bold>Pending Approvals</Text>
        {orderedPendingApprovals.length === 0 ? (
          <Text dimColor>No pending browser approval requests.</Text>
        ) : (
          orderedPendingApprovals.slice(0, 4).map((pending) => {
            const sessionShort = pending.sessionId ? pending.sessionId.slice(0, 8) : '-';
            const target = pending.targetHost ?? pending.targetOrigin ?? '-';
            return (
              <Box key={pending.requestId}>
                <Text dimColor><AgeDisplay fromTimestamp={pending.requestedAt} /></Text>
                <Text dimColor> · </Text>
                <Text color={riskColor(pending.risk)}>{pending.risk}</Text>
                <Text dimColor> · </Text>
                <Text color={TUI_COLORS.accentSoft}>{pending.toolName}</Text>
                <Text dimColor> · {pending.actionKey}</Text>
                <Text dimColor> · s:{sessionShort}</Text>
                <Text dimColor> · {target}</Text>
              </Box>
            );
          })
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={TUI_COLORS.accentSoft} bold>Recent Approvals</Text>
        {browserApprovals.length === 0 ? (
          <Text dimColor>No browser approval events found.</Text>
        ) : (
          browserApprovals.slice(0, 4).map((event, idx) => {
            const decisionColor = event.decision === 'approved' ? TUI_COLORS.success : TUI_COLORS.danger;
            const sessionShort = event.sessionId ? event.sessionId.slice(0, 8) : '-';
            return (
              <Box key={`${event.timestamp}-${event.tool}-${event.sessionId ?? idx}`}>
                <Text dimColor>{compactApprovalTimestamp(event.timestamp)}</Text>
                <Text color={decisionColor}> {event.decision}</Text>
                <Text dimColor> · </Text>
                <Text color={TUI_COLORS.accentSoft}>{event.tool}</Text>
                <Text dimColor> · s:{sessionShort}</Text>
              </Box>
            );
          })
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={focus === 'sessions' ? TUI_COLORS.accentSoft : TUI_COLORS.accent} bold>Replay Sessions</Text>
        {replaySessionIds.length === 0 ? (
          <Text dimColor>No session ids discovered yet. Trigger browser tools or refresh runtime first.</Text>
        ) : (
          <>
            {sessionWindow.start > 0 && <Text dimColor>… {sessionWindow.start} above …</Text>}
            {replaySessionIds.slice(sessionWindow.start, sessionWindow.end).map((sessionId, idx) => {
              const absoluteIndex = sessionWindow.start + idx;
              const active = absoluteIndex === sessionIndex;
              return (
                <Box key={sessionId}>
                  <Text color={active ? TUI_COLORS.accentSoft : undefined}>{active ? '▶ ' : '  '}</Text>
                  <Text bold={active}>{sessionId}</Text>
                </Box>
              );
            })}
            {sessionWindow.end < replaySessionIds.length && (
              <Text dimColor>… {replaySessionIds.length - sessionWindow.end} below …</Text>
            )}
          </>
        )}
        {replayMetadata && (
          <Text dimColor wrap="truncate-end">
            Loaded: status={replayMetadata.status} runtime={replayMetadata.runtime} updated={compactApprovalTimestamp(replayMetadata.updatedAt)}
          </Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={focus === 'steps' ? TUI_COLORS.accentSoft : TUI_COLORS.accent} bold>Replay Steps</Text>
        {replayLoading && <Text color={TUI_COLORS.warning}>Loading replay...</Text>}
        {replayMessage && (
          <Text color={actionStatusColor(replayMessageStatus)} wrap="truncate-end">
            {replayMessage}
          </Text>
        )}
        {replaySteps.length === 0 ? (
          <Text dimColor>No replay steps loaded.</Text>
        ) : (
          <>
            {stepWindow.start > 0 && <Text dimColor>… {stepWindow.start} above …</Text>}
            {replaySteps.slice(stepWindow.start, stepWindow.end).map((step, idx) => {
              const absoluteIndex = stepWindow.start + idx;
              const active = absoluteIndex === replaySelectedStepIndex;
              const outcome = step.ok ? 'ok' : 'fail';
              const outcomeColor = step.ok ? TUI_COLORS.success : TUI_COLORS.danger;
              return (
                <Box key={`${step.sequence}-${step.actionId}`}>
                  <Text color={active ? TUI_COLORS.accentSoft : undefined}>{active ? '▶ ' : '  '}</Text>
                  <Text dimColor>#{step.sequence} </Text>
                  <Text color={active ? TUI_COLORS.accentSoft : undefined}>{step.actionType}</Text>
                  <Text dimColor> @ {compactStepTimestamp(step.timestamp)} · </Text>
                  <Text color={outcomeColor}>{outcome}</Text>
                </Box>
              );
            })}
            {stepWindow.end < replaySteps.length && (
              <Text dimColor>… {replaySteps.length - stepWindow.end} below …</Text>
            )}
          </>
        )}
        {selectedStepPreview?.artifacts[0] && (
          <Text dimColor wrap="truncate-end">
            preview: {selectedStepPreview.artifacts[0].path}
            {selectedStepPreview.artifacts[0].mimeType ? ` · ${selectedStepPreview.artifacts[0].mimeType}` : ''}
            {typeof selectedStepPreview.artifacts[0].sizeBytes === 'number'
              ? ` · ${formatBytes(selectedStepPreview.artifacts[0].sizeBytes)}`
              : ''}
            {(typeof selectedStepPreview.artifacts[0].imageWidth === 'number' && typeof selectedStepPreview.artifacts[0].imageHeight === 'number')
              ? ` · ${selectedStepPreview.artifacts[0].imageWidth}x${selectedStepPreview.artifacts[0].imageHeight}`
              : ''}
          </Text>
        )}
        {selectedStepPreview?.artifacts[0]?.htmlSnippet && (
          <Text dimColor wrap="truncate-end">
            html: {selectedStepPreview.artifacts[0].htmlSnippet}
          </Text>
        )}
        {selectedStepPreview?.artifacts[0]?.textSnippet && (
          <Text dimColor wrap="truncate-end">
            text: {selectedStepPreview.artifacts[0].textSnippet}
          </Text>
        )}
        {(selectedStepPreview?.artifacts[0]?.inlinePreview?.length ?? 0) > 0 && (
          <Box flexDirection="column">
            {selectedStepPreview!.artifacts[0]!.inlinePreview!.slice(0, 6).map((line, index) => (
              <Text key={`preview-inline-${index}`} dimColor>{line}</Text>
            ))}
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={TUI_COLORS.accent} bold>Visual Diff Summary</Text>
        {replayVisualDiffs.length === 0 ? (
          <Text dimColor>No consecutive screenshot pairs found.</Text>
        ) : (
          <>
            {diffWindow.start > 0 && <Text dimColor>... {diffWindow.start} above ...</Text>}
            {replayVisualDiffs.slice(diffWindow.start, diffWindow.end).map((diff, idx) => {
              const absoluteIndex = diffWindow.start + idx;
              const active = absoluteIndex === replaySelectedDiffIndex;
              const statusColor = diffSeverityColor(diff.severity);
              const ratio = formatByteRatio(diff.changedByteRatio);
              const perceptual = formatByteRatio(diff.perceptualDiffScore);
              const regressionScore = formatByteRatio(diff.regressionScore);
              return (
                <Box key={`diff-${diff.index}-${diff.fromSequence}-${diff.toSequence}`}>
                  <Text color={active ? TUI_COLORS.accentSoft : undefined}>{active ? '▶ ' : '  '}</Text>
                  <Text dimColor>{`#${diff.fromSequence}->#${diff.toSequence} `}</Text>
                  <Text color={statusColor}>{diff.status}</Text>
                  <Text dimColor>{` · ${diff.severity}`}</Text>
                  {ratio && <Text dimColor>{` · ${ratio}`}</Text>}
                  {perceptual && <Text dimColor>{` · p=${perceptual}`}</Text>}
                  {regressionScore && <Text dimColor>{` · r=${regressionScore}`}</Text>}
                  {diff.regressionSignal && (
                    <Text color={diffRegressionColor(diff.regressionSignal)}>{` · ${diff.regressionSignal}`}</Text>
                  )}
                </Box>
              );
            })}
            {diffWindow.end < replayVisualDiffs.length && (
              <Text dimColor>... {replayVisualDiffs.length - diffWindow.end} below ...</Text>
            )}
          </>
        )}
        {selectedDiff && (
          <>
            <Text dimColor wrap="truncate-end">
              from: {selectedDiff.fromScreenshotPath ?? '(missing screenshot)'}
            </Text>
            <Text dimColor wrap="truncate-end">
              to: {selectedDiff.toScreenshotPath ?? '(missing screenshot)'}
            </Text>
            <Text dimColor wrap="truncate-end">
              status: {selectedDiff.status} · severity: {selectedDiff.severity}
              {formatByteRatio(selectedDiff.changedByteRatio) ? ` · changed=${formatByteRatio(selectedDiff.changedByteRatio)}` : ''}
              {formatByteRatio(selectedDiff.perceptualDiffScore) ? ` · perceptual=${formatByteRatio(selectedDiff.perceptualDiffScore)}` : ''}
              {formatByteRatio(selectedDiff.regressionScore) ? ` · regression=${formatByteRatio(selectedDiff.regressionScore)}` : ''}
              {selectedDiff.regressionSignal ? ` · signal=${selectedDiff.regressionSignal}` : ''}
            </Text>
          </>
        )}
      </Box>

      {selectedStep && (
        <Box flexDirection="column">
          <Text dimColor>Selected Step</Text>
          <Text>
            #{selectedStep.sequence} {selectedStep.actionType} · {selectedStep.timestamp}
          </Text>
          <Text color={selectedStep.ok ? TUI_COLORS.success : TUI_COLORS.danger}>
            {selectedStep.ok ? 'success' : 'failure'}
          </Text>
          {(selectedStepPreview?.artifacts.length ?? selectedStep.artifactPaths.length) === 0 ? (
            <Text dimColor>No artifacts.</Text>
          ) : selectedStepPreview ? (
            selectedStepPreview.artifacts.slice(0, 4).map((artifact) => (
              <Box key={`${selectedStep.sequence}:${artifact.path}`} flexDirection="column">
                <Text dimColor wrap="truncate-end">
                  {artifact.path}
                  {artifact.mimeType ? ` · ${artifact.mimeType}` : ''}
                  {typeof artifact.sizeBytes === 'number' ? ` · ${formatBytes(artifact.sizeBytes)}` : ''}
                </Text>
                {artifact.htmlSnippet && (
                  <Text dimColor wrap="truncate-end">
                    html: {artifact.htmlSnippet}
                  </Text>
                )}
                {artifact.textSnippet && (
                  <Text dimColor wrap="truncate-end">
                    text: {artifact.textSnippet}
                  </Text>
                )}
                {(artifact.inlinePreview?.length ?? 0) > 0 && (
                  <Box flexDirection="column">
                    {artifact.inlinePreview!.slice(0, 6).map((line, index) => (
                      <Text key={`${selectedStep.sequence}:${artifact.path}:inline:${index}`} dimColor>{line}</Text>
                    ))}
                  </Box>
                )}
              </Box>
            ))
          ) : (
            selectedStep.artifactPaths.slice(0, 4).map((artifactPath) => (
              <Text key={artifactPath} dimColor wrap="truncate-end">
                {artifactPath}
              </Text>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
