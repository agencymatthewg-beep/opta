import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  model: string;
  sessionId: string;
  connectionStatus: boolean;
  title?: string;
}

export function Header({ model, sessionId, connectionStatus, title }: HeaderProps) {
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
        <Text color={connectionStatus ? 'green' : 'red'}>*</Text>
        <Text> {model}</Text>
      </Box>
      <Box>
        {title && <Text dimColor>{title.slice(0, 30)}</Text>}
        <Text dimColor> | </Text>
        <Text dimColor>{sessionId.slice(0, 8)}</Text>
      </Box>
    </Box>
  );
}
