import React, { type ReactNode, memo } from 'react';
import { Box, Text } from 'ink';
import { ScrollView } from './ScrollView.js';
import { MarkdownText } from './MarkdownText.js';
import { ToolCard } from './ToolCard.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import type { TuiMessage } from './App.js';

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
  /** Whether thinking blocks are expanded (global toggle via Ctrl+T). */
  thinkingExpanded?: boolean;
}

function renderToolMessage(msg: TuiMessage, i: number): ReactNode {
  const status = msg.toolStatus === 'running' ? 'running'
    : msg.toolStatus === 'error' ? 'error'
    : 'done';

  return (
    <ToolCard
      key={`tool-${i}`}
      name={msg.toolName ?? 'tool'}
      status={status}
      args={msg.toolArgs}
      result={status !== 'running' ? msg.content : undefined}
      collapsed={true}
    />
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

function renderSystemMessage(msg: TuiMessage, i: number): ReactNode {
  return (
    <Box key={`sys-${i}`} flexDirection="column" marginBottom={1}>
      <Box paddingLeft={2}>
        <Text dimColor wrap="wrap">{msg.content}</Text>
      </Box>
    </Box>
  );
}

interface ChatMessageProps {
  msg: TuiMessage;
  index: number;
  isStreaming: boolean;
  markdownWidth: number;
  thinkingExpanded: boolean;
}

const ChatMessage = memo(function ChatMessage({ msg, index, isStreaming, markdownWidth, thinkingExpanded }: ChatMessageProps) {
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
      {isAssistant && msg.thinking && (
        <ThinkingBlock
          text={msg.thinking.text}
          expanded={thinkingExpanded}
          tokenCount={msg.thinking.tokens}
        />
      )}
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
  thinkingExpanded = false,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1} flexDirection="column">
        <Text dimColor>Start typing to begin a conversation.</Text>
        <Text dimColor>Type /help for commands, Ctrl+/ for keybindings.</Text>
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
    if (msg.role === 'system') {
      return renderSystemMessage(msg, i);
    }
    const isStreaming = msg.role === 'assistant' && i === streamingIdx;
    return (
      <ChatMessage
        key={i}
        msg={msg}
        index={i}
        isStreaming={isStreaming}
        markdownWidth={markdownWidth}
        thinkingExpanded={thinkingExpanded}
      />
    );
  });

  if (height !== undefined && height > 0) {
    return (
      <Box paddingX={1}>
        <ScrollView height={height} autoScroll focusable={focusable} contentWidth={terminalWidth - PADDING_CHARS}>
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
