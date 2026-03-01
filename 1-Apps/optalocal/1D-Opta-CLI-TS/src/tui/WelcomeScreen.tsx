import React from 'react';
import { Box, Text } from 'ink';
import { type ConnectionState, connectionDot, shortModelName, formatContext } from './utils.js';
import { TUI_COLORS } from './palette.js';

export interface WelcomeScreenProps {
  connectionState?: ConnectionState;
  model?: string;
  contextTotal?: number;
  toolCount?: number;
}

export function WelcomeScreen({
  connectionState,
  model,
  contextTotal,
  toolCount,
}: WelcomeScreenProps) {
  const conn = connectionState
    ? connectionDot(connectionState)
    : { char: '\u25CF', color: 'green', label: 'Ready' };
  const displayModel = model ? shortModelName(model) : 'default';

  return (
    <Box flexDirection="column" paddingX={4} paddingY={3} alignItems="center">
      {/* Header ASCII Art */}
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        <Text color="#8b5cf6" bold>
          {`  ██████╗ ██████╗████████╗ █████╗ `}
        </Text>
        <Text color="#8b5cf6" bold>
          {` ██╔═══██╗██╔══██╗╚══██╔══╝██╔══██╗`}
        </Text>
        <Text color="#8b5cf6" bold>
          {` ██║   ██║██████╔╝   ██║   ███████║`}
        </Text>
        <Text color="#8b5cf6" bold>
          {` ██║   ██║██╔═══╝    ██║   ██╔══██║`}
        </Text>
        <Text color="#8b5cf6" bold>
          {` ╚██████╔╝██║       ██║   ██║  ██║`}
        </Text>
        <Text color="#8b5cf6" bold>
          {`  ╚═════╝ ╚═╝       ╚═╝   ╚═╝  ╚═╝`}
        </Text>
      </Box>

      {/* Quick Start section */}
      <Box marginTop={2} width={50} flexDirection="column">
        <Text bold color={TUI_COLORS.dim}>
          QUICK START
        </Text>
        <Box flexDirection="column" paddingY={1}>
          <Box justifyContent="space-between" marginY={0}>
            <Text color={TUI_COLORS.accent}>New Chat</Text>
            <Text color={TUI_COLORS.dim}>Enter</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text>Resume Session</Text>
            <Text color={TUI_COLORS.dim}>r</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text>Browse Models</Text>
            <Text color={TUI_COLORS.dim}>m</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text>Settings</Text>
            <Text color={TUI_COLORS.dim}>s</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={2} width={50} flexDirection="column">
        <Text bold color={TUI_COLORS.dim}>
          KEYBINDINGS
        </Text>
        <Box flexDirection="column" paddingY={1}>
          <Box justifyContent="space-between" marginY={0}>
            <Text color={TUI_COLORS.info}>Ctrl+/</Text>
            <Text color={TUI_COLORS.dim}>Show all keybindings</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text color={TUI_COLORS.info}>Shift+Space</Text>
            <Text color={TUI_COLORS.dim}>Open Opta menu</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text color={TUI_COLORS.info}>Ctrl+S</Text>
            <Text color={TUI_COLORS.dim}>Open settings</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text color={TUI_COLORS.info}>Ctrl+E</Text>
            <Text color={TUI_COLORS.dim}>Action history</Text>
          </Box>
          <Box justifyContent="space-between" marginY={0}>
            <Text color={TUI_COLORS.info}>Ctrl+B</Text>
            <Text color={TUI_COLORS.dim}>Toggle sidebar</Text>
          </Box>
        </Box>
      </Box>

      <Box
        marginTop={3}
        width={50}
        flexDirection="column"
        borderStyle="single"
        borderColor={TUI_COLORS.borderSoft}
        paddingX={2}
        paddingY={1}
      >
        {/* Connection status */}
        <Box justifyContent="space-between">
          <Text color={TUI_COLORS.dim}>Status</Text>
          <Box>
            <Text color={conn.color}>{conn.char} </Text>
            <Text color={conn.color}>{conn.label}</Text>
          </Box>
        </Box>

        <Box justifyContent="space-between">
          <Text color={TUI_COLORS.dim}>Engine</Text>
          <Text color={TUI_COLORS.info}>{displayModel}</Text>
        </Box>

        {/* Context info */}
        <Box justifyContent="space-between">
          <Text color={TUI_COLORS.dim}>Context</Text>
          <Text color={TUI_COLORS.dim}>{formatContext(contextTotal)}</Text>
        </Box>

        {/* Tools count */}
        <Box justifyContent="space-between">
          <Text color={TUI_COLORS.dim}>Tools</Text>
          <Text color={TUI_COLORS.dim}>{toolCount ?? 8} active</Text>
        </Box>
      </Box>
    </Box>
  );
}
