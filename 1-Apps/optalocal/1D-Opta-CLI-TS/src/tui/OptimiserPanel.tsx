import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { OPTA_ORBIT_FRAMES } from '../ui/spinner.js';
import { TUI_COLORS } from './palette.js';

const ACTIVE_PHASES = new Set(['streaming', 'waiting', 'tool-call', 'connecting']);

interface OptimiserPanelProps {
  goal: string;
  flowSteps: string[];
  turnPhase?: string;
  safeMode?: boolean;
}

function phaseLabel(turnPhase?: string): string {
  if (turnPhase === 'waiting') return 'planning';
  if (turnPhase === 'tool-call') return 'executing';
  if (turnPhase === 'streaming') return 'synthesizing';
  if (turnPhase === 'connecting') return 'connecting';
  return 'ready';
}

export function OptimiserPanel({
  goal,
  flowSteps,
  turnPhase,
  safeMode = false,
}: OptimiserPanelProps) {
  const active = turnPhase != null && ACTIVE_PHASES.has(turnPhase);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % OPTA_ORBIT_FRAMES.length);
    }, 110);
    return () => clearInterval(interval);
  }, [active]);

  const headerGlyph = active ? (OPTA_ORBIT_FRAMES[frame] ?? '◈') : '◈';

  if (safeMode) {
    return (
      <Box paddingX={1} marginTop={1}>
        <Text color={TUI_COLORS.accent}>{headerGlyph}</Text>
        <Text color={TUI_COLORS.accent}> Intent</Text>
        <Text dimColor> · {phaseLabel(turnPhase)} · </Text>
        <Text wrap="truncate-end">{goal}</Text>
      </Box>
    );
  }

  const flowLine = flowSteps.slice(0, 4).join(' -> ');

  return (
    <Box
      borderStyle="round"
      borderColor={active ? TUI_COLORS.accent : TUI_COLORS.borderSoft}
      flexDirection="column"
      marginTop={1}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Box>
          <Text color={TUI_COLORS.accent}>{headerGlyph}</Text>
          <Text color={TUI_COLORS.accent} bold> Opta Intent</Text>
        </Box>
        <Text dimColor>{phaseLabel(turnPhase)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={TUI_COLORS.info} bold>Goal </Text>
        <Text wrap="truncate-end">{goal}</Text>
      </Box>
      <Box>
        <Text color={TUI_COLORS.info} bold>Flow </Text>
        <Text wrap="truncate-end">{flowLine}</Text>
      </Box>
    </Box>
  );
}
