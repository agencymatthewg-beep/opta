/**
 * AgentPickerOverlay -- Interactive overlay for selecting and configuring
 * agent swarm participants.
 *
 * Shows predefined agent profiles (derived from the subagent/orchestrator
 * system), currently running agents with live status, and allows spawning
 * new agents or viewing active ones.
 *
 * Follows the ModelPicker overlay pattern: keyboard nav (up/down/j/k),
 * Enter to select, Escape to close.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { PHASE_EMOJI, type SubAgentDisplayState, type SubAgentPhase } from '../core/subagent-events.js';
import { TUI_COLORS } from './palette.js';

// ---------------------------------------------------------------------------
// Agent Profile Definitions
// ---------------------------------------------------------------------------

export type AgentProfileId =
  | 'researcher'
  | 'coder'
  | 'reviewer'
  | 'browser'
  | 'planner'
  | 'runner';

export interface AgentProfile {
  id: AgentProfileId;
  label: string;
  description: string;
  icon: string;
  /** Tool whitelist -- only these tools are available to this agent type. */
  tools: string[];
  /** Default mode override for the spawned subagent. */
  mode: string;
  /** Default budget overrides. */
  budget: {
    maxToolCalls: number;
    maxTokens: number;
    timeoutMs: number;
  };
}

