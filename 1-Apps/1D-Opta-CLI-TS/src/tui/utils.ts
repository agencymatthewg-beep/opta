/**
 * Shared TUI utilities — single source of truth for display helpers
 * used across Header, Sidebar, StatusBar, WelcomeScreen, ToolCard, PermissionPrompt.
 */

// ─── Connection State ───────────────────────────────────────────────────────

export type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'error';

export interface ConnectionIndicator {
  char: string;
  color: string;
  label: string;
}

export function connectionDot(state?: ConnectionState, legacyStatus?: boolean): ConnectionIndicator {
  if (state) {
    switch (state) {
      case 'checking': return { char: '◌', color: 'yellow', label: 'Checking...' };
      case 'connected': return { char: '●', color: 'green', label: 'Connected' };
      case 'disconnected': return { char: '○', color: 'red', label: 'Disconnected' };
      case 'error': return { char: '✗', color: 'red', label: 'Error' };
    }
  }
  return { char: legacyStatus ? '●' : '○', color: legacyStatus ? 'green' : 'red', label: legacyStatus ? 'Connected' : 'Disconnected' };
}

// ─── Model Name Formatting ──────────────────────────────────────────────────

export function shortModelName(model: string): string {
  return model
    .replace(/^lmstudio-community\//, '')
    .replace(/^mlx-community\//, '')
    .replace(/^huggingface\//, '');
}

// ─── Context Bar ────────────────────────────────────────────────────────────

export function contextBar(used: number, total: number): string {
  const pct = Math.min(used / total, 1);
  const filled = Math.round(pct * 10);
  const empty = 10 - filled;
  return '\u25B0'.repeat(filled) + '\u25B1'.repeat(empty);
}

export function contextBarColor(used: number, total: number): string {
  const pct = used / total;
  if (pct >= 0.8) return 'red';
  if (pct >= 0.5) return 'yellow';
  return 'green';
}

// ─── Path Formatting ────────────────────────────────────────────────────────

export function formatPath(path: unknown): string {
  const p = String(path ?? '');
  const parts = p.split('/');
  if (parts.length > 3) {
    return '.../' + parts.slice(-3).join('/');
  }
  return p;
}

// ─── Tool Icons ─────────────────────────────────────────────────────────────

export const TOOL_ICONS: Record<string, string> = {
  read_file: '\u{1F4C4}',
  write_file: '\u270F\uFE0F',
  edit_file: '\u{1F527}',
  list_dir: '\u{1F4C1}',
  search_files: '\u{1F50D}',
  find_files: '\u{1F50E}',
  run_command: '\u26A1',
  ask_user: '\u{1F4AC}',
  delete_file: '\u{1F5D1}',
  multi_edit: '\u{1F527}',
  bg_start: '\u{1F680}',
  bg_kill: '\u{1F6D1}',
  spawn_agent: '\u{1F916}',
  delegate_task: '\u{1F4CB}',
  lsp_rename: '\u270F\uFE0F',
  git_commit: '\u{1F4BE}',
};

// ─── Context Formatting ─────────────────────────────────────────────────────

export function formatContext(total?: number): string {
  if (!total) return '\u2014';
  if (total >= 1024) return `${Math.round(total / 1024)}K`;
  return String(total);
}
