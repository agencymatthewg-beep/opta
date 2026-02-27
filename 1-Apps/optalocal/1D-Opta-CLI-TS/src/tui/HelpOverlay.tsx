/**
 * HelpOverlay — Modal overlay listing all keybindings.
 *
 * Shows a bordered box with every keybinding key combo + description,
 * plus hints for slash commands, @file references, and shell commands.
 * Press any key or Escape to dismiss.
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { defaultKeybindings, type KeybindingConfig } from './keybindings.js';

export interface HelpOverlayProps {
  onClose: () => void;
  keybindings?: KeybindingConfig;
}

/**
 * Format a keybinding key string (e.g. "ctrl+c") into a display label (e.g. "Ctrl+C").
 */
function formatKey(key: string): string {
  return key
    .split('+')
    .map(part => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'shift') return 'Shift';
      if (part === 'alt') return 'Alt';
      if (part === 'tab') return 'Tab';
      if (part === 'escape') return 'Esc';
      if (part === 'up') return 'Up';
      if (part === 'down') return 'Down';
      if (part === 'enter') return 'Enter';
      // Single character keys: uppercase
      if (part.length === 1) return part.toUpperCase();
      // Special chars like "/"
      return part;
    })
    .join('+');
}

/** Ordered list of keybinding actions to display. */
const DISPLAY_ORDER: (keyof KeybindingConfig)[] = [
  'exit',
  'toggleSidebar',
  'expandThinking',
  'clear',
  'help',
  'slashMenu',
  'openOptaMenu',
  'openActionHistory',
  'scrollUp',
  'scrollDown',
  'modelSwitch',
  'toggleSafeMode',
  'cycleMode',
  'toggleBypass',
  'toggleFollow',
  'browserPause',
  'browserKill',
  'browserRefresh',
  'openSettings',
  'toggleAgentPanel',
  'openSessionBrowser',
  'nextPanel',
  'previousPanel',
];

/** Width reserved for the key column in the two-column layout. */
const KEY_COLUMN_WIDTH = 16;

export function HelpOverlay({ onClose, keybindings }: HelpOverlayProps) {
  const bindings = keybindings ?? defaultKeybindings();

  // Dismiss on any key press
  useInput(() => {
    onClose();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">Keybindings</Text>
      </Box>

      {/* Keybinding rows */}
      {DISPLAY_ORDER.map(action => {
        const binding = bindings[action];
        return (
          <Box key={action}>
            <Box width={KEY_COLUMN_WIDTH}>
              <Text bold color="yellow">{formatKey(binding.key)}</Text>
            </Box>
            <Text>{binding.description}</Text>
          </Box>
        );
      })}

      {/* Separator */}
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>{'─'.repeat(32)}</Text>
      </Box>

      {/* Input hints */}
      <Box>
        <Box width={KEY_COLUMN_WIDTH}>
          <Text bold color="yellow">/</Text>
        </Box>
        <Text>Slash commands</Text>
      </Box>
      <Box>
        <Box width={KEY_COLUMN_WIDTH}>
          <Text bold color="yellow">@</Text>
        </Box>
        <Text>File references</Text>
      </Box>
      <Box>
        <Box width={KEY_COLUMN_WIDTH}>
          <Text bold color="yellow">!</Text>
        </Box>
        <Text>Shell commands</Text>
      </Box>
      <Box>
        <Box width={KEY_COLUMN_WIDTH}>
          <Text bold color="yellow">Alt+Enter</Text>
        </Box>
        <Text>Insert newline</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press any key to close</Text>
      </Box>
    </Box>
  );
}
