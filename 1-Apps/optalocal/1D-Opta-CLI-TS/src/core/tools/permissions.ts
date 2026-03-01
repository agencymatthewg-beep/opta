import { DEFAULT_PERMISSIONS, type OptaConfig } from '../config.js';

// --- Permission Resolution ---

export const MODE_PERMISSIONS: Record<string, Record<string, 'allow' | 'ask' | 'deny'>> = {
  safe: {
    research_query: 'allow',
    research_health: 'allow',
    learning_log: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
  auto: {
    edit_file: 'allow',
    write_file: 'allow',
    delete_file: 'allow',
    multi_edit: 'allow',
    bg_start: 'allow',
    bg_kill: 'allow',
    spawn_agent: 'allow',
    delegate_task: 'allow',
    research_query: 'allow',
    research_health: 'allow',
    learning_log: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
  plan: {
    edit_file: 'deny',
    write_file: 'deny',
    delete_file: 'deny',
    multi_edit: 'deny',
    run_command: 'deny',
    bg_start: 'deny',
    bg_kill: 'deny',
    spawn_agent: 'deny',
    delegate_task: 'deny',
    learning_log: 'deny',
    research_query: 'allow',
    research_health: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
  review: {
    edit_file: 'deny',
    write_file: 'deny',
    delete_file: 'deny',
    multi_edit: 'deny',
    run_command: 'deny',
    bg_start: 'deny',
    spawn_agent: 'deny',
    delegate_task: 'deny',
    learning_log: 'deny',
    research_query: 'allow',
    research_health: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
  research: {
    edit_file: 'deny',
    write_file: 'deny',
    delete_file: 'deny',
    multi_edit: 'deny',
    spawn_agent: 'deny',
    delegate_task: 'deny',
    research_query: 'allow',
    research_health: 'allow',
    learning_log: 'deny',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
  dangerous: {
    edit_file: 'allow',
    write_file: 'allow',
    delete_file: 'allow',
    multi_edit: 'allow',
    run_command: 'allow',
    bg_start: 'allow',
    bg_kill: 'allow',
    spawn_agent: 'allow',
    delegate_task: 'allow',
    research_query: 'allow',
    research_health: 'allow',
    learning_log: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
  ci: {
    edit_file: 'deny',
    write_file: 'deny',
    delete_file: 'deny',
    multi_edit: 'deny',
    run_command: 'deny',
    ask_user: 'deny',
    bg_start: 'deny',
    bg_kill: 'deny',
    spawn_agent: 'deny',
    delegate_task: 'deny',
    learning_log: 'deny',
    research_query: 'allow',
    research_health: 'allow',
    learning_summary: 'allow',
    learning_retrieve: 'allow',
  },
};

/**
 * Tools that can modify state, destroy data, or interact with external systems.
 * At low autonomy levels (<=2), these tools always require user confirmation
 * even if config or mode says 'allow'. This prevents accidental damage when the
 * user has explicitly chosen a conservative autonomy level.
 *
 * Security rationale: autonomy level is the user's intent for how much
 * unsupervised power the agent should have. Allowing a config override to
 * bypass that intent would violate the principle of least privilege.
 */
const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  'edit_file',
  'write_file',
  'run_command',
  'delete_file',
  'multi_edit',
  'lsp_rename',
  'spawn_agent',
  'delegate_task',
  'bg_start',
]);

export function resolvePermission(
  toolName: string,
  config: OptaConfig
): 'allow' | 'ask' | 'deny' {
  // Per-tool config overrides take highest precedence
  const configPerm = config.permissions[toolName];
  const defaultPerm = DEFAULT_PERMISSIONS[toolName];

  let resolved: 'allow' | 'ask' | 'deny';

  // If the user explicitly set a per-tool override different from defaults, use it
  if (configPerm && configPerm !== defaultPerm) {
    resolved = configPerm;
  } else {
    // Mode-level permissions (mode handles CI via the 'ci' mode)
    const mode = config.defaultMode ?? 'safe';
    const modePerm = MODE_PERMISSIONS[mode]?.[toolName];
    if (modePerm) {
      resolved = modePerm;
    } else if (toolName.startsWith('custom__')) {
      // Custom tools (custom__*) execute shell commands, so they inherit
      // run_command's mode-level permissions when no explicit override exists.
      const customModePerm = MODE_PERMISSIONS[mode]?.['run_command'];
      resolved = (customModePerm ?? configPerm ?? 'ask');
    } else {
      // Fall back to config permission or default
      resolved = (configPerm ?? defaultPerm ?? 'ask');
    }
  }

  // Autonomy floor enforcement: at low autonomy levels, destructive tools
  // must always require confirmation regardless of config or mode overrides.
  // Uses Math.floor consistent with the existing autonomy level resolution
  // convention (fractional levels resolve down to prevent escalation).
  const autonomyLevel = Math.floor(config.autonomy?.level ?? 2);
  if (autonomyLevel <= 2 && DESTRUCTIVE_TOOLS.has(toolName) && resolved === 'allow') {
    resolved = 'ask';
  }

  return resolved;
}
