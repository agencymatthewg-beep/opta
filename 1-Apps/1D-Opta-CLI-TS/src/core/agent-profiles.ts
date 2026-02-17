/**
 * Agent profiles define different tool sets and behaviors for the agent loop.
 * Users can switch profiles via /agent to specialize the assistant's capabilities.
 */

export interface AgentProfile {
  name: string;
  description: string;
  tools: string[];
  systemPromptSuffix?: string;
}

export const AGENT_PROFILES: AgentProfile[] = [
  {
    name: 'default',
    description: 'Full access to all tools',
    tools: [
      'read_file', 'write_file', 'edit_file', 'multi_edit', 'delete_file',
      'list_dir', 'search_files', 'find_files',
      'run_command', 'ask_user',
      'web_search', 'web_fetch',
      'save_memory',
      'bg_start', 'bg_status', 'bg_output', 'bg_kill',
      'lsp_definition', 'lsp_references', 'lsp_hover', 'lsp_symbols', 'lsp_document_symbols', 'lsp_rename',
    ],
    systemPromptSuffix: '',
  },
  {
    name: 'reader',
    description: 'Read-only exploration and analysis',
    tools: [
      'read_file', 'list_dir', 'search_files', 'find_files',
      'ask_user',
      'web_search', 'web_fetch',
      'lsp_definition', 'lsp_references', 'lsp_hover', 'lsp_symbols', 'lsp_document_symbols',
    ],
    systemPromptSuffix: `You are in READER mode. You can only read and explore files — no editing, writing, or running commands. Focus on understanding code, finding patterns, and answering questions about the codebase.`,
  },
  {
    name: 'coder',
    description: 'Code editing focused — no web or background tools',
    tools: [
      'read_file', 'write_file', 'edit_file', 'multi_edit', 'delete_file',
      'list_dir', 'search_files', 'find_files',
      'run_command', 'ask_user',
      'lsp_definition', 'lsp_references', 'lsp_hover', 'lsp_symbols', 'lsp_document_symbols', 'lsp_rename',
    ],
    systemPromptSuffix: `You are in CODER mode. Focus on writing and editing code. Read files before editing. Use search to understand the codebase. Run tests after making changes.`,
  },
  {
    name: 'researcher',
    description: 'Web research and codebase analysis',
    tools: [
      'read_file', 'list_dir', 'search_files', 'find_files',
      'ask_user',
      'web_search', 'web_fetch',
      'save_memory',
    ],
    systemPromptSuffix: `You are in RESEARCHER mode. Focus on gathering information from the web and the codebase. Summarize findings clearly. Save important discoveries to memory for later reference.`,
  },
];

/**
 * Get an agent profile by name (case-insensitive).
 */
export function getAgentProfile(name: string): AgentProfile | undefined {
  return AGENT_PROFILES.find(p => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * List all available agent profiles.
 */
export function listAgentProfiles(): AgentProfile[] {
  return [...AGENT_PROFILES];
}
