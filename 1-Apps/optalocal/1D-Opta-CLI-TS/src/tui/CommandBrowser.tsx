/**
 * CommandBrowser --- Overlay for browsing and selecting slash commands in TUI mode.
 *
 * Displays all registered slash commands grouped by category (info, session, tools, server).
 * Arrow keys navigate, Enter selects a command, Escape closes the overlay.
 * Shown when user types bare `/` in the input box.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { SlashCommandDef } from '../commands/slash/index.js';
import { fitTextToWidth } from '../utils/terminal-layout.js';

export interface CommandBrowserProps {
  commands: SlashCommandDef[];
  /** Optional external width cap from parent layout (message pane width). */
  maxWidth?: number;
  /** Optional external height cap from parent layout (message pane height). */
  maxHeight?: number;
  onSelect: (cmd: string) => void;
  onClose: () => void;
}

/** Category display order and labels. */
const CATEGORY_ORDER: Array<{ key: SlashCommandDef['category']; label: string }> = [
  { key: 'info', label: 'INFO' },
  { key: 'session', label: 'SESSION' },
  { key: 'tools', label: 'TOOLS' },
  { key: 'server', label: 'SERVER' },
];

export function CommandBrowser({ commands, maxWidth, maxHeight, onSelect, onClose }: CommandBrowserProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 24;
  const rows = Math.max(10, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 4));
  const preferred = Math.max(52, Math.min(120, columns - 4));
  const overlayWidth = Math.min(preferred, hardMax);
  const commandColWidth = Math.max(12, Math.min(20, Math.floor(overlayWidth * 0.26)));
  const descWidth = Math.max(18, overlayWidth - commandColWidth - 10);

  const maxVisibleItems = Math.max(4, Math.min(18, rows - 12));

  // Build a flat list of commands ordered by category for consistent indexing
  const flatCommands = useMemo(() => {
    const base: SlashCommandDef[] = [];
    for (const { key } of CATEGORY_ORDER) {
      const catCmds = commands.filter(c => c.category === key);
      base.push(...catCmds);
    }
    const knownCategories = new Set(CATEGORY_ORDER.map(c => c.key));
    const uncategorized = commands.filter(c => !knownCategories.has(c.category));
    base.push(...uncategorized);

    const q = query.trim().toLowerCase();
    const filtered = q.length === 0
      ? base
      : base.filter(c => c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));

    // Recent commands bubble to top while preserving relative order.
    const recentSet = new Set(recents);
    const recentFirst = filtered
      .filter(c => recentSet.has(c.command))
      .sort((a, b) => recents.indexOf(a.command) - recents.indexOf(b.command));
    const rest = filtered.filter(c => !recentSet.has(c.command));

    return [...recentFirst, ...rest];
  }, [commands, query, recents]);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (flatCommands.length === 0) return 0;
      return Math.min(prev, flatCommands.length - 1);
    });
  }, [flatCommands.length]);

  const visibleRange = useMemo(() => {
    if (flatCommands.length <= maxVisibleItems) {
      return { start: 0, end: flatCommands.length };
    }

    const half = Math.floor(maxVisibleItems / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + maxVisibleItems;

    if (end > flatCommands.length) {
      end = flatCommands.length;
      start = Math.max(0, end - maxVisibleItems);
    }

    return { start, end };
  }, [flatCommands.length, selectedIndex, maxVisibleItems]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return && flatCommands.length > 0) {
      const picked = flatCommands[selectedIndex]!.command;
      setRecents(prev => [picked, ...prev.filter(p => p !== picked)].slice(0, 8));
      onSelect(`/${picked}`);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(flatCommands.length - 1, i + 1));
      return;
    }

    if (key.leftArrow) {
      onClose();
      return;
    }

    if (key.backspace || key.delete) {
      if (query.length === 0) {
        onClose();
        return;
      }
      setQuery(prev => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    // Type-to-filter (ignore control/meta combos)
    if (!key.ctrl && !key.meta && input && input.length === 1 && input >= ' ') {
      setQuery(prev => (prev + input).slice(0, 64));
      setSelectedIndex(0);
    }
  });

  // Build category groups from flatCommands to keep indices aligned with selection.
  const categoryLabel = new Map<SlashCommandDef['category'] | 'other', string>([
    ['info', 'INFO'],
    ['session', 'SESSION'],
    ['tools', 'TOOLS'],
    ['server', 'SERVER'],
    ['other', 'OTHER'],
  ]);
  const knownCategories = new Set(CATEGORY_ORDER.map(c => c.key));
  const categoryGroups: Array<{ label: string; items: Array<{ def: SlashCommandDef; flatIdx: number }> }> = [];
  const byLabel = new Map<string, Array<{ def: SlashCommandDef; flatIdx: number }>>();

  flatCommands.forEach((def, flatIdx) => {
    const key = knownCategories.has(def.category) ? def.category : 'other';
    const label = categoryLabel.get(key) ?? 'OTHER';
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push({ def, flatIdx });
  });

  for (const { label } of CATEGORY_ORDER.map(c => ({ label: categoryLabel.get(c.key)! }))) {
    const items = byLabel.get(label);
    if (items && items.length > 0) categoryGroups.push({ label, items });
  }
  if (byLabel.has('OTHER')) {
    categoryGroups.push({ label: 'OTHER', items: byLabel.get('OTHER')! });
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      paddingY={1}
      width={overlayWidth}
      overflow="hidden"
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="magenta">Slash Commands</Text>
        <Text dimColor>  ({flatCommands.length} commands)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Filter: </Text>
        <Text color="cyan">{query || '(type to search)'}</Text>
      </Box>

      {/* Navigation hints */}
      <Box marginBottom={1}>
        <Text dimColor>{'↑↓'} navigate  Enter select  Esc close  Backspace clear</Text>
      </Box>

      {visibleRange.start > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>  … {visibleRange.start} above …</Text>
        </Box>
      )}

      {/* Category groups */}
      {categoryGroups.map(group => {
        const visibleItems = group.items.filter(
          ({ flatIdx }) => flatIdx >= visibleRange.start && flatIdx < visibleRange.end,
        );

        if (visibleItems.length === 0) return null;

        return (
          <Box key={group.label} flexDirection="column" marginBottom={1}>
            <Text dimColor bold>  {group.label}</Text>
            {visibleItems.map(({ def, flatIdx }) => {
              const isSelected = flatIdx === selectedIndex;
              return (
                <Box key={def.command}>
                  <Text>
                    {isSelected ? ' ▶ ' : '   '}
                  </Text>
                  <Text color={isSelected ? 'magenta' : 'cyan'} bold={isSelected}>
                    {'/' + fitTextToWidth(def.command, commandColWidth, { pad: true })}
                  </Text>
                  <Text dimColor={!isSelected} wrap="truncate-end">
                    {fitTextToWidth(def.description, descWidth)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}

      {visibleRange.end < flatCommands.length && (
        <Box>
          <Text dimColor>  … {flatCommands.length - visibleRange.end} below …</Text>
        </Box>
      )}
    </Box>
  );
}
