import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS, SUB_AGENT_TOOL_SCHEMAS } from '../../src/core/tools/index.js';

describe('plan mode tool filtering', () => {
  const READ_ONLY_TOOLS = new Set([
    'read_file', 'list_dir', 'search_files', 'find_files',
    'ask_user', 'read_project_docs', 'web_search', 'web_fetch',
    'research_query', 'research_health',
    'learning_summary', 'learning_retrieve',
    'browser_snapshot', 'browser_screenshot',
    'bg_status', 'bg_output',
    'lsp_definition', 'lsp_references', 'lsp_hover', 'lsp_symbols', 'lsp_document_symbols',
  ]);

  const WRITE_TOOLS = new Set([
    'edit_file', 'write_file', 'multi_edit', 'delete_file',
    'run_command', 'save_memory', 'learning_log',
    'browser_open', 'browser_navigate', 'browser_click', 'browser_type', 'browser_handle_dialog', 'browser_close',
    'bg_start', 'bg_kill',
    'spawn_agent', 'delegate_task',
    'lsp_rename',
  ]);

  it('all tools are classified as read or write', () => {
    const allSchemas = [...TOOL_SCHEMAS, ...SUB_AGENT_TOOL_SCHEMAS];
    for (const schema of allSchemas) {
      const name = schema.function.name;
      const isRead = READ_ONLY_TOOLS.has(name);
      const isWrite = WRITE_TOOLS.has(name);
      expect(isRead || isWrite, `Tool "${name}" is not classified`).toBe(true);
    }
  });

  it('read-only tools do not include any write operations', () => {
    const writeVerbs = ['edit', 'write', 'delete', 'run', 'save'];
    for (const toolName of READ_ONLY_TOOLS) {
      const hasWriteVerb = writeVerbs.some(v => toolName.startsWith(v));
      expect(hasWriteVerb, `"${toolName}" looks like a write tool`).toBe(false);
    }
  });
});
