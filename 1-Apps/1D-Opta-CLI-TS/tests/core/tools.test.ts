import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeTool, resolvePermission, TOOL_SCHEMAS, getToolNames } from '../../src/core/tools.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

const TEST_DIR = join(tmpdir(), 'opta-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  await writeFile(join(TEST_DIR, 'hello.txt'), 'line one\nline two\nline three\n');
  await writeFile(join(TEST_DIR, 'code.ts'), 'const x = 1;\nconst y = 2;\nconst z = x + y;\n');
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('tool schemas', () => {
  it('defines exactly 14 tools', () => {
    expect(TOOL_SCHEMAS).toHaveLength(14);
  });

  it('has all expected tool names', () => {
    const names = getToolNames();
    expect(names).toContain('read_file');
    expect(names).toContain('write_file');
    expect(names).toContain('edit_file');
    expect(names).toContain('list_dir');
    expect(names).toContain('search_files');
    expect(names).toContain('find_files');
    expect(names).toContain('run_command');
    expect(names).toContain('ask_user');
    expect(names).toContain('read_project_docs');
    expect(names).toContain('web_search');
    expect(names).toContain('web_fetch');
    expect(names).toContain('delete_file');
    expect(names).toContain('multi_edit');
    expect(names).toContain('save_memory');
  });

  it('each schema has type, function.name, function.parameters', () => {
    for (const schema of TOOL_SCHEMAS) {
      expect(schema.type).toBe('function');
      expect(schema.function.name).toBeTruthy();
      expect(schema.function.description).toBeTruthy();
      expect(schema.function.parameters).toBeDefined();
    }
  });
});

describe('resolvePermission', () => {
  it('returns allow for read-only tools', () => {
    expect(resolvePermission('read_file', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('list_dir', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('search_files', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('find_files', DEFAULT_CONFIG)).toBe('allow');
  });

  it('returns ask for write tools in default safe mode', () => {
    // Safe mode (default) prompts for write operations
    expect(resolvePermission('edit_file', DEFAULT_CONFIG)).toBe('ask');
    expect(resolvePermission('write_file', DEFAULT_CONFIG)).toBe('ask');
    expect(resolvePermission('run_command', DEFAULT_CONFIG)).toBe('ask');
  });

  it('config defaults have ask for write tools', () => {
    expect(DEFAULT_CONFIG.permissions['edit_file']).toBe('ask');
    expect(DEFAULT_CONFIG.permissions['write_file']).toBe('ask');
    expect(DEFAULT_CONFIG.permissions['run_command']).toBe('ask');
  });

  it('returns ask for unknown tools', () => {
    expect(resolvePermission('unknown_tool', DEFAULT_CONFIG)).toBe('ask');
  });
});

describe('read_file', () => {
  it('reads file with line numbers', async () => {
    const result = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'hello.txt'),
    }));
    expect(result).toContain('1\tline one');
    expect(result).toContain('2\tline two');
    expect(result).toContain('3\tline three');
  });

  it('supports offset and limit', async () => {
    const result = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'hello.txt'),
      offset: 2,
      limit: 1,
    }));
    expect(result).toBe('2\tline two');
  });

  it('returns error for missing file', async () => {
    const result = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'nonexistent.txt'),
    }));
    expect(result).toContain('Error:');
  });
});

describe('write_file', () => {
  it('creates a new file', async () => {
    const result = await executeTool('write_file', JSON.stringify({
      path: join(TEST_DIR, 'new.txt'),
      content: 'hello world',
    }));
    expect(result).toContain('File written');
    expect(result).toContain('11 bytes');
  });

  it('creates parent directories', async () => {
    const result = await executeTool('write_file', JSON.stringify({
      path: join(TEST_DIR, 'sub', 'dir', 'file.txt'),
      content: 'nested',
    }));
    expect(result).toContain('File written');
  });
});

describe('edit_file', () => {
  it('replaces exact string', async () => {
    const result = await executeTool('edit_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
      old_text: 'const y = 2;',
      new_text: 'const y = 42;',
    }));
    expect(result).toContain('File edited');

    // Verify the change
    const content = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
    }));
    expect(content).toContain('const y = 42;');
  });

  it('fails when old_text not found', async () => {
    const result = await executeTool('edit_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
      old_text: 'not in file',
      new_text: 'replacement',
    }));
    expect(result).toContain('Error: old_text not found');
  });

  it('fails when old_text appears multiple times', async () => {
    await writeFile(join(TEST_DIR, 'dupe.txt'), 'foo bar foo');
    const result = await executeTool('edit_file', JSON.stringify({
      path: join(TEST_DIR, 'dupe.txt'),
      old_text: 'foo',
      new_text: 'baz',
    }));
    expect(result).toContain('appears 2 times');
  });
});

describe('list_dir', () => {
  it('lists directory contents', async () => {
    const result = await executeTool('list_dir', JSON.stringify({
      path: TEST_DIR,
    }));
    expect(result).toContain('hello.txt');
    expect(result).toContain('code.ts');
  });
});

