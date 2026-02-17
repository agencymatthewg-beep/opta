import React, { type ReactNode, memo } from 'react';
import { Box, Text } from 'ink';
import { ScrollView } from './ScrollView.js';
import { MarkdownText } from './MarkdownText.js';
import type { TuiMessage } from './App.js';

/** Max characters shown inline for a completed tool result. */
const TOOL_INLINE_PREVIEW_LENGTH = 80;

/** Padding consumed by left/right paddingX on the message area. */
const PADDING_CHARS = 4;

interface MessageListProps {
  messages: TuiMessage[];
  height?: number;
  focusable?: boolean;
  /** Index of the currently streaming message, or null/undefined if idle. */
  streamingIdx?: number | null;
  /** Terminal width in columns. Defaults to 100. */
  terminalWidth?: number;
}

function renderToolMessage(msg: TuiMessage, i: number): ReactNode {
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
        <Text dimColor> {msg.content.slice(0, TOOL_INLINE_PREVIEW_LENGTH)}{msg.content.length > TOOL_INLINE_PREVIEW_LENGTH ? '...' : ''}</Text>
      )}
    </Box>
  );
}

function renderErrorMessage(msg: TuiMessage, i: number): ReactNode {
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

interface ChatMessageProps {
  msg: TuiMessage;
  index: number;
  isStreaming: boolean;
  markdownWidth: number;
}

const ChatMessage = memo(function ChatMessage({ msg, index, isStreaming, markdownWidth }: ChatMessageProps) {
  const isAssistant = msg.role === 'assistant';

  return (
    <Box key={index} flexDirection="column" marginBottom={1}>
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
        {isAssistant ? (
          <MarkdownText text={msg.content} isStreaming={isStreaming} width={markdownWidth} />
        ) : (
          <Text wrap="wrap">{msg.content}</Text>
        )}
      </Box>
    </Box>
  );
});

export function MessageList({
  messages,
  height,
  focusable = false,
  streamingIdx,
  terminalWidth = 100,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Start typing to begin a conversation.</Text>
      </Box>
    );
  }

  // Account for padding when calculating markdown rendering width
  const markdownWidth = Math.max(terminalWidth - PADDING_CHARS, 40);

  const messageRows = messages.map((msg, i) => {
    if (msg.role === 'tool') {
      return renderToolMessage(msg, i);
    }
    if (msg.role === 'error') {
      return renderErrorMessage(msg, i);
    }
    const isStreaming = msg.role === 'assistant' && i === streamingIdx;
    return (
      <ChatMessage
        key={i}
        msg={msg}
        index={i}
        isStreaming={isStreaming}
        markdownWidth={markdownWidth}
      />
    );
  });

  if (height !== undefined && height > 0) {
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
