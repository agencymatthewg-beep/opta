import React from 'react';
import { Box, Text } from 'ink';

interface InkStatusBarProps {
  model: string;
  tokens: number;
  cost: string;
  tools: number;
  speed: number;
  mode?: string;
  sessionId?: string;
}

function fmtTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function InkStatusBar({ model, tokens, cost, tools, speed, mode, sessionId }: InkStatusBarProps) {
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
        <Text dimColor>~{fmtTokens(tokens)} tokens</Text>
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
      </Box>
    </Box>
  );
}
