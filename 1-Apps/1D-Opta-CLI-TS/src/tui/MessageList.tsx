import React, { type ReactNode, memo } from 'react';
import { Box, Text } from 'ink';
import { ScrollView } from './ScrollView.js';
import { MarkdownText } from './MarkdownText.js';
import { ToolCard } from './ToolCard.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import type { TuiMessage } from './App.js';
import type { ConnectionState } from './utils.js';

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
  /** Connection state for the welcome screen. */
  connectionState?: ConnectionState;
  /** Current model name for the welcome screen. */
  model?: string;
  /** Total context window size (tokens) for the welcome screen. */
  contextTotal?: number;
  /** Number of registered tools for the welcome screen. */
  toolCount?: number;
}

/** Format a Date as a lowercase 12-hour time string (e.g. "2:35 pm"). */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
}

/** Visual separator between conversation turns. */
function TurnSeparator({ turnNumber }: { turnNumber: number }) {
  return (
    <Box paddingX={1} marginY={0}>
      <Text dimColor>{'\u2500'.repeat(20)} turn {turnNumber} {'\u2500'.repeat(20)}</Text>
    </Box>
  );
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
    <Box key={`err-${i}`}>
      <ErrorDisplay message={msg.content} />
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
  const timestamp = formatTime(new Date());

  return (
    <Box key={index} flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
            {msg.role === 'user' ? '> you' : '\u25C6 opta'}
          </Text>
          {msg.imageCount ? (
            <Text dimColor> [{msg.imageCount} image{msg.imageCount > 1 ? 's' : ''}]</Text>
          ) : null}
          {msg.toolCalls ? (
            <Text dimColor> ({msg.toolCalls} tool calls)</Text>
          ) : null}
          {msg.thinkingTokens ? (
            <Text dimColor> (thinking {msg.thinkingTokens})</Text>
          ) : null}
        </Box>
        <Text dimColor>{timestamp}</Text>
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
  connectionState,
  model,
  contextTotal,
  toolCount,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1} flexDirection="column">
        <WelcomeScreen
          connectionState={connectionState}
          model={model}
          contextTotal={contextTotal}
          toolCount={toolCount}
        />
      </Box>
    );
  }

  // Account for padding when calculating markdown rendering width
  const markdownWidth = Math.max(terminalWidth - PADDING_CHARS, 40);

  // Build message rows with turn separators between conversation turns.
  // A new "turn" starts at each user message. We insert a separator
  // before every user message except the first one.
  let turnCount = 0;
  const messageRows: ReactNode[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg.role === 'user') {
      turnCount++;
      if (turnCount > 1) {
        messageRows.push(<TurnSeparator key={`sep-${turnCount}`} turnNumber={turnCount - 1} />);
      }
    }

    if (msg.role === 'tool') {
      messageRows.push(renderToolMessage(msg, i));
    } else if (msg.role === 'error') {
      messageRows.push(renderErrorMessage(msg, i));
    } else if (msg.role === 'system') {
      messageRows.push(renderSystemMessage(msg, i));
    } else {
      const isStreaming = msg.role === 'assistant' && i === streamingIdx;
      messageRows.push(
        <ChatMessage
          key={i}
          msg={msg}
          index={i}
          isStreaming={isStreaming}
          markdownWidth={markdownWidth}
          thinkingExpanded={thinkingExpanded}
        />
      );
    }
  }

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
