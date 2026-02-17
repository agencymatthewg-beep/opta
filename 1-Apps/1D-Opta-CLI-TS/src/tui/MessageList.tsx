import React from 'react';
import { Box, Text } from 'ink';
import { ScrollView } from './ScrollView.js';

interface Message {
  role: string;
  content: string;
  toolName?: string;
  toolId?: string;
  toolStatus?: 'running' | 'done';
  toolCalls?: number;
  thinkingTokens?: number;
}

interface MessageListProps {
  messages: Message[];
  height?: number;
  focusable?: boolean;
}

function renderToolMessage(msg: Message, i: number) {
  const isRunning = msg.toolStatus === 'running';
  const icon = isRunning ? '*' : '+';
  const color = isRunning ? 'yellow' : 'gray';

  return (
    <Box key={`tool-${i}`} marginBottom={0} paddingLeft={2}>
      <Text color={color}>
        {icon} {msg.toolName ?? 'tool'}
      </Text>
      {isRunning ? (
        <Text dimColor> running...</Text>
      ) : (
        <Text dimColor> {msg.content.slice(0, 80)}{msg.content.length > 80 ? '...' : ''}</Text>
      )}
    </Box>
  );
}

function renderErrorMessage(msg: Message, i: number) {
  return (
    <Box key={`err-${i}`} flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="red" bold>  error</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="red" wrap="wrap">{msg.content}</Text>
      </Box>
    </Box>
  );
}

function renderChatMessage(msg: Message, i: number) {
  return (
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
  );
}

export function MessageList({ messages, height, focusable = false }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Start typing to begin a conversation.</Text>
      </Box>
    );
  }

  const messageRows = messages.map((msg, i) => {
    if (msg.role === 'tool') {
      return renderToolMessage(msg, i);
    }
    if (msg.role === 'error') {
      return renderErrorMessage(msg, i);
    }
    return renderChatMessage(msg, i);
  });

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
