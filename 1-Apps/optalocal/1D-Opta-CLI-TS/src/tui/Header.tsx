import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { type ConnectionState, connectionDot, shortModelName } from './utils.js';
import { TUI_COLORS } from './palette.js';
import { OPTA_BRAND_GLYPH, OPTA_BRAND_NAME } from '../ui/brand.js';

export interface AtpoState {
  status: 'offline' | 'standby' | 'active' | 'intervening';
  message?: string;
  provider?: 'anthropic' | 'gemini' | 'openai' | 'opencode_zen' | 'local';
}

function getProviderColor(provider?: string) {
  switch (provider) {
    case 'gemini': return '#4285F4'; // Blue
    case 'anthropic': return '#D97757'; // Peach/Orange
    case 'openai': return '#10A37F'; // Green
    case 'opencode_zen': return '#c084fc'; // Purple
    default: return TUI_COLORS.accentSoft;
  }
}

function AtpoCloud({ state }: { state?: AtpoState }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (state?.status === 'active' || state?.status === 'intervening') {
      const interval = setInterval(() => setPulse(p => !p), 500);
      return () => clearInterval(interval);
    }
    setPulse(false);
  }, [state?.status]);

  if (!state || state.status === 'offline') return null;

  const color = getProviderColor(state.provider);
  const icon = state.status === 'intervening' ? '⚡' : pulse ? '☁ ' : '☁';
  
  return (
    <Box>
      <Text dimColor> · </Text>
      <Text color={color} bold={state.status === 'intervening'}>
        {icon} Atpo{state.message ? `: ${state.message}` : ''}
      </Text>
    </Box>
  );
}

interface HeaderProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  connectionState?: ConnectionState;
  title?: string;
  /** When true, truncate model name and hide session ID. */
  compact?: boolean;
  /** Minimal rendering for ultra-narrow terminals (no decorative border). */
  safeMode?: boolean;
  atpoState?: AtpoState;
}

export function Header({ model, sessionId, connectionStatus, connectionState, title, compact, safeMode = false, atpoState }: HeaderProps) {
  const shortName = shortModelName(model);
  const displayModel = compact ? shortName.slice(0, 20) : shortName;
  const dot = connectionDot(connectionState, connectionStatus);

  if (safeMode) {
    return (
      <Box paddingX={1} justifyContent="space-between" width="100%">
        <Box>
          <Text color={TUI_COLORS.accentSoft}>{OPTA_BRAND_GLYPH}</Text>
          <Text> </Text>
          <Text bold color={TUI_COLORS.accent}>{OPTA_BRAND_NAME}</Text>
          <Text dimColor> · </Text>
          <Text color={dot.color}>{dot.char}</Text>
          <Text> {displayModel}</Text>
        </Box>
        {!compact && (
          <Box>
            <Text color={TUI_COLORS.accentSoft}>{sessionId.slice(0, 8)}</Text>
            <AtpoCloud state={atpoState} />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      borderStyle="single"
      borderColor={TUI_COLORS.borderSoft}
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text color={TUI_COLORS.accentSoft}>{OPTA_BRAND_GLYPH}</Text>
        <Text> </Text>
        <Text bold color={TUI_COLORS.accent}>{OPTA_BRAND_NAME}</Text>
        <Text dimColor> · </Text>
        <Text color={dot.color}>{dot.char}</Text>
        <Text> {displayModel}</Text>
      </Box>
      {!compact && (
        <Box>
          {title && <Text dimColor>{title.slice(0, 36)}</Text>}
          <Text dimColor> · </Text>
          <Text color={TUI_COLORS.accentSoft}>{sessionId.slice(0, 8)}</Text>
          <AtpoCloud state={atpoState} />
        </Box>
      )}
    </Box>
  );
}