export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Reads files, searches code, and gathers context without making changes',
    icon: '\uD83D\uDD0D',
    tools: ['read_file', 'list_dir', 'search_files', 'find_files', 'read_project_docs', 'web_search', 'research_query'],
    mode: 'research',
    budget: { maxToolCalls: 20, maxTokens: 8192, timeoutMs: 90_000 },
  },
  {
    id: 'coder',
    label: 'Coder',
    description: 'Reads, writes, and edits files to implement features or fix bugs',
    icon: '\u2728',
    tools: ['read_file', 'list_dir', 'search_files', 'find_files', 'edit_file', 'write_file', 'multi_edit', 'run_command'],
    mode: 'auto',
    budget: { maxToolCalls: 25, maxTokens: 8192, timeoutMs: 120_000 },
  },
  {
    id: 'reviewer',
    label: 'Reviewer',
    description: 'Reviews code changes for correctness, style, and potential issues',
    icon: '\uD83D\uDCDD',
    tools: ['read_file', 'list_dir', 'search_files', 'find_files', 'git_status', 'git_diff', 'git_log'],
    mode: 'review',
    budget: { maxToolCalls: 15, maxTokens: 8192, timeoutMs: 60_000 },
  },
  {
    id: 'browser',
    label: 'Browser Agent',
    description: 'Navigates web pages, clicks elements, and captures screenshots',
    icon: '\uD83C\uDF10',
    tools: ['browser_open', 'browser_navigate', 'browser_click', 'browser_type', 'browser_snapshot', 'browser_screenshot', 'browser_close'],
    mode: 'auto',
    budget: { maxToolCalls: 20, maxTokens: 8192, timeoutMs: 120_000 },
  },
  {
    id: 'planner',
    label: 'Planner',
    description: 'Analyzes tasks and creates structured delegation plans for the orchestrator',
    icon: '\uD83D\uDCCB',
    tools: ['read_file', 'list_dir', 'search_files', 'find_files', 'read_project_docs'],
    mode: 'plan',
    budget: { maxToolCalls: 10, maxTokens: 8192, timeoutMs: 60_000 },
  },
  {
    id: 'runner',
    label: 'Runner',
    description: 'Executes shell commands, runs tests, and manages background processes',
    icon: '\u26A1',
    tools: ['run_command', 'bg_start', 'bg_status', 'bg_output', 'bg_kill', 'read_file', 'list_dir'],
    mode: 'auto',
    budget: { maxToolCalls: 15, maxTokens: 4096, timeoutMs: 90_000 },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTerminal(phase: SubAgentPhase): boolean {
  return phase === 'done' || phase === 'error' || phase === 'timeout' || phase === 'cancelled';
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

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Props & Component
// ---------------------------------------------------------------------------

export interface AgentPickerSelection {
  profile: AgentProfile;
}

export interface AgentPickerOverlayProps {
  activeAgents: SubAgentDisplayState[];
  onSelect: (selection: AgentPickerSelection) => void;
  onClose: () => void;
}

type Section = 'profiles' | 'active';

export function AgentPickerOverlay({
  activeAgents,
  onSelect,
  onClose,
}: AgentPickerOverlayProps) {
  const { stdout } = useStdout();
  const maxVisibleItems = Math.max(6, Math.min(16, (stdout?.rows ?? 24) - 12));

  const [section, setSection] = useState<Section>('profiles');
  const [profileIdx, setProfileIdx] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const runningAgents = useMemo(
    () => activeAgents.filter(a => !isTerminal(a.phase)),
    [activeAgents],
  );
  const doneAgents = useMemo(
    () => activeAgents.filter(a => isTerminal(a.phase)),
    [activeAgents],
  );

  const currentList = section === 'profiles' ? AGENT_PROFILES : activeAgents;
  const currentIdx = section === 'profiles' ? profileIdx : activeIdx;
  const setCurrentIdx = section === 'profiles' ? setProfileIdx : setActiveIdx;

  // Visible range for scrolling
  const visibleRange = useMemo(() => {
    if (currentList.length <= maxVisibleItems) {
      return { start: 0, end: currentList.length };
    }
    const half = Math.floor(maxVisibleItems / 2);
    let start = Math.max(0, currentIdx - half);
    let end = start + maxVisibleItems;
    if (end > currentList.length) {
      end = currentList.length;
      start = Math.max(0, end - maxVisibleItems);
    }
    return { start, end };
  }, [currentList.length, currentIdx, maxVisibleItems]);

  useInput((input, key) => {
    if (key.escape || key.leftArrow || key.backspace || key.delete) {
      onClose();
      return;
    }

    // Tab switches between sections (only if there are active agents)
    if (key.tab && activeAgents.length > 0) {
      setSection(prev => prev === 'profiles' ? 'active' : 'profiles');
      return;
    }

    // Navigation
    if (key.upArrow || input.toLowerCase() === 'k') {
      if (currentIdx > 0) {
        setCurrentIdx(prev => prev - 1);
      }
      return;
    }
    if (key.downArrow || input.toLowerCase() === 'j') {
      if (currentIdx < currentList.length - 1) {
        setCurrentIdx(prev => prev + 1);
      }
      return;
    }

    // Enter to select a profile
    if (key.return && section === 'profiles') {
      const profile = AGENT_PROFILES[profileIdx];
      if (profile) {
        onSelect({ profile });
      }
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={TUI_COLORS.accent}
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={TUI_COLORS.accent}>Agent Picker</Text>
        <Text dimColor>  (Enter to spawn, Tab to switch, Esc to close)</Text>
      </Box>

      {/* Section tabs */}
      <Box marginBottom={1} gap={2}>
        <Text
          color={section === 'profiles' ? TUI_COLORS.accent : undefined}
          bold={section === 'profiles'}
          underline={section === 'profiles'}
        >
          Profiles ({AGENT_PROFILES.length})
        </Text>
        <Text
          color={section === 'active' ? TUI_COLORS.accent : undefined}
          bold={section === 'active'}
          underline={section === 'active'}
        >
          Active ({runningAgents.length})
          {doneAgents.length > 0 ? <Text dimColor> + {doneAgents.length} done</Text> : null}
        </Text>
      </Box>

      {/* Profiles section */}
      {section === 'profiles' ? (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text dimColor>Select an agent profile to spawn a new subagent with preconfigured tools and budget.</Text>
          </Box>

          {visibleRange.start > 0 && (
            <Text dimColor>  ... {visibleRange.start} above ...</Text>
          )}

          {AGENT_PROFILES.slice(visibleRange.start, visibleRange.end).map((profile, i) => {
            const idx = visibleRange.start + i;
            const focused = idx === profileIdx;
            const marker = focused ? '\u25B6 ' : '  ';

            return (
              <Box key={profile.id} flexDirection="column">
                <Box>
                  <Text color={focused ? TUI_COLORS.accent : undefined}>{marker}</Text>
                  <Text>{profile.icon} </Text>
                  <Text color={focused ? 'cyan' : undefined} bold={focused}>{profile.label}</Text>
                  <Text dimColor>  mode={profile.mode}</Text>
                  <Text dimColor>  budget={profile.budget.maxToolCalls} calls</Text>
                </Box>
                {focused && (
                  <Box paddingLeft={4} marginBottom={1}>
                    <Text dimColor wrap="wrap">{profile.description}</Text>
                  </Box>
                )}
                {focused && (
                  <Box paddingLeft={4} marginBottom={1}>
                    <Text dimColor>tools: {profile.tools.join(', ')}</Text>
                  </Box>
                )}
              </Box>
            );
          })}

          {visibleRange.end < AGENT_PROFILES.length && (
            <Text dimColor>  ... {AGENT_PROFILES.length - visibleRange.end} below ...</Text>
          )}
        </Box>
      ) : (
        /* Active agents section */
        <Box flexDirection="column">
          {activeAgents.length === 0 ? (
            <Text dimColor>No agents are currently active.</Text>
          ) : (
            <>
              <Box marginBottom={1}>
                <Text dimColor>
                  {runningAgents.length} running, {doneAgents.length} completed
                </Text>
              </Box>

              {visibleRange.start > 0 && (
                <Text dimColor>  ... {visibleRange.start} above ...</Text>
              )}

              {activeAgents.slice(visibleRange.start, visibleRange.end).map((agent, i) => {
                const idx = visibleRange.start + i;
                const focused = idx === activeIdx;
                const marker = focused ? '\u25B6 ' : '  ';
                const color = phaseColor(agent.phase);
                const elapsed = formatElapsed(Date.now() - agent.spawnedAtMs);
                const label = agent.label.length > 40
                  ? agent.label.slice(0, 39) + '\u2026'
                  : agent.label;

                return (
                  <Box key={agent.id} flexDirection="column">
                    <Box>
                      <Text color={focused ? TUI_COLORS.accent : undefined}>{marker}</Text>
                      <Text color={color}>{PHASE_EMOJI[agent.phase]} </Text>
                      <Text color={focused ? 'cyan' : color}>{label}</Text>
                      <Text dimColor>  {agent.phase.toUpperCase()}</Text>
                      <Text dimColor>  {elapsed}</Text>
                      <Text dimColor>  {agent.toolCallCount} calls</Text>
                    </Box>
                    {focused && agent.currentTool && (
                      <Box paddingLeft={4}>
                        <Text dimColor>current tool: {agent.currentTool}</Text>
                      </Box>
                    )}
                    {focused && agent.toolHistory.length > 0 && (
                      <Box paddingLeft={4} marginBottom={1}>
                        <Text dimColor>
                          recent: {agent.toolHistory.slice(-5).join(' \u2192 ')}
                        </Text>
                      </Box>
                    )}
                  </Box>
                );
              })}

              {visibleRange.end < activeAgents.length && (
                <Text dimColor>  ... {activeAgents.length - visibleRange.end} below ...</Text>
              )}
            </>
          )}
        </Box>
      )}

      {/* Footer summary */}
      <Box marginTop={1} borderStyle="single" borderColor={TUI_COLORS.borderSoft} paddingX={1}>
        <Text dimColor>
          Profiles: {AGENT_PROFILES.length}  |  Active: {runningAgents.length}  |  Done: {doneAgents.length}  |  Max concurrent: 3  |  Max depth: 2
        </Text>
      </Box>
    </Box>
  );
}
