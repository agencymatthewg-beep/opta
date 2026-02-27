import React, { useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { SlashCommandDef } from '../commands/slash/index.js';
import { fitTextToWidth } from '../utils/terminal-layout.js';
import { defaultKeybindings, type KeybindingConfig } from './keybindings.js';
import { TUI_COLORS } from './palette.js';

interface HelpCommandItem {
  id: string;
  description: string;
  usage?: string;
  example?: string;
}

interface HelpArea {
  id: string;
  label: string;
  hint: string;
  commands: HelpCommandItem[];
}

export interface HelpBrowserOverlayProps {
  commands: SlashCommandDef[];
  /** Optional external width cap from parent layout (message pane width). */
  maxWidth?: number;
  /** Optional external height cap from parent layout (message pane height). */
  maxHeight?: number;
  keybindings?: KeybindingConfig;
  onClose: () => void;
}

function categoryLabel(category: SlashCommandDef['category']): string {
  if (category === 'info') return 'Info Commands';
  if (category === 'session') return 'Session Commands';
  if (category === 'tools') return 'Coding Tools';
  if (category === 'server') return 'LMX + Server';
  return 'Other Commands';
}

function buildHelpAreas(commands: SlashCommandDef[], keybindings?: KeybindingConfig): HelpArea[] {
  const byCategory = new Map<string, HelpCommandItem[]>();
  for (const cmd of commands) {
    const key = cmd.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push({
      id: `/${cmd.command}`,
      description: cmd.description,
      usage: cmd.usage,
      example: cmd.examples?.[0],
    });
  }

  const order: Array<SlashCommandDef['category']> = ['info', 'session', 'tools', 'server'];
  const slashAreas: HelpArea[] = [];
  for (const cat of order) {
    const items = byCategory.get(cat);
    if (!items || items.length === 0) continue;
    slashAreas.push({
      id: cat,
      label: categoryLabel(cat),
      hint: `${items.length} commands`,
      commands: items,
    });
  }

  const kb = keybindings ?? defaultKeybindings();
  const optaMenuKeys = (() => {
    const primary = kb.openOptaMenu?.key ?? 'ctrl+s';
    if (primary === 'ctrl+s') return 'ctrl+s / shift+space';
    return `${primary} / ctrl+s / shift+space`;
  })();
  const keyAreas: HelpArea[] = [
    {
      id: 'chat-input',
      label: 'Chat Input',
      hint: 'message syntax',
      commands: [
        { id: 'type message', description: 'Send a normal message to Opta' },
        { id: '@file.ts', description: 'Attach local file context' },
        { id: '!command', description: 'Run shell command inside chat' },
        { id: '/', description: 'Open slash command browser' },
      ],
    },
    {
      id: 'navigation',
      label: 'Navigation + UI',
      hint: 'global shortcuts',
      commands: [
        { id: optaMenuKeys, description: 'Open Opta Menu overlay' },
        { id: kb.openActionHistory?.key ?? 'ctrl+e', description: 'Open Actions History overlay' },
        { id: kb.modelSwitch.key, description: 'Switch model picker' },
        { id: kb.toggleSidebar.key, description: 'Toggle sidebar panel' },
        { id: kb.toggleSafeMode.key, description: 'Toggle safe-mode rendering' },
        { id: kb.help.key, description: 'Open help browser' },
      ],
    },
  ];

  return [...keyAreas, ...slashAreas];
}

export function HelpBrowserOverlay({ commands, maxWidth, maxHeight, keybindings, onClose }: HelpBrowserOverlayProps) {
  const areas = useMemo(() => buildHelpAreas(commands, keybindings), [commands, keybindings]);
  const [activePane, setActivePane] = useState<'areas' | 'commands'>('areas');
  const [areaIndex, setAreaIndex] = useState(0);
  const [commandIndexes, setCommandIndexes] = useState<number[]>(areas.map(() => 0));

  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 36;
  const rows = Math.max(12, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(72, Math.min(136, columns - 8));
  const width = Math.min(preferred, hardMax);
  const maxRows = Math.max(4, Math.min(14, rows - 18));
  const leftWidth = Math.max(18, Math.floor((width - 6) * 0.34));
  const rightWidth = Math.max(24, width - leftWidth - 6);

  const selectedArea = areas[areaIndex] ?? areas[0];
  const selectedCommandIndex = commandIndexes[areaIndex] ?? 0;
  const selectedCommand = selectedArea?.commands[selectedCommandIndex];

  const moveWrapped = (current: number, delta: number, size: number): number => {
    if (size <= 0) return 0;
    return (current + delta + size) % size;
  };

  useInput((input, key) => {
    if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
      onClose();
      return;
    }
    if (key.leftArrow || key.backspace || key.delete) {
      if (activePane === 'commands') {
        setActivePane('areas');
      } else {
        onClose();
      }
      return;
    }
    if (key.rightArrow) {
      setActivePane('commands');
      return;
    }
    if (key.upArrow) {
      if (activePane === 'areas') {
        const next = moveWrapped(areaIndex, -1, areas.length);
        setAreaIndex(next);
      } else if (selectedArea) {
        const next = moveWrapped(selectedCommandIndex, -1, selectedArea.commands.length);
        setCommandIndexes((prev) => {
          const nextList = prev.slice();
          nextList[areaIndex] = next;
          return nextList;
        });
      }
      return;
    }
    if (key.downArrow) {
      if (activePane === 'areas') {
        const next = moveWrapped(areaIndex, 1, areas.length);
        setAreaIndex(next);
      } else if (selectedArea) {
        const next = moveWrapped(selectedCommandIndex, 1, selectedArea.commands.length);
        setCommandIndexes((prev) => {
          const nextList = prev.slice();
          nextList[areaIndex] = next;
          return nextList;
        });
      }
      return;
    }
    if (key.return && activePane === 'areas') {
      setActivePane('commands');
    }
  });

  const areaStart = Math.max(0, Math.min(areaIndex - Math.floor(maxRows / 2), Math.max(areas.length - maxRows, 0)));
  const areaEnd = Math.min(areas.length, areaStart + maxRows);
  const cmds = selectedArea?.commands ?? [];
  const cmdStart = Math.max(0, Math.min(selectedCommandIndex - Math.floor(maxRows / 2), Math.max(cmds.length - maxRows, 0)));
  const cmdEnd = Math.min(cmds.length, cmdStart + maxRows);

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
        <Text color={TUI_COLORS.accent} bold>{'◆'} Opta Help Browser</Text>
        <Text dimColor>Finder-style: {'←→'} panes · {'↑↓'} select</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>Enter drills in · Left/Backspace goes back · Esc closes</Text>
      </Box>

      <Box>
        <Box width={leftWidth} flexDirection="column">
          <Text color={activePane === 'areas' ? TUI_COLORS.accentSoft : undefined} bold>
            Areas
          </Text>
          {areas.slice(areaStart, areaEnd).map((area, idx) => {
            const absolute = areaStart + idx;
            const active = absolute === areaIndex;
            return (
              <Box key={area.id}>
                <Text color={active ? TUI_COLORS.accentSoft : undefined}>{active ? '▶ ' : '  '}</Text>
                <Text bold={active} color={active ? TUI_COLORS.accentSoft : undefined}>
                  {fitTextToWidth(area.label, Math.max(8, leftWidth - 18))}
                </Text>
                <Text dimColor> · {fitTextToWidth(area.hint, 12)}</Text>
              </Box>
            );
          })}
        </Box>

        <Box width={rightWidth} flexDirection="column">
          <Text color={activePane === 'commands' ? TUI_COLORS.info : undefined} bold>
            {selectedArea?.label ?? 'Commands'}
          </Text>
          {cmds.slice(cmdStart, cmdEnd).map((cmd, idx) => {
            const absolute = cmdStart + idx;
            const active = absolute === selectedCommandIndex;
            return (
              <Box key={`${selectedArea?.id ?? 'none'}-${cmd.id}`}>
                <Text color={active ? TUI_COLORS.info : undefined}>{active ? '▶ ' : '  '}</Text>
                <Text color={active ? TUI_COLORS.info : undefined} bold={active}>
                  {fitTextToWidth(cmd.id, Math.max(8, Math.floor(rightWidth * 0.38)))}
                </Text>
                <Text dimColor wrap="truncate-end">
                  {' '}
                  {fitTextToWidth(cmd.description, Math.max(10, rightWidth - Math.floor(rightWidth * 0.42)))}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {selectedCommand && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Selected command</Text>
          <Text color={TUI_COLORS.info} bold>{selectedCommand.id}</Text>
          {selectedCommand.usage && <Text dimColor>Usage: {selectedCommand.usage}</Text>}
          {selectedCommand.example && <Text dimColor>Example: {selectedCommand.example}</Text>}
        </Box>
      )}
    </Box>
  );
}
