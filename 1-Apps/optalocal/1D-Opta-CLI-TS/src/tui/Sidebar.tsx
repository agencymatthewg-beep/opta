import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens } from '../utils/tokens.js';
import { fitTextToWidth } from '../utils/terminal-layout.js';
import { formatAssistantDisplayText, sanitizeTerminalText } from '../utils/text.js';
import { type ConnectionState, connectionDot, shortModelName, contextBar, contextBarColor } from './utils.js';

const THINKING_LINE_WIDTH = 22;
const THINKING_LINES_COLLAPSED = 2;
const THINKING_LINES_EXPANDED = 8;

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
  liveThinkingText?: string;
  liveThinkingTokens?: number;
  thinkingExpanded?: boolean;
  thinkingActive?: boolean;
}

export function Sidebar({
  model, sessionId, tokens, tools, cost, mode, elapsed, speed, title,
  connectionState, contextUsage,
  liveThinkingText = '',
  liveThinkingTokens = 0,
  thinkingExpanded = false,
  thinkingActive = false,
}: SidebarProps) {
  const dot = connectionDot(connectionState, true);
  const hasContext = contextUsage != null && contextUsage.total > 0;
  const ctxPct = hasContext ? Math.round((contextUsage!.used / contextUsage!.total) * 100) : 0;
  const formattedThinking = sanitizeTerminalText(
    formatAssistantDisplayText(liveThinkingText, { streaming: true }),
  );
  const thinkingLines = formattedThinking
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const visibleThinkingLines = (thinkingExpanded
    ? thinkingLines.slice(-THINKING_LINES_EXPANDED)
    : thinkingLines.slice(-THINKING_LINES_COLLAPSED));
  const thinkingState = thinkingActive ? 'Live' : (thinkingLines.length > 0 ? 'Cached' : 'Idle');

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

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Live Thinking</Text>
        <Box marginTop={1} flexDirection="column">
          <Row label="State" value={thinkingState} color={thinkingActive ? 'green' : undefined} />
          <Row label="Tokens" value={formatTokens(liveThinkingTokens)} />
          {visibleThinkingLines.length === 0 ? (
            <Text dimColor>Awaiting model thoughts...</Text>
          ) : (
            visibleThinkingLines.map((line, index) => (
              <Text key={`${index}-${line.slice(0, 12)}`} dimColor wrap="truncate-end">
                {fitTextToWidth(line, THINKING_LINE_WIDTH)}
              </Text>
            ))
          )}
          <Text dimColor>{thinkingExpanded ? 'Ctrl+T collapse' : 'Ctrl+T expand'}</Text>
        </Box>
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
