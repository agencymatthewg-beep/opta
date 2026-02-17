import type { OptaConfig } from '../config.js';

// --- Permission Resolution ---

export const MODE_PERMISSIONS: Record<string, Record<string, 'allow' | 'ask' | 'deny'>> = {
  safe: {},
  auto: { edit_file: 'allow', write_file: 'allow', delete_file: 'allow', multi_edit: 'allow', bg_start: 'allow', bg_kill: 'allow', spawn_agent: 'allow', delegate_task: 'allow' },
  plan: { edit_file: 'deny', write_file: 'deny', delete_file: 'deny', multi_edit: 'deny', run_command: 'deny', bg_start: 'deny', bg_kill: 'deny', spawn_agent: 'deny', delegate_task: 'deny' },
  dangerous: { edit_file: 'allow', write_file: 'allow', delete_file: 'allow', multi_edit: 'allow', run_command: 'allow', bg_start: 'allow', bg_kill: 'allow', spawn_agent: 'allow', delegate_task: 'allow' },
  ci: { edit_file: 'deny', write_file: 'deny', delete_file: 'deny', multi_edit: 'deny', run_command: 'deny', ask_user: 'deny', bg_start: 'deny', bg_kill: 'deny', spawn_agent: 'deny', delegate_task: 'deny' },
};

export const DEFAULT_TOOL_PERMISSIONS: Record<string, string> = {
  read_file: 'allow',
  list_dir: 'allow',
  search_files: 'allow',
  find_files: 'allow',
  edit_file: 'ask',
  write_file: 'ask',
  run_command: 'ask',
  ask_user: 'allow',
  read_project_docs: 'allow',
  web_search: 'allow',
  web_fetch: 'allow',
  delete_file: 'ask',
  multi_edit: 'ask',
  save_memory: 'allow',
  bg_start: 'ask',
  bg_status: 'allow',
  bg_output: 'allow',
  bg_kill: 'ask',
  spawn_agent: 'ask',
  delegate_task: 'ask',
  lsp_definition: 'allow',
  lsp_references: 'allow',
  lsp_hover: 'allow',
  lsp_symbols: 'allow',
  lsp_document_symbols: 'allow',
  lsp_rename: 'ask',
};

export function resolvePermission(
  toolName: string,
  config: OptaConfig
): 'allow' | 'ask' | 'deny' {
  // Per-tool config overrides take highest precedence
  const configPerm = config.permissions[toolName];
  const defaultPerm = DEFAULT_TOOL_PERMISSIONS[toolName];

  // If the user explicitly set a per-tool override different from defaults, use it
  if (configPerm && configPerm !== defaultPerm) {
    return configPerm as 'allow' | 'ask' | 'deny';
  }

  // Mode-level permissions (mode handles CI via the 'ci' mode)
  const mode = config.defaultMode ?? 'safe';
  const modePerm = MODE_PERMISSIONS[mode]?.[toolName];
  if (modePerm) return modePerm;

  // Custom tools (custom__*) execute shell commands, so they inherit
  // run_command's mode-level permissions when no explicit override exists.
  if (toolName.startsWith('custom__')) {
    const customModePerm = MODE_PERMISSIONS[mode]?.['run_command'];
    if (customModePerm) return customModePerm;
    // Default: same as run_command ('ask')
    return (configPerm ?? 'ask') as 'allow' | 'ask' | 'deny';
  }

  // Fall back to config permission or default
  const permission = configPerm ?? defaultPerm ?? 'ask';
  return permission as 'allow' | 'ask' | 'deny';
}
