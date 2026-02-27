import { describe, it, expect } from 'vitest';
import { formatToolCall, formatToolResult } from '../../src/ui/toolcards.js';

describe('tool call cards', () => {
  it('should format read_file call', () => {
    const output = formatToolCall('read_file', { path: 'src/agent.ts' });
    expect(output).toContain('read_file');
    expect(output).toContain('src/agent.ts');
  });

  it('should format edit_file call with diff preview', () => {
    const output = formatToolCall('edit_file', {
      path: 'src/agent.ts',
      old_text: 'const x = 1;',
      new_text: 'const x = 2;',
    });
    expect(output).toContain('edit_file');
    expect(output).toContain('src/agent.ts');
  });

  it('should format run_command call', () => {
    const output = formatToolCall('run_command', { command: 'npm test' });
    expect(output).toContain('run_command');
    expect(output).toContain('npm test');
  });

  it('should format tool result with truncation', () => {
    const longResult = 'x'.repeat(500);
    const output = formatToolResult('read_file', longResult);
    expect(output.length).toBeLessThan(400);
  });

  it('should format write_file with line count', () => {
    const output = formatToolCall('write_file', {
      path: 'new-file.ts',
      content: 'line1\nline2\nline3',
    });
    expect(output).toContain('3 lines');
  });
});
