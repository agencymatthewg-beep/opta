import React, { useMemo, useRef, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { ScrollView, type ScrollViewHandle } from './ScrollView.js';
import { MarkdownText } from './MarkdownText.js';
import { ToolCard } from './ToolCard.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { ErrorDisplay } from './ErrorDisplay.js';
import type { TuiMessage, TurnActivityItem } from './App.js';
import type { ConnectionState } from './utils.js';
import { formatAssistantDisplayText, sanitizeTerminalText } from '../utils/text.js';
import { formatMarkdownTables } from '../ui/markdown.js';
import { colorizeOptaWord } from '../ui/brand.js';
import { TUI_COLORS } from './palette.js';
import { LAYOUT, computeMessageLayoutWidths } from './layout.js';
import type { MessageLayoutWidths } from './layout.js';

export { computeMessageLayoutWidths };
export type { MessageLayoutWidths };

const MESSAGE_AREA_PADDING_X = LAYOUT.messagePaddingX;
const TURN_SEPARATOR_MIN_WIDTH = LAYOUT.turnSeparatorMinWidth;
const TURN_SEPARATOR_MAX_WIDTH = LAYOUT.turnSeparatorMaxWidth;

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
  /** Live tool activity during the current turn (tracked in status bar/action history). */
  liveActivity?: TurnActivityItem[];
  /** Partial streaming text being received (current assistant response). */
  liveStreamingText?: string;
  /** Live streaming thinking text being received. */
  liveThinkingText?: string;
  /** Live streaming thinking token count. */
  liveThinkingTokens?: number;
  /** Whether to auto-follow latest output (auto-scroll). */
  autoFollow?: boolean;
  /** Imperative scroll handle ref — filled by ScrollView, called by parent. */
  scrollRef?: React.MutableRefObject<ScrollViewHandle | null>;
  /** Called by InputBox Shift+Up to scroll the message list up. */
  onScrollUp?: () => void;
  /** Called by InputBox Shift+Down to scroll the message list down. */
  onScrollDown?: () => void;
  /** Minimal rendering mode for ultra-narrow terminals. */
  safeMode?: boolean;
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
function formatTurnSeparator(turnNumber: number, width: number): string {
  const label = ` Turn ${turnNumber} `;
  const usableWidth = Math.max(Math.min(width - 2, TURN_SEPARATOR_MAX_WIDTH), TURN_SEPARATOR_MIN_WIDTH);
  if (usableWidth <= label.length + 2 || usableWidth <= 0) {
    return `Turn ${turnNumber}`;
  }
  const filler = usableWidth - label.length;
  const left = Math.floor(filler / 2);
  const right = filler - left;
  return `${'-'.repeat(left)}${label}${'-'.repeat(right)}`;
}

function TurnSeparator({ turnNumber, width }: { turnNumber: number; width: number }) {
  return (
    <Box justifyContent="center" marginTop={1}>
      <Text color={TUI_COLORS.borderSoft}>{formatTurnSeparator(turnNumber, width)}</Text>
    </Box>
  );
}

function ThinkingBlock({ text, tokens, expanded, isLive }: { text: string; tokens: number; expanded: boolean; isLive?: boolean }) {
  if (!text) return null;
  const lines = text.split('\n').filter(Boolean);

  // In collapsed state, show 2 lines for both live and cached
  const isCachedCollapsed = !expanded && !isLive;
  const displayLines = expanded ? lines : (isLive ? lines.slice(-2) : lines.slice(0, 2));

  // Explicitly tell ScrollView the line count of the text blocks
  const collapsedLines = displayLines.length + 1; // Header + text lines
  const expandedLines = lines.length + 4; // Header + separator + text + borders

  if (!expanded) {
    return React.createElement(Box, {
      flexDirection: 'column',
      marginBottom: 1,
      paddingLeft: 1,
      estimatedLines: collapsedLines
    } as any,
      <Box justifyContent="space-between" width={60}>
        <Text color={TUI_COLORS.accent} bold>Thinking Process</Text>
        <Text dimColor>{tokens} tk{isCachedCollapsed ? ' · [CTRL+T]' : ' · [CTRL+T]'}</Text>
      </Box>,
      <Box flexDirection="column" marginTop={0}>
        {displayLines.map((line, idx) => (
          <Box key={idx}>
            <Text color={TUI_COLORS.accent}>{'┃ '}</Text>
            <Text dimColor italic wrap="wrap">{line}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Expanded Mode (Console / Glass Expansion)
  return React.createElement(Box, {
    flexDirection: 'column',
    marginBottom: 1,
    borderStyle: 'round',
    borderColor: TUI_COLORS.accent,
    paddingX: 1,
    estimatedLines: expandedLines
  } as any,
    <Box justifyContent="space-between">
      <Text color={TUI_COLORS.accent} bold>Thinking Process</Text>
      <Text color={TUI_COLORS.accent}>{tokens} tk</Text>
    </Box>,
    <Box marginBottom={1}>
      <Text dimColor>{"-".repeat(20)}</Text>
    </Box>,
    <Box flexDirection="column">
      {lines.map((line, idx) => (
        <Text color={TUI_COLORS.accent} dimColor={true} wrap="wrap" key={idx}>
          {line}
        </Text>
      ))}
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

function isPreformattedSystemOutput(text: string): boolean {
  if (!text) return false;
  if (/[┌┐└┘│─├┤]/.test(text)) return true;
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  const hasRuleLike = lines.some((line) => /^[=\-_*]{8,}$/.test(line.trim()));
  const hasIndentedRows = lines.some((line) => /^\s{2,}\S/.test(line));
  const hasPipeRows = lines.some((line) => line.includes('|'));
  return hasRuleLike || (hasIndentedRows && hasPipeRows);
}

function renderSystemMessage(msg: TuiMessage, i: number): ReactNode {
  const content = colorizeOptaWord(sanitizeTerminalText(msg.content));
  const preformatted = isPreformattedSystemOutput(content);

  return (
    <Box key={`sys-${i}`} flexDirection="column" marginBottom={1}>
      <Box paddingLeft={2} flexDirection="column">
        {preformatted
          ? content.split('\n').map((line, idx) => (
            <Text key={`sys-${i}-${idx}`} dimColor wrap="wrap">{line}</Text>
          ))
          : <Text dimColor wrap="wrap">{content}</Text>}
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
      <Text dimColor>{colorizeOptaWord(sanitizeTerminalText(msg.content))}</Text>
    </Box>
  );
}

function assistantMetaLabel(msg: TuiMessage): string {
  const parts = ['Opta'];
  if (msg.imageCount) {
    parts.push(`${msg.imageCount} image${msg.imageCount > 1 ? 's' : ''}`);
  }
  if (msg.toolCalls) {
    parts.push(`${msg.toolCalls} tool call${msg.toolCalls > 1 ? 's' : ''}`);
  }
  if (msg.thinkingTokens) {
    parts.push(`thinking ${msg.thinkingTokens}`);
  }
  return parts.join(' · ');
}

function formatResponseRate(meta: NonNullable<TuiMessage['responseMeta']>): string {
  const elapsed = Number.isFinite(meta.elapsedSec) ? Math.max(meta.elapsedSec, 0) : 0;
  const rate = Number.isFinite(meta.tokensPerSecond) ? Math.max(meta.tokensPerSecond, 0) : 0;
  return `${elapsed.toFixed(1)}s · ${rate.toFixed(1)} t/s`;
}

function buildMarkdownEstimateText(text: string, width: number): string {
  if (!text) return '';
  return formatMarkdownTables(sanitizeTerminalText(text), Math.max(1, width));
}

function MetaTimestamp({ timestamp }: { timestamp: string }) {
  return (
    <Box justifyContent="flex-end">
      <Text dimColor>{timestamp}</Text>
    </Box>
  );
}

interface ChatMessageProps {
  msg: TuiMessage;
  index: number;
  isStreaming: boolean;
  assistantBodyWidth: number;
  safeAssistantBodyWidth: number;
  safeMode: boolean;
  thinkingExpanded: boolean;
}

export function ChatMessage({
  msg,
  index,
  isStreaming,
  assistantBodyWidth,
  safeAssistantBodyWidth,
  safeMode,
  thinkingExpanded,
}: ChatMessageProps) {
  const isAssistant = msg.role === 'assistant';
  const createdAtRef = useRef<number>(msg.createdAt ?? Date.now());
  const timestamp = formatTime(new Date(createdAtRef.current));
  const formattedAssistantText = isAssistant
    ? formatAssistantDisplayText(msg.content, { streaming: isStreaming })
    : '';
  const bodyWidth = safeMode ? safeAssistantBodyWidth : assistantBodyWidth;
  const assistantEstimateText = isAssistant
    ? buildMarkdownEstimateText(formattedAssistantText, bodyWidth)
    : '';
  const completionMeta = isAssistant && !isStreaming ? msg.responseMeta : undefined;

  // For assistant messages, render with purple border
  if (isAssistant) {
    const meta = assistantMetaLabel(msg);
    if (safeMode) {
      return (
        <Box key={index} flexDirection="column" marginBottom={1} width="100%">
          <Box>
            <Text color={TUI_COLORS.accent} bold>{'\u25C6'} {meta}</Text>
          </Box>
          <MetaTimestamp timestamp={timestamp} />
          {completionMeta ? (
            <>
              <Box justifyContent="flex-end">
                <Text color={TUI_COLORS.info}>{formatResponseRate(completionMeta)}</Text>
              </Box>
              <Box justifyContent="flex-end">
                <Text dimColor wrap="truncate-end">{completionMeta.intent}</Text>
              </Box>
            </>
          ) : null}
          <Box paddingLeft={2} flexDirection="column">
            {msg.thinking && msg.thinking.text && (
              <Box marginBottom={1}>
                <ThinkingBlock
                  text={msg.thinking.text}
                  tokens={msg.thinking.tokens}
                  expanded={thinkingExpanded}
                  isLive={false}
                />
              </Box>
            )}
            <MarkdownText
              text={formattedAssistantText}
              isStreaming={isStreaming}
              width={safeAssistantBodyWidth}
              estimatedText={assistantEstimateText}
            />
          </Box>
        </Box>
      );
    }

    return (
      <Box key={index} flexDirection="column" marginBottom={1} width="100%">
        <Box
          borderStyle="round"
          borderColor={TUI_COLORS.accent}
          flexDirection="column"
          paddingX={1}
        >
          <Box>
            <Text color={TUI_COLORS.accent} bold>{'\u25C6'} {meta}</Text>
          </Box>
          <MetaTimestamp timestamp={timestamp} />
          {completionMeta ? (
            <>
              <Box justifyContent="flex-end">
                <Text color={TUI_COLORS.info}>{formatResponseRate(completionMeta)}</Text>
              </Box>
              <Box justifyContent="flex-end">
                <Text dimColor wrap="truncate-end">{completionMeta.intent}</Text>
              </Box>
            </>
          ) : null}
          <Box paddingLeft={1} paddingY={0} flexDirection="column">
            {msg.thinking && msg.thinking.text && (
              <Box marginBottom={1}>
                <ThinkingBlock
                  text={msg.thinking.text}
                  tokens={msg.thinking.tokens}
                  expanded={thinkingExpanded}
                  isLive={false}
                />
              </Box>
            )}
            <MarkdownText
              text={formattedAssistantText}
              isStreaming={isStreaming}
              width={assistantBodyWidth}
              estimatedText={assistantEstimateText}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // User/system messages — no border
  return (
    <Box key={index} flexDirection="column" marginBottom={1} width="100%">
      <Box>
        <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
          {msg.role === 'user' ? '> you' : '\u25C6 Opta'}
        </Text>
      </Box>
      <MetaTimestamp timestamp={timestamp} />
      <Box paddingLeft={2}>
        <Text wrap="wrap">{colorizeOptaWord(sanitizeTerminalText(msg.content))}</Text>
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
  liveThinkingText,
  liveThinkingTokens,
  autoFollow = true,
  scrollRef,
  safeMode = false,
}: MessageListProps) {
  const hasLiveContent = !!liveStreamingText;

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

  const layoutWidths = useMemo(
    () => computeMessageLayoutWidths(terminalWidth),
    [terminalWidth],
  );

  // Build permanent message rows with turn separators.
  // A new "turn" starts at each user message.
  const messageRows = useMemo(() => {
    let turnCount = 0;
    const rows: ReactNode[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;

      if (msg.role === 'user') {
        turnCount++;
        if (turnCount > 1) {
          rows.push(
            <TurnSeparator
              key={`sep-${turnCount}`}
              turnNumber={turnCount}
              width={layoutWidths.messageContentWidth}
            />,
          );
        }
      }

      if (msg.role === 'tool') {
        rows.push(renderToolMessage(msg, i));
      } else if (msg.role === 'error') {
        rows.push(renderErrorMessage(msg, i));
      } else if (msg.role === 'system') {
        rows.push(renderSystemMessage(msg, i));
      } else if (msg.role === 'activity-summary') {
        rows.push(renderActivitySummary(msg, i));
      } else {
        rows.push(
          <ChatMessage
            key={i}
            msg={msg}
            index={i}
            isStreaming={false}
            assistantBodyWidth={layoutWidths.assistantBodyWidth}
            safeAssistantBodyWidth={layoutWidths.safeAssistantBodyWidth}
            safeMode={safeMode}
            thinkingExpanded={thinkingExpanded}
          />,
        );
      }
    }

    return rows;
  }, [messages, layoutWidths.assistantBodyWidth, layoutWidths.safeAssistantBodyWidth, safeMode]);

  // Live rows: shown below permanent messages during an active turn.
  // These collapse into a permanent activity-summary + assistant message on turn:end.
  const liveRows = useMemo(() => {
    const rows: ReactNode[] = [];
    if (!liveStreamingText && !liveThinkingText) return rows;
    const formattedLiveText = liveStreamingText ? formatAssistantDisplayText(liveStreamingText, { streaming: true }) : '';
    const liveWidth = safeMode ? layoutWidths.safeAssistantBodyWidth : layoutWidths.assistantBodyWidth;
    const liveEstimateText = formattedLiveText ? buildMarkdownEstimateText(formattedLiveText, liveWidth) : '';

    rows.push(
      <Box key="live-text" flexDirection="column" marginBottom={1} width="100%">
        <Box
          borderStyle={safeMode ? undefined : 'round'}
          borderColor={safeMode ? undefined : TUI_COLORS.accent}
          flexDirection="column"
          paddingX={safeMode ? 0 : 1}
        >
          <Box>
            <Text color={TUI_COLORS.accent} bold>{'◆'} Opta · streaming</Text>
          </Box>
          <Box justifyContent="flex-end">
            <Text dimColor>live</Text>
          </Box>
          <Box paddingLeft={safeMode ? 2 : 1} flexDirection="column">
            {liveThinkingText && (
              <Box marginBottom={formattedLiveText ? 1 : 0}>
                <ThinkingBlock
                  text={liveThinkingText}
                  tokens={liveThinkingTokens ?? 0}
                  expanded={thinkingExpanded}
                  isLive={true}
                />
              </Box>
            )}
            {formattedLiveText && (
              <MarkdownText
                text={formattedLiveText}
                isStreaming={true}
                width={liveWidth}
                estimatedText={liveEstimateText}
              />
            )}
          </Box>
        </Box>
      </Box>,
    );
    return rows;
  }, [liveStreamingText, liveThinkingText, liveThinkingTokens, thinkingExpanded, layoutWidths.assistantBodyWidth, layoutWidths.safeAssistantBodyWidth, safeMode]);

  if (height !== undefined && height > 0) {
    return (
      <Box paddingX={MESSAGE_AREA_PADDING_X} width="100%" flexGrow={1}>
        <ScrollView
          height={height}
          autoScroll={autoFollow}
          focusable={focusable}
          contentWidth={layoutWidths.scrollContentWidth}
          scrollRef={scrollRef}
        >
          {messageRows}
          {liveRows}
        </ScrollView>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={MESSAGE_AREA_PADDING_X} width="100%" flexGrow={1}>
      {messageRows}
      {liveRows}
    </Box>
  );
}
