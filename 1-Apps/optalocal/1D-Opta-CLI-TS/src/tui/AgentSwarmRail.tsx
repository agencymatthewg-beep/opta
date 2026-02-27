import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { PHASE_EMOJI, THINKING_FRAMES, type SubAgentDisplayState, type SubAgentPhase } from '../core/subagent-events.js';
import { TUI_COLORS } from './palette.js';

interface AgentSwarmRailProps {
  agents: SubAgentDisplayState[];
  terminalWidth: number;
  onClear: () => void;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function phaseColor(phase: SubAgentPhase): string {
  switch (phase) {
    case 'running':
    case 'writing':
      return TUI_COLORS.warning;
    case 'done':
      return TUI_COLORS.success;
    case 'error':
    case 'timeout':
    case 'cancelled':
      return TUI_COLORS.danger;
    default:
      return TUI_COLORS.accent;
  }
}

function isTerminal(phase: SubAgentPhase): boolean {
  return phase === 'done' || phase === 'error' || phase === 'timeout' || phase === 'cancelled';
}

interface AgentSlotProps {
  agent: SubAgentDisplayState;
}

function AgentSlot({ agent }: AgentSlotProps) {
  const [elapsed, setElapsed] = useState(Date.now() - agent.spawnedAtMs);
  const [thinkFrame, setThinkFrame] = useState(0);

  useEffect(() => {
    if (isTerminal(agent.phase)) return;
    const t = setInterval(() => {
      setElapsed(Date.now() - agent.spawnedAtMs);
    }, 100);
    return () => clearInterval(t);
  }, [agent.phase, agent.spawnedAtMs]);

  useEffect(() => {
    if (agent.phase !== 'thinking') return;
    const t = setInterval(() => {
      setThinkFrame(f => (f + 1) % THINKING_FRAMES.length);
    }, 1200);
    return () => clearInterval(t);
  }, [agent.phase]);

  const emoji = agent.phase === 'thinking'
    ? (THINKING_FRAMES[thinkFrame] ?? PHASE_EMOJI.thinking)
    : PHASE_EMOJI[agent.phase];

  const label = agent.label.length > 18 ? agent.label.slice(0, 17) + '\u2026' : agent.label;
  const tool = agent.currentTool ? agent.currentTool.slice(0, 12) : '';
  const color = phaseColor(agent.phase);

  return (
    <Text color={color}>
      {emoji}{' '}<Text color={color}>{label}</Text>
      <Text dimColor>{' '}{formatElapsed(elapsed)}</Text>
      {tool.length > 0 && <Text dimColor>{' '}{tool}</Text>}
    </Text>
  );
}

export function AgentSwarmRail({ agents, terminalWidth: _terminalWidth, onClear }: AgentSwarmRailProps) {
  const clearScheduledRef = useRef(false);

  useEffect(() => {
    const allDone = agents.length > 0 && agents.every(a => a.result !== undefined);
    if (allDone && !clearScheduledRef.current) {
      clearScheduledRef.current = true;
      const t = setTimeout(() => {
        onClear();
        clearScheduledRef.current = false;
      }, 2000);
      return () => clearTimeout(t);
    }
    if (!allDone) {
      clearScheduledRef.current = false;
    }
    return undefined;
  }, [agents, onClear]);

  if (agents.length === 0) return null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={TUI_COLORS.accentSoft}>
        {'\u26A1'} Agents{' '}
        <Text dimColor>
          {agents.filter(a => !isTerminal(a.phase)).length} active /{' '}
          {agents.filter(a => isTerminal(a.phase)).length} done
        </Text>
      </Text>
      <Box>
        {agents.map((agent, idx) => (
          <React.Fragment key={agent.id}>
            {idx > 0 && <Text dimColor>{' \u2502 '}</Text>}
            <AgentSlot agent={agent} />
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
