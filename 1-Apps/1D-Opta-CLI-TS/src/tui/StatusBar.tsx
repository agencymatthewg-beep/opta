import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens } from '../utils/tokens.js';
import { type ConnectionState, connectionDot, shortModelName, contextBar, contextBarColor } from './utils.js';

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
  bypassPermissions?: boolean;
}

const ACTIVE_PHASES = new Set(['streaming', 'waiting', 'tool-call']);

export function InkStatusBar({
  model, tokens, cost, speed, mode: _mode, sessionId: _sessionId, compact,
  connectionState, turnElapsed, turnPhase,
  promptTokens, completionTokens,
  contextUsed, contextTotal,
  bypassPermissions,
}: InkStatusBarProps) {
  const dot = connectionDot(connectionState, true);
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
      {/* Left side: connection dot + model name + bypass indicator + elapsed */}
      <Box>
        <Text color={dot.color}>{dot.char}</Text>
        <Text> {shortModelName(model)}</Text>
        {bypassPermissions && (
          <>
            <Text dimColor> </Text>
            <Text color="red" bold>{'⚠ BYPASS'}</Text>
          </>
        )}
        {isActive && turnElapsed != null && turnElapsed > 0 && (
          <>
            <Text dimColor> │ </Text>
            <Text dimColor>{'\u23F1'} {turnElapsed.toFixed(1)}s</Text>
          </>
        )}
      </Box>

      {/* Right side: context bar + token counts + speed + cost */}
      {!compact && (
        <Box>
          {hasContext && (
            <>
              <Text dimColor>CTX </Text>
              <Text color={contextBarColor(contextUsed!, contextTotal!)}>{contextBar(contextUsed!, contextTotal!)}</Text>
              <Text dimColor> {ctxPct}%</Text>
              <Text dimColor> │ </Text>
            </>
          )}
          {hasTokenSplit ? (
            <Text dimColor>{formatTokens(promptTokens!)}{'\u2192'}{formatTokens(completionTokens ?? 0)} tok</Text>
          ) : (
            <Text dimColor>~{formatTokens(tokens)} tok</Text>
          )}
          {speed > 0 && (
            <>
              <Text dimColor> │ </Text>
              <Text dimColor>{speed.toFixed(0)} t/s</Text>
            </>
          )}
          <Text dimColor> │ </Text>
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
