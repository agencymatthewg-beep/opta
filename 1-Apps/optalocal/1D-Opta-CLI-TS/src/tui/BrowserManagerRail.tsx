import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { BrowserApprovalEvent } from '../browser/approval-log.js';
import type { BrowserRuntimeHealth } from '../browser/runtime-daemon.js';
import type { BrowserPendingApprovalItem } from './BrowserControlOverlay.js';
import { actionStatusColor, type ActionEventStatus } from './activity.js';
import { TUI_COLORS } from './palette.js';
import { riskColor, riskPriority } from './browser-formatters.js';

interface BrowserManagerRailProps {
  safeMode?: boolean;
  browserHealth: BrowserRuntimeHealth | null;
  pendingApprovals: BrowserPendingApprovalItem[];
  recentApprovals: BrowserApprovalEvent[];
  busy: boolean;
  message: string;
  messageStatus: ActionEventStatus;
}

function summarizePendingByRisk(pending: BrowserPendingApprovalItem[]): {
  total: number;
  high: number;
  medium: number;
  low: number;
} {
  return pending.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item.risk === 'high') summary.high += 1;
      else if (item.risk === 'medium') summary.medium += 1;
      else summary.low += 1;
      return summary;
    },
    { total: 0, high: 0, medium: 0, low: 0 },
  );
}

function approvalDecisionSummary(events: BrowserApprovalEvent[]): { approved: number; denied: number } {
  return events.reduce(
    (summary, event) => {
      if (event.decision === 'approved') summary.approved += 1;
      else summary.denied += 1;
      return summary;
    },
    { approved: 0, denied: 0 },
  );
}

function trimMessage(message: string): string {
  const normalized = message.trim();
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 137)}...`;
}

export function BrowserManagerRail({
  safeMode = false,
  browserHealth,
  pendingApprovals,
  recentApprovals,
  busy,
  message,
  messageStatus,
}: BrowserManagerRailProps) {
  const pendingOrdered = useMemo(
    () => [...pendingApprovals]
      .sort((left, right) => {
        const byRisk = riskPriority(right.risk) - riskPriority(left.risk);
        if (byRisk !== 0) return byRisk;
        return left.requestedAt.localeCompare(right.requestedAt);
      }),
    [pendingApprovals],
  );

  const pendingSummary = useMemo(
    () => summarizePendingByRisk(pendingOrdered),
    [pendingOrdered],
  );
  const approvalSummary = useMemo(
    () => approvalDecisionSummary(recentApprovals),
    [recentApprovals],
  );
  const highestPendingRisk = pendingOrdered[0]?.risk;
  const runtimeLabel = browserHealth
    ? `running=${String(browserHealth.running)} paused=${String(browserHealth.paused)} killed=${String(browserHealth.killed)} sessions=${browserHealth.sessionCount}/${browserHealth.maxSessions}`
    : 'runtime=unavailable';
  const topPending = pendingOrdered[0];

  if (safeMode) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={highestPendingRisk ? riskColor(highestPendingRisk) : TUI_COLORS.warning}>
          🌐 Browser controls: Ctrl+P pause/resume · Ctrl+X kill · Ctrl+R refresh
        </Text>
        <Text dimColor wrap="truncate-end">
          pending={pendingSummary.total} (high={pendingSummary.high}, med={pendingSummary.medium}, low={pendingSummary.low})
          {' · '}
          approvals approved={approvalSummary.approved} denied={approvalSummary.denied}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={highestPendingRisk ? riskColor(highestPendingRisk) : TUI_COLORS.accent}>
        🌐 Browser Manager Rail · Ctrl+P pause/resume · Ctrl+X kill · Ctrl+R refresh
      </Text>
      <Text dimColor wrap="truncate-end">
        {runtimeLabel}
        {' · '}
        pending={pendingSummary.total} (high={pendingSummary.high}, med={pendingSummary.medium}, low={pendingSummary.low})
        {' · '}
        approvals approved={approvalSummary.approved} denied={approvalSummary.denied}
        {busy ? ' · refreshing' : ''}
      </Text>
      <Box>
        {topPending ? (
          <>
            <Text color={riskColor(topPending.risk)}>
              top pending: {topPending.risk} {topPending.toolName}/{topPending.actionKey}
            </Text>
            <Text dimColor>
              {' · '}
              {topPending.targetHost ?? topPending.targetOrigin ?? '-'}
            </Text>
          </>
        ) : (
          <Text dimColor>No pending browser approvals.</Text>
        )}
        {message.trim().length > 0 && (
          <Text color={actionStatusColor(messageStatus)} dimColor={!topPending} wrap="truncate-end">
            {' · '}
            {trimMessage(message)}
          </Text>
        )}
      </Box>
    </Box>
  );
}
