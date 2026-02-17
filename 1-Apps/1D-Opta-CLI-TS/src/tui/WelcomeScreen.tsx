import React from 'react';
import { Box, Text } from 'ink';

type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'error';

export interface WelcomeScreenProps {
  connectionState?: ConnectionState;
  model?: string;
  contextTotal?: number;
}

function connectionLine(state?: ConnectionState): { icon: string; color: string; label: string } {
  switch (state) {
    case 'checking': return { icon: '\u25CC', color: 'yellow', label: 'Connecting...' };
    case 'connected': return { icon: '\u25CF', color: 'green', label: 'Connected' };
    case 'disconnected': return { icon: '\u25CB', color: 'red', label: 'Disconnected' };
    case 'error': return { icon: '\u2717', color: 'red', label: 'Connection Error' };
    default: return { icon: '\u25CF', color: 'green', label: 'Ready' };
  }
}

function shortModelName(model: string): string {
  return model
    .replace(/^lmstudio-community\//, '')
    .replace(/^mlx-community\//, '')
    .replace(/^huggingface\//, '');
}

function formatContext(total?: number): string {
  if (!total) return '\u2014';
  if (total >= 1024) return `${Math.round(total / 1024)}K`;
  return String(total);
}

export function WelcomeScreen({ connectionState, model, contextTotal }: WelcomeScreenProps) {
  const conn = connectionLine(connectionState);
  const displayModel = model ? shortModelName(model) : 'default';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={2}>
      {/* Header */}
      <Box justifyContent="center">
        <Text color="green" bold>{'\u25C6'} Opta CLI</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {/* Connection status */}
        <Box>
          <Text color={conn.color}>{conn.icon} </Text>
          <Text dimColor>{conn.label} to </Text>
          <Text bold>{displayModel}</Text>
        </Box>

        {/* Context info */}
        <Box>
          <Text dimColor>{'\u25CC'} Context: {formatContext(contextTotal)} tokens available</Text>
        </Box>

        {/* Tools count */}
        <Box>
          <Text dimColor>{'\u25CC'} Tools: 8 registered</Text>
        </Box>
      </Box>

      {/* Quick Start section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>Quick Start:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Box>
            <Text color="cyan">{'Type a message'}</Text>
            <Text dimColor>{'     Start chatting'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'/help'}</Text>
            <Text dimColor>{'              Command reference'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'/model'}</Text>
            <Text dimColor>{'             Switch models'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'@file.ts'}</Text>
            <Text dimColor>{'           Attach file context'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'!command'}</Text>
            <Text dimColor>{'            Run shell command'}</Text>
          </Box>
        </Box>
      </Box>

      {/* Keybindings section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>Keybindings:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Box>
            <Text color="cyan">{'Ctrl+?'}</Text>
            <Text dimColor>{'             Show all keybindings'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'Ctrl+S'}</Text>
            <Text dimColor>{'             Toggle sidebar'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'Ctrl+T'}</Text>
            <Text dimColor>{'             Expand thinking'}</Text>
          </Box>
          <Box>
            <Text color="cyan">{'Ctrl+L'}</Text>
            <Text dimColor>{'             Clear messages'}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
