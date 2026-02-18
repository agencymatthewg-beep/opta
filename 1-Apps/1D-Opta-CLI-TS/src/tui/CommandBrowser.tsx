/**
 * CommandBrowser --- Overlay for browsing and selecting slash commands in TUI mode.
 *
 * Displays all registered slash commands grouped by category (info, session, tools, server).
 * Arrow keys navigate, Enter selects a command, Escape closes the overlay.
 * Shown when user types bare `/` in the input box.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SlashCommandDef } from '../commands/slash/index.js';

export interface CommandBrowserProps {
  commands: SlashCommandDef[];
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

export function CommandBrowser({ commands, onSelect, onClose }: CommandBrowserProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build a flat list of commands ordered by category for consistent indexing
  const flatCommands = useMemo(() => {
    const result: SlashCommandDef[] = [];
    for (const { key } of CATEGORY_ORDER) {
      const catCmds = commands.filter(c => c.category === key);
      result.push(...catCmds);
    }
    // Include any commands with categories not in CATEGORY_ORDER
    const knownCategories = new Set(CATEGORY_ORDER.map(c => c.key));
    const uncategorized = commands.filter(c => !knownCategories.has(c.category));
    result.push(...uncategorized);
    return result;
  }, [commands]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return && flatCommands.length > 0) {
      onSelect(`/${flatCommands[selectedIndex]!.command}`);
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
  });

  // Build category groups for display, tracking global index
  let globalIdx = 0;
  const categoryGroups: Array<{
    label: string;
    items: Array<{ def: SlashCommandDef; flatIdx: number }>;
  }> = [];

  for (const { key, label } of CATEGORY_ORDER) {
    const catCmds = flatCommands.filter(c => c.category === key);
    if (catCmds.length === 0) continue;
    const items: Array<{ def: SlashCommandDef; flatIdx: number }> = [];
    for (const def of catCmds) {
      items.push({ def, flatIdx: globalIdx });
      globalIdx++;
    }
    categoryGroups.push({ label, items });
  }

  // Any uncategorized commands
  const knownCategories = new Set(CATEGORY_ORDER.map(c => c.key));
  const uncategorized = flatCommands.filter(c => !knownCategories.has(c.category));
  if (uncategorized.length > 0) {
    const items: Array<{ def: SlashCommandDef; flatIdx: number }> = [];
    for (const def of uncategorized) {
      items.push({ def, flatIdx: globalIdx });
      globalIdx++;
    }
    categoryGroups.push({ label: 'OTHER', items });
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="magenta">Slash Commands</Text>
        <Text dimColor>  ({flatCommands.length} commands)</Text>
      </Box>

      {/* Navigation hints */}
      <Box marginBottom={1}>
        <Text dimColor>{'\u2191\u2193'} navigate  Enter select  Esc close</Text>
      </Box>

      {/* Category groups */}
      {categoryGroups.map(group => (
        <Box key={group.label} flexDirection="column" marginBottom={1}>
          <Text dimColor bold>  {group.label}</Text>
          {group.items.map(({ def, flatIdx }) => {
            const isSelected = flatIdx === selectedIndex;
            return (
              <Box key={def.command}>
                <Text>
                  {isSelected ? ' \u25B6 ' : '   '}
                </Text>
                <Text color={isSelected ? 'magenta' : 'cyan'} bold={isSelected}>
                  {'/' + def.command.padEnd(16)}
                </Text>
                <Text dimColor={!isSelected}>
                  {def.description}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
