/**
 * SessionBrowserOverlay — TUI overlay for browsing, searching, resuming,
 * and deleting saved sessions.
 *
 * Follows the same overlay patterns as ModelPicker and OptaMenuOverlay.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { TUI_COLORS } from './palette.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionBrowserEntry {
  id: string;
  title: string;
  model: string;
  created: string;
  messageCount: number;
  toolCallCount: number;
  tags: string[];
}

export interface SessionBrowserOverlayProps {
  currentSessionId: string;
  maxWidth?: number;
  maxHeight?: number;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
}

type DeleteConfirmState = { sessionId: string; title: string } | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '\u2026';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionBrowserOverlay({
  currentSessionId,
  maxWidth,
  maxHeight,
  onResume,
  onDelete,
  onClose,
}: SessionBrowserOverlayProps): React.ReactElement {
  const [sessions, setSessions] = useState<SessionBrowserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const { stdout } = useStdout();

  const termRows = stdout?.rows ?? process.stdout.rows ?? 24;
  const termCols = stdout?.columns ?? process.stdout.columns ?? 80;
  const panelWidth = maxWidth ? Math.min(maxWidth, termCols - 4) : Math.min(termCols - 4, 100);
  const panelHeight = maxHeight ? Math.min(maxHeight, termRows - 6) : Math.min(termRows - 6, 30);
  // Reserve rows for: header(2) + search(2) + hints(2) + border/padding(4) = 10
  const maxVisibleItems = Math.max(4, panelHeight - 10);

  // --- Load sessions on mount ---
  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const { listSessions } = await import('../memory/store.js');
        const all = await listSessions();
        if (cancelled) return;
        setSessions(
          all.map((s) => ({
            id: s.id,
            title: s.title || '(untitled)',
            model: s.model,
            created: s.created,
            messageCount: s.messageCount,
            toolCallCount: s.toolCallCount,
            tags: s.tags ?? [],
          })),
        );
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  // --- Filtered sessions ---
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase().trim();
    return sessions.filter((s) => {
      const haystack = `${s.id} ${s.title} ${s.model} ${s.tags.join(' ')}`.toLowerCase();
      const words = q.split(/\s+/);
      return words.every((w) => haystack.includes(w));
    });
  }, [sessions, searchQuery]);

  // Keep selected index in bounds when filter changes
  useEffect(() => {
    setSelectedIdx((prev) => {
      if (filtered.length === 0) return 0;
      return Math.min(prev, filtered.length - 1);
    });
  }, [filtered.length]);

  // --- Visible window (scrolling viewport) ---
  const visibleRange = useMemo(() => {
    if (filtered.length <= maxVisibleItems) {
      return { start: 0, end: filtered.length };
    }
    const half = Math.floor(maxVisibleItems / 2);
    let start = Math.max(0, selectedIdx - half);
    let end = start + maxVisibleItems;
    if (end > filtered.length) {
      end = filtered.length;
      start = Math.max(0, end - maxVisibleItems);
    }
    return { start, end };
  }, [filtered.length, selectedIdx, maxVisibleItems]);

  // --- Reload helper after delete ---
  const reloadSessions = useCallback(async () => {
    try {
      const { listSessions } = await import('../memory/store.js');
      const all = await listSessions();
      setSessions(
        all.map((s) => ({
          id: s.id,
          title: s.title || '(untitled)',
          model: s.model,
          created: s.created,
          messageCount: s.messageCount,
          toolCallCount: s.toolCallCount,
          tags: s.tags ?? [],
        })),
      );
    } catch {
      // Non-fatal: the list will be stale but the overlay is still usable
    }
  }, []);

  // --- Input handling ---
  useInput((input, key) => {
    // Handle delete confirmation first
    if (deleteConfirm) {
      if (input.toLowerCase() === 'y') {
        const sessionId = deleteConfirm.sessionId;
        setDeleteConfirm(null);
        onDelete(sessionId);
        // Remove from local state and reload
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        void reloadSessions();
        return;
      }
      // Any other key cancels the confirmation
      setDeleteConfirm(null);
      return;
    }

    // Escape always closes
    if (key.escape) {
      if (searchFocused && searchQuery) {
        setSearchQuery('');
        setSearchFocused(false);
        return;
      }
      onClose();
      return;
    }

    // When search is focused, handle text input
    if (searchFocused) {
      if (key.return) {
        setSearchFocused(false);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.tab) {
        setSearchQuery((prev) => prev + input);
        return;
      }
      // Allow navigation keys even when search is focused
      if (key.upArrow) {
        setSelectedIdx((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (key.downArrow) {
        setSelectedIdx((prev) => (prev + 1) % filtered.length);
        return;
      }
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      setSelectedIdx((prev) => {
        if (filtered.length === 0) return 0;
        return (prev - 1 + filtered.length) % filtered.length;
      });
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIdx((prev) => {
        if (filtered.length === 0) return 0;
        return (prev + 1) % filtered.length;
      });
      return;
    }

    // Enter to resume
    if (key.return && filtered.length > 0) {
      const session = filtered[selectedIdx];
      if (!session) return;
      if (session.id === currentSessionId) {
        // Already the current session, just close
        onClose();
        return;
      }
      onResume(session.id);
      return;
    }

    // Delete with 'd' key
    if (input === 'd' && !key.ctrl && !key.meta && filtered.length > 0) {
      const session = filtered[selectedIdx];
      if (!session) return;
      if (session.id === currentSessionId) {
        // Cannot delete the current session
        return;
      }
      setDeleteConfirm({ sessionId: session.id, title: session.title });
      return;
    }

    // '/' to focus search
    if (input === '/' && !key.ctrl && !key.meta) {
      setSearchFocused(true);
      return;
    }

    // Backspace/left arrow to close
    if (key.leftArrow || key.backspace) {
      onClose();
      return;
    }
  });

  const visibleSessions = filtered.slice(visibleRange.start, visibleRange.end);
  const titleMaxLen = Math.max(20, panelWidth - 50);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={TUI_COLORS.accent}
      paddingX={2}
      paddingY={1}
      width={panelWidth}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={TUI_COLORS.accent} bold>
          Session Browser
        </Text>
        <Text dimColor>
          {filtered.length} session{filtered.length !== 1 ? 's' : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </Text>
      </Box>

      {/* Search bar */}
      <Box marginBottom={1}>
        <Text color={searchFocused ? TUI_COLORS.info : undefined}>
          {searchFocused ? '/' : '/'}{' '}
        </Text>
        <Text color={searchFocused ? TUI_COLORS.info : undefined}>
          {searchQuery || (searchFocused ? '' : 'type / to search')}
        </Text>
        {searchFocused ? <Text color={TUI_COLORS.info}>|</Text> : null}
      </Box>

      {/* Loading / error / empty states */}
      {loading ? <Text dimColor>Loading sessions...</Text> : null}
      {error ? <Text color={TUI_COLORS.danger}>Failed to load sessions: {error}</Text> : null}
      {!loading && !error && filtered.length === 0 ? (
        <Text dimColor>{searchQuery ? 'No sessions match your search' : 'No saved sessions'}</Text>
      ) : null}

      {/* Scroll indicator (above) */}
      {!loading && !error && visibleRange.start > 0 ? (
        <Text dimColor>  ... {visibleRange.start} above ...</Text>
      ) : null}

      {/* Session list */}
      {visibleSessions.map((session, i) => {
        const idx = visibleRange.start + i;
        const focused = idx === selectedIdx;
        const isCurrent = session.id === currentSessionId;
        const marker = focused ? '\u25b6 ' : '  ';

        return (
          <Box key={session.id} flexDirection="row">
            <Text color={focused ? TUI_COLORS.accent : undefined}>{marker}</Text>
            <Text color={isCurrent ? TUI_COLORS.success : (focused ? TUI_COLORS.info : undefined)}>
              {session.id.slice(0, 8)}
            </Text>
            <Text> </Text>
            <Text color={focused ? 'white' : undefined}>
              {truncateTitle(session.title, titleMaxLen)}
            </Text>
            <Text dimColor>
              {'  '}{session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
              {' \u00b7 '}{formatRelativeDate(session.created)}
            </Text>
            {isCurrent ? <Text color={TUI_COLORS.success}> (current)</Text> : null}
          </Box>
        );
      })}

      {/* Scroll indicator (below) */}
      {!loading && !error && visibleRange.end < filtered.length ? (
        <Text dimColor>  ... {filtered.length - visibleRange.end} below ...</Text>
      ) : null}

      {/* Delete confirmation */}
      {deleteConfirm ? (
        <Box marginTop={1}>
          <Text color={TUI_COLORS.danger} bold>
            Delete session {deleteConfirm.sessionId.slice(0, 8)} "{truncateTitle(deleteConfirm.title, 30)}"?{' '}
          </Text>
          <Text color={TUI_COLORS.warning}>y/n</Text>
        </Box>
      ) : null}

      {/* Hints */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          {'\u2191\u2193/jk navigate \u00b7 Enter resume \u00b7 d delete \u00b7 / search \u00b7 Esc close'}
        </Text>
        {filtered.length > 0 && filtered[selectedIdx] ? (
          <Text dimColor>
            Model: {filtered[selectedIdx]!.model}
            {filtered[selectedIdx]!.tags.length > 0 ? ` \u00b7 Tags: ${filtered[selectedIdx]!.tags.join(', ')}` : ''}
            {filtered[selectedIdx]!.toolCallCount > 0 ? ` \u00b7 ${filtered[selectedIdx]!.toolCallCount} tool calls` : ''}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}
