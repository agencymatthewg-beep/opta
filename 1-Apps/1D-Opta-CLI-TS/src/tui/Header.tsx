import React from 'react';
import { Box, Text } from 'ink';
import { type ConnectionState, connectionDot, shortModelName } from './utils.js';

interface HeaderProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  connectionState?: ConnectionState;
  title?: string;
  /** When true, truncate model name and hide session ID. */
  compact?: boolean;
}

export function Header({ model, sessionId, connectionStatus, connectionState, title, compact }: HeaderProps) {
  const shortName = shortModelName(model);
  const displayModel = compact ? shortName.slice(0, 20) : shortName;
  const dot = connectionDot(connectionState, connectionStatus);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text bold color="cyan">Opta</Text>
        <Text dimColor> | </Text>
        <Text color={dot.color}>{dot.char}</Text>
        <Text> {displayModel}</Text>
      </Box>
      {!compact && (
        <Box>
          {title && <Text dimColor>{title.slice(0, 30)}</Text>}
          <Text dimColor> | </Text>
          <Text dimColor>{sessionId.slice(0, 8)}</Text>
        </Box>
      )}
    </Box>
  );
}
