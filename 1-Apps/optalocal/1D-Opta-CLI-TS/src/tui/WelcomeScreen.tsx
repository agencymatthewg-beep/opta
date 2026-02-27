import React from 'react';
import { Box, Text } from 'ink';
import { type ConnectionState, connectionDot, shortModelName, formatContext } from './utils.js';

export interface WelcomeScreenProps {
  connectionState?: ConnectionState;
  model?: string;
  contextTotal?: number;
  toolCount?: number;
}

export function WelcomeScreen({ connectionState, model, contextTotal, toolCount }: WelcomeScreenProps) {
  const conn = connectionState
    ? connectionDot(connectionState)
    : { char: '\u25CF', color: 'green', label: 'Ready' };
  const displayModel = model ? shortModelName(model) : 'default';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={2}>
      {/* Header */}
      <Box justifyContent="center">
        <Text color="#8b5cf6" bold>{'\u25C6'} Opta CLI</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {/* Connection status */}
        <Box>
          <Text color={conn.color}>{conn.char} </Text>
          <Text dimColor>{conn.label} to </Text>
          <Text bold>{displayModel}</Text>
        </Box>

        {/* Context info */}
        <Box>
          <Text dimColor>{'\u25CC'} Context: {formatContext(contextTotal)} tokens available</Text>
        </Box>

        {/* Tools count */}
        <Box>
          <Text dimColor>{'\u25CC'} Tools: {toolCount ?? 8} registered</Text>
        </Box>
      </Box>

      {/* Quick Start section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>Quick Start:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Box justifyContent="space-between">
            <Text color="cyan">Type a message</Text>
            <Text dimColor>Start chatting</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">/help</Text>
            <Text dimColor>Command reference</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">/model</Text>
            <Text dimColor>Switch models</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">@file.ts</Text>
            <Text dimColor>Attach file context</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">!command</Text>
            <Text dimColor>Run shell command</Text>
          </Box>
        </Box>
      </Box>

      {/* Keybindings section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>Keybindings:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+/</Text>
            <Text dimColor>Show all keybindings</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Shift+Space</Text>
            <Text dimColor>Open Opta menu</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+S</Text>
            <Text dimColor>Open settings</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+E</Text>
            <Text dimColor>Action history</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+B</Text>
            <Text dimColor>Toggle sidebar</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+K</Text>
            <Text dimColor>Open command palette (Ctrl+O legacy)</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+N</Text>
            <Text dimColor>Toggle safe rendering</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+T</Text>
            <Text dimColor>Expand thinking</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="cyan">Ctrl+L</Text>
            <Text dimColor>Clear messages</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
