import React from 'react';
import { Box, Text } from 'ink';

interface SidebarProps {
  model: string;
  sessionId: string;
  tokens: { prompt: number; completion: number; total: number };
  tools: number;
  cost: string;
  mode: string;
  elapsed: number;
  speed?: number;
  title?: string;
}

function fmtTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function Sidebar({
  model, sessionId, tokens, tools, cost, mode, elapsed, speed, title,
}: SidebarProps) {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Session</Text>
      <Box marginTop={1} flexDirection="column">
        <Row label="Model" value={model} />
        <Row label="Session" value={sessionId.slice(0, 8)} />
        {title && <Row label="Title" value={title.slice(0, 20)} />}
        <Row label="Mode" value={mode} color={mode === 'plan' ? 'magenta' : mode === 'auto' ? 'yellow' : undefined} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Tokens</Text>
        <Row label="Prompt" value={fmtTokens(tokens.prompt)} />
        <Row label="Reply" value={fmtTokens(tokens.completion)} />
        <Row label="Total" value={fmtTokens(tokens.total)} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Stats</Text>
        <Row label="Tools" value={String(tools)} />
        <Row label="Cost" value={cost} color="green" />
        {elapsed > 0 && <Row label="Time" value={`${elapsed.toFixed(1)}s`} />}
        {speed !== undefined && speed > 0 && <Row label="Speed" value={`${speed.toFixed(0)} t/s`} />}
      </Box>
    </Box>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Text dimColor>{label.padEnd(8)}</Text>
      <Text {...(color ? { color } : {})}>{value}</Text>
    </Box>
  );
}
