import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

interface AppProps {
  model: string;
  sessionId: string;
}

export function App({ model, sessionId }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">Opta</Text>
        <Text dimColor> | </Text>
        <Text>{model}</Text>
        <Text dimColor> | </Text>
        <Text dimColor>{sessionId.slice(0, 8)}</Text>
      </Box>

      {/* Message area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {messages.length === 0 && (
          <Text dimColor>Type a message to start. Ctrl+C to exit.</Text>
        )}
        {messages.map((msg, i) => (
          <Box key={i} marginY={0}>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
              {msg.role === 'user' ? '> ' : '  '}
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))}
      </Box>

      {/* Status bar */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
        <Text dimColor>0 tokens</Text>
        <Text dimColor>$0.00</Text>
      </Box>
    </Box>
  );
}
