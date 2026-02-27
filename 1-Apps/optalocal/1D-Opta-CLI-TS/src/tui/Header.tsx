import React from 'react';
import { Box, Text } from 'ink';
import { type ConnectionState, connectionDot, shortModelName } from './utils.js';
import { TUI_COLORS } from './palette.js';

interface HeaderProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  connectionState?: ConnectionState;
  title?: string;
  /** When true, truncate model name and hide session ID. */
  compact?: boolean;
  /** Minimal rendering for ultra-narrow terminals (no decorative border). */
  safeMode?: boolean;
}

export function Header({ model, sessionId, connectionStatus, connectionState, title, compact, safeMode = false }: HeaderProps) {
  const shortName = shortModelName(model);
  const displayModel = compact ? shortName.slice(0, 20) : shortName;
  const dot = connectionDot(connectionState, connectionStatus);

  if (safeMode) {
    return (
      <Box paddingX={1} justifyContent="space-between" width="100%">
        <Box>
          <Text bold color={TUI_COLORS.accent}>Opta</Text>
          <Text dimColor> · </Text>
          <Text color={dot.color}>{dot.char}</Text>
          <Text> {displayModel}</Text>
        </Box>
        {!compact && (
          <Box>
            <Text color={TUI_COLORS.accentSoft}>{sessionId.slice(0, 8)}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      borderStyle="single"
      borderColor={TUI_COLORS.borderSoft}
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text bold color={TUI_COLORS.accent}>Opta</Text>
        <Text dimColor> · </Text>
        <Text color={dot.color}>{dot.char}</Text>
        <Text> {displayModel}</Text>
      </Box>
      {!compact && (
        <Box>
          {title && <Text dimColor>{title.slice(0, 36)}</Text>}
          <Text dimColor> · </Text>
          <Text color={TUI_COLORS.accentSoft}>{sessionId.slice(0, 8)}</Text>
        </Box>
      )}
    </Box>
  );
}
