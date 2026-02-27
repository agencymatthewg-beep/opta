import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { ActionEvent } from './activity.js';
import { actionStatusColor, formatActionTimestamp } from './activity.js';
import { fitTextToWidth } from '../utils/terminal-layout.js';
import { TUI_COLORS } from './palette.js';
import type { BrowserApprovalEvent } from '../browser/approval-log.js';
import type { BrowserControlAction } from '../browser/control-surface.js';
import type { BrowserRuntimeHealth } from '../browser/runtime-daemon.js';
import type { ActionEventStatus } from './activity.js';

export interface ActionHistoryOverlayProps {
  history: ActionEvent[];
  /** Optional external width cap from parent layout (message pane width). */
  maxWidth?: number;
  /** Optional external height cap from parent layout (message pane height). */
  maxHeight?: number;
  browserHealth?: BrowserRuntimeHealth | null;
  browserApprovals?: BrowserApprovalEvent[];
  browserBusy?: boolean;
  browserMessage?: string;
  browserMessageStatus?: ActionEventStatus;
  onBrowserControlAction?: (action: BrowserControlAction) => void;
  onBrowserRefresh?: () => void;
  onClose: () => void;
}

function compactApprovalTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp.length > 19 ? timestamp.slice(0, 19) : timestamp;
  }
  return date.toISOString().slice(5, 19).replace('T', ' ');
}

export function ActionHistoryOverlay({
  history,
  maxWidth,
  maxHeight,
  browserHealth = null,
  browserApprovals = [],
  browserBusy = false,
  browserMessage = '',
  browserMessageStatus = 'info',
  onBrowserControlAction,
  onBrowserRefresh,
  onClose,
}: ActionHistoryOverlayProps) {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 36;
  const rows = Math.max(12, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(70, Math.min(136, columns - 8));
  const width = Math.min(preferred, hardMax);
  const maxRows = Math.max(3, Math.min(10, rows - 22));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return history;
    return history.filter((entry) => {
      const haystack = [
        entry.label,
        entry.detail ?? '',
        entry.sessionId,
        entry.kind,
        entry.status,
        formatActionTimestamp(entry.at),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [history, query]);

  useEffect(() => {
    setSelected((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const windowed = useMemo(() => {
    if (filtered.length <= maxRows) return { start: 0, end: filtered.length };
    const half = Math.floor(maxRows / 2);
    let start = Math.max(0, selected - half);
    let end = start + maxRows;
    if (end > filtered.length) {
      end = filtered.length;
      start = Math.max(0, end - maxRows);
    }
    return { start, end };
  }, [filtered.length, maxRows, selected]);

  useInput((input, key) => {
    if (!key.ctrl && !key.meta && !key.shift) {
      if (input === '1' && onBrowserControlAction) {
        onBrowserControlAction('status');
        return;
      }
      if (input === '2' && onBrowserControlAction) {
        onBrowserControlAction('pause');
        return;
      }
      if (input === '3' && onBrowserControlAction) {
        onBrowserControlAction('resume');
        return;
      }
      if (input === '4' && onBrowserControlAction) {
        onBrowserControlAction('stop');
        return;
      }
      if (input === '5' && onBrowserControlAction) {
        onBrowserControlAction('kill');
        return;
      }
    }

    if (key.ctrl && !key.meta && input.toLowerCase() === 'r' && onBrowserRefresh) {
      onBrowserRefresh();
      return;
    }

    if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
      onClose();
      return;
    }
    if (query.length > 0 && (key.backspace || key.delete)) {
      setQuery((prev) => prev.slice(0, -1));
      return;
    }
    if (query.length > 0 && key.leftArrow) {
      return;
    }
    if (key.leftArrow || key.backspace || key.delete) {
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelected((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((prev) => Math.min(Math.max(filtered.length - 1, 0), prev + 1));
      return;
    }
    if (
      input &&
      !key.ctrl &&
      !key.meta &&
      !key.return &&
      !key.tab &&
      !key.escape
    ) {
      const appended = input.replace(/\r/g, '').replace(/\n/g, '');
      if (!appended) return;
      setQuery((prev) => `${prev}${appended}`.slice(0, 64));
    }
  });

  const selectedItem = filtered[selected];

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
        <Text color={TUI_COLORS.accent} bold>{'🟣'} Browser Control + Actions History</Text>
        <Text dimColor>Ctrl+E/Esc close</Text>
      </Box>
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>{'↑↓'} scroll · 1-5 control runtime · Ctrl+R refresh approvals · type to filter actions</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        <Text color={TUI_COLORS.accentSoft} bold>Browser Runtime</Text>
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
        <Text dimColor>Keys: 1 status · 2 pause · 3 resume · 4 stop · 5 kill · Ctrl+R refresh</Text>
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
      <Box marginBottom={1}>
        <Text color={TUI_COLORS.accentSoft}>Search:</Text>
        <Text> {query || 'all entries'}</Text>
      </Box>

      {history.length === 0 && (
        <Text dimColor>No action history yet. Start a turn or open a tool to populate this timeline.</Text>
      )}
      {history.length > 0 && filtered.length === 0 && (
        <Text dimColor>No entries match "{query}".</Text>
      )}

      {filtered.length > 0 && windowed.start > 0 && (
        <Text dimColor>… {windowed.start} older entries above …</Text>
      )}

      {filtered.slice(windowed.start, windowed.end).map((entry, idx) => {
        const absoluteIdx = windowed.start + idx;
        const active = absoluteIdx === selected;
        const marker = active ? '▶' : ' ';
        const tone = actionStatusColor(entry.status);
        const sessionShort = entry.sessionId.slice(0, 8);
        const head = `${entry.icon} ${entry.label}`;
        const detail = entry.detail ? ` · ${entry.detail}` : '';
        const body = fitTextToWidth(`${head}${detail}`, Math.max(24, width - 40));
        return (
          <Box key={entry.id}>
            <Text color={active ? TUI_COLORS.accentSoft : undefined}>{marker} </Text>
            <Text color={tone}>{formatActionTimestamp(entry.at)}</Text>
            <Text dimColor> · s:{sessionShort} · </Text>
            <Text color={active ? TUI_COLORS.accentSoft : undefined} bold={active} wrap="truncate-end">
              {body}
            </Text>
          </Box>
        );
      })}

      {filtered.length > 0 && windowed.end < filtered.length && (
        <Text dimColor>… {filtered.length - windowed.end} newer entries below …</Text>
      )}

      {selectedItem && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Selected:</Text>
          <Text color={actionStatusColor(selectedItem.status)}>
            {selectedItem.icon} {selectedItem.label}
          </Text>
          {selectedItem.detail && <Text dimColor wrap="wrap">{selectedItem.detail}</Text>}
        </Box>
      )}
    </Box>
  );
}
