import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS } from '../../src/core/tools.js';

describe('plan mode tool filtering', () => {
  const READ_ONLY_TOOLS = new Set([
    'read_file', 'list_dir', 'search_files', 'find_files',
    'ask_user', 'read_project_docs', 'web_search', 'web_fetch',
  ]);

  const WRITE_TOOLS = new Set([
    'edit_file', 'write_file', 'multi_edit', 'delete_file',
    'run_command', 'save_memory',
  ]);

  it('all tools are classified as read or write', () => {
    for (const schema of TOOL_SCHEMAS) {
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
