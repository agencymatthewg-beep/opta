import React from 'react';
import { Box, Text, useStdout } from 'ink';
import type { WorkflowMode } from './App.js';
import { TUI_COLORS } from './palette.js';

interface HintBarProps {
  workflowMode: WorkflowMode;
  bypassPermissions: boolean;
  /** When true (model is loading), the hint bar is hidden. */
  isLoading: boolean;
  /** When true, compact safe-mode UI is active and hint bar should stay hidden. */
  safeMode?: boolean;
}

/** Mapping from workflow mode to its display color. */
const MODE_COLORS: Record<WorkflowMode, string> = {
  normal: TUI_COLORS.info,
  plan: TUI_COLORS.accentSoft,
  research: TUI_COLORS.warning,
  review: '#60a5fa',
};

/** One-line dim hint bar shown below the message area when idle. */
export function HintBar({ workflowMode, bypassPermissions, isLoading, safeMode = false }: HintBarProps) {
  if (isLoading || safeMode) return null;
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;

  const modeColor = MODE_COLORS[workflowMode];
  const shortcuts = columns < 92
    ? ' · Shift+Space menu · Ctrl+S settings · Ctrl+/ help'
    : columns < 120
      ? ' · Shift+Space menu · Ctrl+S settings · Ctrl+E actions · Ctrl+/ help · Ctrl+B sidebar · Ctrl+N safe'
      : ' · Shift+Space menu · Ctrl+S settings · Ctrl+E actions · Ctrl+/ help · Ctrl+B sidebar · Shift+\u2191/\u2193 scroll · Ctrl+N safe';

  return (
    <Box paddingX={2} justifyContent="flex-end" width="100%">
      <Text dimColor>Shift+Tab mode:</Text>
      <Text> </Text>
      <Text color={modeColor}>{workflowMode}</Text>
      <Text dimColor> · Ctrl+Y bypass</Text>
      {bypassPermissions && <Text color={TUI_COLORS.danger} bold> !</Text>}
      <Text dimColor wrap="truncate-end">{shortcuts}</Text>
    </Box>
  );
}
