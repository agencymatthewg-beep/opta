import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens } from '../utils/tokens.js';

type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'error';

interface InkStatusBarProps {
  model: string;
  tokens: number;
  cost: string;
  tools: number;
  speed: number;
  mode?: string;
  sessionId?: string;
  /** When true, show only connection dot + model + elapsed (if active). */
  compact?: boolean;
  connectionState?: ConnectionState;
  turnElapsed?: number;
  turnPhase?: string;
  promptTokens?: number;
  completionTokens?: number;
  contextUsed?: number;
  contextTotal?: number;
}

function connectionDot(state?: ConnectionState) {
  if (state) {
    switch (state) {
      case 'checking': return { char: '◌', color: 'yellow' };
      case 'connected': return { char: '●', color: 'green' };
      case 'disconnected': return { char: '○', color: 'red' };
      case 'error': return { char: '✗', color: 'red' };
    }
  }
  return { char: '●', color: 'green' };
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

const ACTIVE_PHASES = new Set(['streaming', 'waiting', 'tool-call']);

export function InkStatusBar({
  model, tokens, cost, tools, speed, mode, sessionId, compact,
  connectionState, turnElapsed, turnPhase,
  promptTokens, completionTokens,
  contextUsed, contextTotal,
}: InkStatusBarProps) {
  const dot = connectionDot(connectionState);
  const isActive = turnPhase != null && ACTIVE_PHASES.has(turnPhase);
  const hasContext = contextUsed != null && contextTotal != null && contextTotal > 0;
  const hasTokenSplit = promptTokens != null && promptTokens > 0;
  const ctxPct = hasContext ? Math.round((contextUsed! / contextTotal!) * 100) : 0;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text color={dot.color}>{dot.char}</Text>
        <Text> {shortModelName(model)}</Text>
        {mode && mode !== 'normal' && (
          <>
            <Text dimColor> | </Text>
            <Text color={mode === 'plan' ? 'magenta' : 'yellow'}>{mode}</Text>
          </>
        )}
        {isActive && turnElapsed != null && turnElapsed > 0 && (
          <>
            <Text dimColor> | </Text>
            <Text dimColor>{'\u23F1'} {turnElapsed.toFixed(1)}s</Text>
          </>
        )}
      </Box>
      {!compact && (
        <Box>
          {hasTokenSplit ? (
            <Text dimColor>{formatTokens(promptTokens!)}{'\u2192'}{formatTokens(completionTokens ?? 0)} tok</Text>
          ) : (
            <Text dimColor>~{formatTokens(tokens)} tok</Text>
          )}
          {hasContext && (
            <>
              <Text dimColor> | CTX </Text>
              <Text color={contextBarColor(contextUsed!, contextTotal!)}>{contextBar(contextUsed!, contextTotal!)}</Text>
              <Text dimColor> {ctxPct}%</Text>
            </>
          )}
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
      )}
      {compact && (
        <Box>
          {hasTokenSplit ? (
            <Text dimColor>{formatTokens(promptTokens!)}{'\u2192'}{formatTokens(completionTokens ?? 0)} tok</Text>
          ) : (
            <Text dimColor>~{formatTokens(tokens)} tok</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
