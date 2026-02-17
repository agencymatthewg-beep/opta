import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens } from '../utils/tokens.js';

type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'error';

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
  connectionState?: ConnectionState;
  contextUsage?: { used: number; total: number };
}

function connectionDot(state?: ConnectionState) {
  if (state) {
    switch (state) {
      case 'checking': return { char: '◌', color: 'yellow', label: 'Checking...' };
      case 'connected': return { char: '●', color: 'green', label: 'Connected' };
      case 'disconnected': return { char: '○', color: 'red', label: 'Disconnected' };
      case 'error': return { char: '✗', color: 'red', label: 'Error' };
    }
  }
  return { char: '●', color: 'green', label: 'Connected' };
}

function shortModelName(model: string): string {
  return model
    .replace(/^lmstudio-community\//, '')
    .replace(/^mlx-community\//, '')
    .replace(/^huggingface\//, '');
}

function contextBar(used: number, total: number): string {
  const pct = Math.min(used / total, 1);
  const filled = Math.round(pct * 10);
  const empty = 10 - filled;
  return '\u25B0'.repeat(filled) + '\u25B1'.repeat(empty);
}

function contextBarColor(used: number, total: number): string {
  const pct = used / total;
  if (pct >= 0.8) return 'red';
  if (pct >= 0.5) return 'yellow';
  return 'green';
}

export function Sidebar({
  model, sessionId, tokens, tools, cost, mode, elapsed, speed, title,
  connectionState, contextUsage,
}: SidebarProps) {
  const dot = connectionDot(connectionState);
  const hasContext = contextUsage != null && contextUsage.total > 0;
  const ctxPct = hasContext ? Math.round((contextUsage!.used / contextUsage!.total) * 100) : 0;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Connection</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>{'Status'.padEnd(8)}</Text>
          <Text color={dot.color}>{dot.char}</Text>
          <Text color={dot.color}> {dot.label}</Text>
        </Box>
        <Row label="Model" value={shortModelName(model)} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Session</Text>
        <Box marginTop={1} flexDirection="column">
          <Row label="Session" value={sessionId.slice(0, 8)} />
          {title && <Row label="Title" value={title.slice(0, 20)} />}
          <Row label="Mode" value={mode} color={mode === 'plan' ? 'magenta' : mode === 'auto' ? 'yellow' : undefined} />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Tokens</Text>
        <Row label="Prompt" value={formatTokens(tokens.prompt)} />
        <Row label="Reply" value={formatTokens(tokens.completion)} />
        <Row label="Total" value={formatTokens(tokens.total)} />
        {hasContext && (
          <Box>
            <Text dimColor>{'Context'.padEnd(8)}</Text>
            <Text color={contextBarColor(contextUsage!.used, contextUsage!.total)}>
              {contextBar(contextUsage!.used, contextUsage!.total)}
            </Text>
            <Text dimColor> {ctxPct}%</Text>
          </Box>
        )}
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
