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
  it('defines exactly 8 tools', () => {
    expect(TOOL_SCHEMAS).toHaveLength(8);
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

  it('returns deny for write tools in CI/non-TTY (ask→deny downgrade)', () => {
    // In test environment (non-TTY), isCI=true so 'ask' becomes 'deny'
    expect(resolvePermission('edit_file', DEFAULT_CONFIG)).toBe('deny');
    expect(resolvePermission('write_file', DEFAULT_CONFIG)).toBe('deny');
    expect(resolvePermission('run_command', DEFAULT_CONFIG)).toBe('deny');
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
