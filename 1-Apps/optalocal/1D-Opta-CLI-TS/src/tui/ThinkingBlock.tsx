import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { estimateTokens } from '../utils/tokens.js';
import { formatAssistantDisplayText, sanitizeTerminalText } from '../utils/text.js';
import { TUI_COLORS } from './palette.js';

export interface ThinkingBlockProps {
  /** The raw thinking/reasoning text from the model. */
  text: string;
  /** Whether to show the full thinking content or just a summary line. */
  expanded: boolean;
  /** Pre-computed token count. If not provided, estimated from text. */
  tokenCount?: number;
  /** When true, renders a compact single-line format for live streaming display. */
  isLive?: boolean;
}

/**
 * ThinkingBlock — displays model thinking/reasoning content.
 *
 * Two modes:
 * - Collapsed (default): single dim summary line with token count
 * - Expanded: full thinking text with dim italic styling and border prefix
 */
export const ThinkingBlock = memo(function ThinkingBlock({
  text,
  expanded,
  tokenCount,
  isLive = false,
}: ThinkingBlockProps) {
  const rawText = sanitizeTerminalText(text);
  if (!rawText) return null;
  const safeText = formatAssistantDisplayText(rawText, { streaming: false });

  const tokens = tokenCount ?? estimateTokens(safeText);

  if (isLive) {
    return (
      <Box paddingLeft={2} marginBottom={0}>
        <Text color={TUI_COLORS.accent}>◩ </Text>
        <Text color={TUI_COLORS.borderSoft}>Thinking... {tokens} tokens</Text>
      </Box>
    );
  }

  if (!expanded) {
    return (
      <Box paddingLeft={2} marginBottom={0}>
        <Text color={TUI_COLORS.borderSoft}>
          {'⚙ thinking ('}{tokens}{' tokens) [Ctrl+T to expand]'}
        </Text>
      </Box>
    );
  }

  // Expanded: show full thinking text with border prefix on each line
  const lines = safeText.split('\n');

  return (
    <Box flexDirection="column" paddingLeft={2} marginBottom={0}>
      <Text color={TUI_COLORS.borderSoft}>
        {'⚙ thinking ('}{tokens}{' tokens)'}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} color={TUI_COLORS.borderSoft} wrap="wrap">
          {'│ '}{line}
        </Text>
      ))}
      <Text color={TUI_COLORS.borderSoft}>{'└─'}</Text>
    </Box>
  );
});
