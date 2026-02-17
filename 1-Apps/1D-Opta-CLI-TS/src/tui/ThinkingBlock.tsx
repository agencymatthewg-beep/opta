import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { estimateTokens } from '../utils/tokens.js';

export interface ThinkingBlockProps {
  /** The raw thinking/reasoning text from the model. */
  text: string;
  /** Whether to show the full thinking content or just a summary line. */
  expanded: boolean;
  /** Pre-computed token count. If not provided, estimated from text. */
  tokenCount?: number;
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
}: ThinkingBlockProps) {
  if (!text) return null;

  const tokens = tokenCount ?? estimateTokens(text);

  if (!expanded) {
    return (
      <Box paddingLeft={2} marginBottom={0}>
        <Text dimColor>
          {'⚙ thinking ('}{tokens}{' tokens) [Ctrl+T to expand]'}
        </Text>
      </Box>
    );
  }

  // Expanded: show full thinking text with border prefix on each line
  const lines = text.split('\n');

  return (
    <Box flexDirection="column" paddingLeft={2} marginBottom={0}>
      <Text dimColor>
        {'⚙ thinking ('}{tokens}{' tokens)'}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} dimColor italic>
          {'│ '}{line}
        </Text>
      ))}
      <Text dimColor>{'└─'}</Text>
    </Box>
  );
});
