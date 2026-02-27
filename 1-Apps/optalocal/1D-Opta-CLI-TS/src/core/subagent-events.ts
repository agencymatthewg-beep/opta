/**
 * Sub-agent visualization event types and constants.
 * Used by the agent swarm TUI to display live sub-agent progress.
 */

export type SubAgentPhase =
  | 'spawning'
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'running'
  | 'browsing'
  | 'searching'
  | 'done'
  | 'error'
  | 'timeout'
  | 'cancelled';

export interface SubAgentDisplayState {
  id: string;
  label: string;
  phase: SubAgentPhase;
  spawnedAtMs: number;
  toolCallCount: number;
  currentTool?: string;
  result?: string;
  dependsOn?: number;
  toolHistory: string[];
}

export interface SubAgentProgressEvent {
  agentId: string;
  phase: SubAgentPhase;
  taskDescription: string;
  toolName?: string;
  toolCallCount: number;
  elapsedMs: number;
}

/** Map a tool name to the appropriate visual phase. */
export function detectPhaseFromTool(toolName: string): SubAgentPhase {
  if (
    toolName === 'read_file' ||
    toolName === 'list_dir' ||
    toolName === 'grep' ||
    toolName === 'search_files' ||
    toolName === 'find_files' ||
    toolName === 'list'
  ) {
    return 'reading';
  }
  if (
    toolName === 'edit_file' ||
    toolName === 'write_file' ||
    toolName === 'multi_edit'
  ) {
    return 'writing';
  }
  if (
    toolName === 'run_command' ||
    toolName === 'bg_start' ||
    toolName === 'exec'
  ) {
    return 'running';
  }
  if (
    toolName.startsWith('browser') ||
    toolName === 'navigate' ||
    toolName === 'click'
  ) {
    return 'browsing';
  }
  if (
    toolName === 'web_search' ||
    toolName === 'tavily' ||
    toolName === 'research_query'
  ) {
    return 'searching';
  }
  return 'thinking';
}

export const PHASE_EMOJI: Record<SubAgentPhase, string> = {
  spawning: '🥚',
  thinking: '🧠',
  reading: '📖',
  writing: '✍️',
  running: '⚡',
  browsing: '🌐',
  searching: '🔍',
  done: '✅',
  error: '💥',
  timeout: '⏰',
  cancelled: '🚫',
};

export const THINKING_FRAMES = ['🧠', '💭', '🤔', '💡'];
