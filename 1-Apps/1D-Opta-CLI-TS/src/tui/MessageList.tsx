import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { ScrollView } from './ScrollView.js';
import { MarkdownText } from './MarkdownText.js';
import { ToolCard, CompactToolItem } from './ToolCard.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import type { TuiMessage, TurnActivityItem } from './App.js';
import type { ConnectionState } from './utils.js';

/** Padding consumed by left/right paddingX on the message area. */
const PADDING_CHARS = 4;

interface MessageListProps {
  messages: TuiMessage[];
  height?: number;
  focusable?: boolean;
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
  /** Live tool activity during the current turn (shown below permanent messages). */
  liveActivity?: TurnActivityItem[];
  /** Partial streaming text being received (current assistant response). */
  liveStreamingText?: string;
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

/**
 * Dim single-line summary of tool activity from a completed turn.
 * Format: ◇ toolA · toolB  2.4s
 */
function renderActivitySummary(msg: TuiMessage, i: number): ReactNode {
  return (
    <Box key={`act-${i}`} paddingX={2} marginBottom={0}>
      <Text dimColor>{msg.content}</Text>
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

export function ChatMessage({ msg, index, isStreaming, markdownWidth, thinkingExpanded }: ChatMessageProps) {
  const isAssistant = msg.role === 'assistant';
  const timestamp = formatTime(new Date());

  // For assistant messages, render with purple border
  if (isAssistant) {
    return (
      <Box key={index} flexDirection="column" marginBottom={1}>
        <Box
          borderStyle="round"
          borderColor="#8b5cf6"
          flexDirection="column"
          paddingX={1}
          marginBottom={1}
        >
          <Box justifyContent="space-between" width="100%">
            <Box>
              <Text color="#8b5cf6" bold>
                {'\u25C6'} opta
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
          {msg.thinking && (
            <ThinkingBlock
              text={msg.thinking.text}
              expanded={thinkingExpanded}
              tokenCount={msg.thinking.tokens}
            />
          )}
          <Box paddingLeft={1} paddingY={0}>
            <MarkdownText text={msg.content} isStreaming={isStreaming} width={markdownWidth - 2} />
          </Box>
        </Box>
      </Box>
    );
  }

  // User/system messages — no border
  return (
    <Box key={index} flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
            {msg.role === 'user' ? '> you' : '\u25C6 opta'}
          </Text>
        </Box>
        <Text dimColor>{timestamp}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text wrap="wrap">{msg.content}</Text>
      </Box>
    </Box>
  );
}

export function MessageList({
  messages,
  height,
  focusable = false,
  terminalWidth = 100,
  thinkingExpanded = false,
  connectionState,
  model,
  contextTotal,
  toolCount,
  liveActivity,
  liveStreamingText,
}: MessageListProps) {
  const hasLiveContent = (liveActivity && liveActivity.length > 0) || !!liveStreamingText;

  if (messages.length === 0 && !hasLiveContent) {
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

  // Build permanent message rows with turn separators.
  // A new "turn" starts at each user message.
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
    } else if (msg.role === 'activity-summary') {
      messageRows.push(renderActivitySummary(msg, i));
    } else {
      messageRows.push(
        <ChatMessage
          key={i}
          msg={msg}
          index={i}
          isStreaming={false}
          markdownWidth={markdownWidth}
          thinkingExpanded={thinkingExpanded}
        />,
      );
    }
  }

  // Live rows: shown below permanent messages during an active turn.
  // These collapse into a permanent activity-summary + assistant message on turn:end.
  const liveRows: ReactNode[] = [];

  if (liveActivity && liveActivity.length > 0) {
    liveActivity.forEach((item, idx) => {
      if (item.type === 'tool') {
        liveRows.push(
          <CompactToolItem
            key={`live-${idx}`}
            name={item.toolName ?? 'tool'}
            status={item.toolStatus ?? 'running'}
            args={item.toolArgs}
          />,
        );
      }
    });
  }

  if (liveStreamingText) {
    liveRows.push(
      <Box key="live-text" paddingX={2}>
        <MarkdownText
          text={liveStreamingText}
          isStreaming={true}
          width={markdownWidth - 4}
        />
      </Box>,
    );
  }

  if (height !== undefined && height > 0) {
    return (
      <Box paddingX={1}>
        <ScrollView height={height} autoScroll focusable={focusable} contentWidth={terminalWidth - PADDING_CHARS}>
          {messageRows}
          {liveRows}
        </ScrollView>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {messageRows}
      {liveRows}
    </Box>
  );
}