describe('find_files', () => {
  it('finds files by glob', async () => {
    const result = await executeTool('find_files', JSON.stringify({
      pattern: '*.ts',
      path: TEST_DIR,
    }));
    expect(result).toContain('code.ts');
  });

  it('returns message when no files found', async () => {
    const result = await executeTool('find_files', JSON.stringify({
      pattern: '*.xyz',
      path: TEST_DIR,
    }));
    expect(result).toBe('No files found.');
  });
});

describe('run_command', () => {
  it('executes a shell command', async () => {
    const result = await executeTool('run_command', JSON.stringify({
      command: 'echo hello',
    }));
    expect(result).toContain('hello');
    expect(result).toContain('[exit code: 0]');
  });

  it('captures stderr', async () => {
    const result = await executeTool('run_command', JSON.stringify({
      command: 'echo err >&2',
    }));
    expect(result).toContain('[stderr]');
    expect(result).toContain('err');
  });

  it('returns non-zero exit code', async () => {
    const result = await executeTool('run_command', JSON.stringify({
      command: 'exit 42',
    }));
    expect(result).toContain('[exit code: 42]');
  });
});

describe('read_project_docs', () => {
  it('reads OPIS docs from docs/ directory', async () => {
    await mkdir(join(TEST_DIR, 'docs'), { recursive: true });
    await writeFile(join(TEST_DIR, 'docs', 'KNOWLEDGE.md'), '# Knowledge\nImportant facts here.\n');

    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const result = await executeTool('read_project_docs', JSON.stringify({ file: 'KNOWLEDGE.md' }));
      expect(result).toContain('# Knowledge');
      expect(result).toContain('Important facts here.');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('returns helpful message for missing docs', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const result = await executeTool('read_project_docs', JSON.stringify({ file: 'ARCHITECTURE.md' }));
      expect(result).toContain('not found');
      expect(result).toContain('opta init');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('delete_file', () => {
  it('deletes an existing file', async () => {
    const result = await executeTool('delete_file', JSON.stringify({
      path: join(TEST_DIR, 'hello.txt'),
    }));
    expect(result).toContain('File deleted');
  });

  it('returns error for missing file', async () => {
    const result = await executeTool('delete_file', JSON.stringify({
      path: join(TEST_DIR, 'nonexistent.txt'),
    }));
    expect(result).toContain('Error:');
  });
});

describe('multi_edit', () => {
  it('applies multiple edits to a file', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
      edits: [
        { old_text: 'const x = 1;', new_text: 'const x = 10;' },
        { old_text: 'const y = 2;', new_text: 'const y = 20;' },
      ],
    }));
    expect(result).toContain('2 edits applied');

    // Verify changes
    const content = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
    }));
    expect(content).toContain('const x = 10;');
    expect(content).toContain('const y = 20;');
  });

  it('fails when old_text not found', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
      edits: [
        { old_text: 'not in file', new_text: 'replacement' },
      ],
    }));
    expect(result).toContain('Error: Edit 1');
    expect(result).toContain('not found');
  });

  it('fails when old_text appears multiple times', async () => {
    await writeFile(join(TEST_DIR, 'dupe2.txt'), 'foo bar foo');
    const result = await executeTool('multi_edit', JSON.stringify({
      path: join(TEST_DIR, 'dupe2.txt'),
      edits: [
        { old_text: 'foo', new_text: 'baz' },
      ],
    }));
    expect(result).toContain('appears 2 times');
  });

  it('returns error when no edits provided', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
      edits: [],
    }));
    expect(result).toBe('Error: No edits provided');
  });
});

describe('save_memory', () => {
  it('creates memory file with entry', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const result = await executeTool('save_memory', JSON.stringify({
        content: 'Always use ESM imports',
        category: 'decision',
      }));
      expect(result).toContain('Memory saved');
      expect(result).toContain('decision');

      // Verify file was created
      const content = await executeTool('read_file', JSON.stringify({
        path: join(TEST_DIR, '.opta', 'memory.md'),
      }));
      expect(content).toContain('# Project Memory');
      expect(content).toContain('[decision]');
      expect(content).toContain('Always use ESM imports');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('appends to existing memory file', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      await executeTool('save_memory', JSON.stringify({
        content: 'First entry',
        category: 'note',
      }));
      await executeTool('save_memory', JSON.stringify({
        content: 'Second entry',
        category: 'lesson',
      }));

      const content = await executeTool('read_file', JSON.stringify({
        path: join(TEST_DIR, '.opta', 'memory.md'),
      }));
      expect(content).toContain('First entry');
      expect(content).toContain('Second entry');
      expect(content).toContain('[note]');
      expect(content).toContain('[lesson]');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('defaults category to note', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const result = await executeTool('save_memory', JSON.stringify({
        content: 'Some note without category',
      }));
      expect(result).toContain('note');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('executeTool', () => {
  it('returns error for invalid JSON', async () => {
    const result = await executeTool('read_file', 'not json');
    expect(result).toContain('Error: Invalid JSON');
  });

  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent', '{}');
    expect(result).toContain('Unknown tool');
  });
});
