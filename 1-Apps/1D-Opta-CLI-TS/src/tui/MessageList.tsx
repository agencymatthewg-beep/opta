import React from 'react';
import { Box, Text } from 'ink';

interface Message {
  role: string;
  content: string;
  toolCalls?: number;
  thinkingTokens?: number;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Start typing to begin a conversation.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
              {msg.role === 'user' ? '> you' : '  opta'}
            </Text>
            {msg.toolCalls ? (
              <Text dimColor> ({msg.toolCalls} tool calls)</Text>
            ) : null}
            {msg.thinkingTokens ? (
              <Text dimColor> (thinking {msg.thinkingTokens})</Text>
            ) : null}
          </Box>
          <Box paddingLeft={2}>
            <Text wrap="wrap">{msg.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
