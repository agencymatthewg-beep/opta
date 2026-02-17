import React from 'react';
import { Box, Text } from 'ink';
import { ScrollView } from './ScrollView.js';

interface Message {
  role: string;
  content: string;
  toolCalls?: number;
  thinkingTokens?: number;
}

interface MessageListProps {
  messages: Message[];
  height?: number;
  focusable?: boolean;
}

export function MessageList({ messages, height, focusable = false }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Start typing to begin a conversation.</Text>
      </Box>
    );
  }

  const messageRows = messages.map((msg, i) => (
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
  ));

  // If height is provided, wrap in ScrollView for scrollable history
  if (height && height > 0) {
    return (
      <Box paddingX={1}>
        <ScrollView height={height} autoScroll focusable={focusable}>
          {messageRows}
        </ScrollView>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {messageRows}
    </Box>
  );
}
