import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens } from '../utils/tokens.js';

interface InkStatusBarProps {
  model: string;
  tokens: number;
  cost: string;
  tools: number;
  speed: number;
  mode?: string;
  sessionId?: string;
  /** When true, show only model + tokens (skip cost, tools, speed). */
  compact?: boolean;
}

export function InkStatusBar({ model, tokens, cost, tools, speed, mode, sessionId, compact }: InkStatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text color="green">*</Text>
        <Text> {model}</Text>
        {mode && mode !== 'normal' && (
          <>
            <Text dimColor> | </Text>
            <Text color={mode === 'plan' ? 'magenta' : 'yellow'}>{mode}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text dimColor>~{formatTokens(tokens)} tokens</Text>
        {!compact && (
          <>
            <Text dimColor> | </Text>
            <Text dimColor>{tools} tools</Text>
            {speed > 0 && (
              <>
                <Text dimColor> | </Text>
                <Text dimColor>{speed.toFixed(0)} t/s</Text>
              </>
            )}
            <Text dimColor> | </Text>
            <Text color="green">{cost}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
