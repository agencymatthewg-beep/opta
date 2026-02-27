import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { PHASE_EMOJI, type SubAgentDisplayState, type SubAgentPhase } from '../core/subagent-events.js';
import { TUI_COLORS } from './palette.js';

interface AgentMonitorPanelProps {
  agents: SubAgentDisplayState[];
  onClose: () => void;
  height: number;
}

function isTerminal(phase: SubAgentPhase): boolean {
  return phase === 'done' || phase === 'error' || phase === 'timeout' || phase === 'cancelled';
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

function progressBar(calls: number, maxCalls = 20): string {
  const filled = Math.min(10, Math.round((calls / maxCalls) * 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

interface AgentRowProps {
  agent: SubAgentDisplayState;
}

function AgentRow({ agent }: AgentRowProps) {
  const [elapsed, setElapsed] = useState(Date.now() - agent.spawnedAtMs);

  useEffect(() => {
    if (isTerminal(agent.phase)) return;
    const t = setInterval(() => {
      setElapsed(Date.now() - agent.spawnedAtMs);
    }, 500);
    return () => clearInterval(t);
  }, [agent.phase, agent.spawnedAtMs]);

  const color = phaseColor(agent.phase);
  const label = agent.label.length > 40 ? agent.label.slice(0, 39) + '\u2026' : agent.label;
  const bar = progressBar(agent.toolCallCount);
  const tool = agent.currentTool ? agent.currentTool.slice(0, 16) : '';
  const phaseLabel = agent.phase.toUpperCase().padEnd(10);

  return (
    <Box paddingLeft={1}>
      <Text color={color}>{PHASE_EMOJI[agent.phase]} </Text>
      <Text color={color}>{label.padEnd(42)}</Text>
      <Text dimColor>{bar} </Text>
      <Text dimColor>{String(agent.toolCallCount).padStart(3)} calls  </Text>
      <Text dimColor>{formatElapsed(elapsed)}  </Text>
      <Text color={color}>{phaseLabel}</Text>
      {tool.length > 0 && <Text dimColor>  {tool}</Text>}
    </Box>
  );
}

export function AgentMonitorPanel({ agents, onClose: _onClose, height }: AgentMonitorPanelProps) {
  const active = agents.filter(a => !isTerminal(a.phase));
  const done = agents.filter(a => isTerminal(a.phase));
  const totalCalls = agents.reduce((sum, a) => sum + a.toolCallCount, 0);

  const earliestSpawn = agents.length > 0
    ? Math.min(...agents.map(a => a.spawnedAtMs))
    : Date.now();

  const [headerElapsed, setHeaderElapsed] = useState(Date.now() - earliestSpawn);

  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setHeaderElapsed(Date.now() - earliestSpawn), 1000);
    return () => clearInterval(t);
  }, [active.length, earliestSpawn]);

  if (agents.length === 0) return null;

  const visibleAgents = agents.slice(0, Math.max(1, height - 4));

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={TUI_COLORS.border}>
      <Box paddingX={1}>
        <Text color={TUI_COLORS.accentSoft} bold>
          {'\uD83E\uDD16'} Agent Monitor
        </Text>
        <Text dimColor>
          {' '}[a to close]{'  '}
          {active.length} active / {done.length} done{'  '}
          {formatElapsed(headerElapsed)} elapsed
        </Text>
      </Box>
      {visibleAgents.map(agent => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
      {agents.length > visibleAgents.length && (
        <Box paddingLeft={2}>
          <Text dimColor>+{agents.length - visibleAgents.length} more agents…</Text>
        </Box>
      )}
      <Box paddingX={1} marginTop={0}>
        <Text dimColor>
          Total: {agents.length} agents  {totalCalls} tool calls
        </Text>
      </Box>
    </Box>
  );
}
