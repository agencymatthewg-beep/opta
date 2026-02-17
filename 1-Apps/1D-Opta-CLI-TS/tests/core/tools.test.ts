import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  it('defines exactly 24 tools', () => {
    expect(TOOL_SCHEMAS).toHaveLength(24);
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
    expect(names).toContain('bg_start');
    expect(names).toContain('bg_status');
    expect(names).toContain('bg_output');
    expect(names).toContain('bg_kill');
  });

  it('has all 6 LSP tool names', () => {
    const names = getToolNames();
    expect(names).toContain('lsp_definition');
    expect(names).toContain('lsp_references');
    expect(names).toContain('lsp_hover');
    expect(names).toContain('lsp_symbols');
    expect(names).toContain('lsp_document_symbols');
    expect(names).toContain('lsp_rename');
  });

  it('LSP read tools have allow permission by default', () => {
    expect(resolvePermission('lsp_definition', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('lsp_references', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('lsp_hover', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('lsp_symbols', DEFAULT_CONFIG)).toBe('allow');
    expect(resolvePermission('lsp_document_symbols', DEFAULT_CONFIG)).toBe('allow');
  });

  it('lsp_rename requires ask permission', () => {
    expect(resolvePermission('lsp_rename', DEFAULT_CONFIG)).toBe('ask');
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
  it('applies multiple edits to a single file', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      edits: [
        { path: join(TEST_DIR, 'code.ts'), old_text: 'const x = 1;', new_text: 'const x = 10;' },
        { path: join(TEST_DIR, 'code.ts'), old_text: 'const y = 2;', new_text: 'const y = 20;' },
      ],
    }));
    expect(result).toContain('Applied 2/2 edits');
    expect(result).toContain('code.ts (2 edits)');

    // Verify changes
    const content = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
    }));
    expect(content).toContain('const x = 10;');
    expect(content).toContain('const y = 20;');
  });

  it('applies edits across multiple files', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      edits: [
        { path: join(TEST_DIR, 'code.ts'), old_text: 'const x = 1;', new_text: 'const x = 100;' },
        { path: join(TEST_DIR, 'hello.txt'), old_text: 'line two', new_text: 'line TWO' },
      ],
    }));
    expect(result).toContain('Applied 2/2 edits');
    expect(result).toContain('2 files');

    // Verify code.ts
    const code = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
    }));
    expect(code).toContain('const x = 100;');

    // Verify hello.txt
    const hello = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'hello.txt'),
    }));
    expect(hello).toContain('line TWO');
  });

  it('reports partial failure correctly', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      edits: [
        { path: join(TEST_DIR, 'code.ts'), old_text: 'const x = 1;', new_text: 'const x = 10;' },
        { path: join(TEST_DIR, 'code.ts'), old_text: 'NOT_IN_FILE', new_text: 'replacement' },
        { path: join(TEST_DIR, 'hello.txt'), old_text: 'line one', new_text: 'LINE ONE' },
      ],
    }));
    expect(result).toContain('Applied 2/3 edits');
    expect(result).toContain('Failed');
    expect(result).toContain('edit #2');
    expect(result).toContain('not found');

    // Verify successful edits still applied
    const code = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'code.ts'),
    }));
    expect(code).toContain('const x = 10;');

    const hello = await executeTool('read_file', JSON.stringify({
      path: join(TEST_DIR, 'hello.txt'),
    }));
    expect(hello).toContain('LINE ONE');
  });

  it('reports failure when old_text appears multiple times', async () => {
    await writeFile(join(TEST_DIR, 'dupe2.txt'), 'foo bar foo');
    const result = await executeTool('multi_edit', JSON.stringify({
      edits: [
        { path: join(TEST_DIR, 'dupe2.txt'), old_text: 'foo', new_text: 'baz' },
      ],
    }));
    expect(result).toContain('Applied 0/1 edits');
    expect(result).toContain('appears 2 times');
  });

  it('returns error when no edits provided', async () => {
    const result = await executeTool('multi_edit', JSON.stringify({
      edits: [],
    }));
    expect(result).toBe('Error: No edits provided');
  });

  it('rejects more than 20 edits', async () => {
    const edits = Array.from({ length: 21 }, (_, i) => ({
      path: join(TEST_DIR, 'code.ts'),
      old_text: `edit_${i}`,
      new_text: `replace_${i}`,
    }));
    const result = await executeTool('multi_edit', JSON.stringify({ edits }));
    expect(result).toContain('Error: Too many edits');
    expect(result).toContain('20');
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

describe('bg_start', () => {
  it('starts a background process', async () => {
    const result = await executeTool('bg_start', JSON.stringify({ command: 'echo bg-test' }));
    expect(result).toContain('Process started');
    expect(result).toMatch(/id=[a-zA-Z0-9_-]{8}/);
  });

  it('includes label when provided', async () => {
    const result = await executeTool('bg_start', JSON.stringify({ command: 'echo test', label: 'my-test' }));
    expect(result).toContain('Process started');
    // Cleanup
    const id = result.match(/id=([a-zA-Z0-9_-]{8})/)?.[1];
    if (id) await executeTool('bg_kill', JSON.stringify({ id }));
  });
});

describe('bg_status', () => {
  it('returns status of a running process', async () => {
    const startResult = await executeTool('bg_start', JSON.stringify({ command: 'sleep 5' }));
    const id = startResult.match(/id=([a-zA-Z0-9_-]{8})/)?.[1];
    const statusResult = await executeTool('bg_status', JSON.stringify({ id }));
    expect(statusResult).toContain('running');
    // Cleanup
    await executeTool('bg_kill', JSON.stringify({ id }));
  });

  it('lists all processes when no id given', async () => {
    await executeTool('bg_start', JSON.stringify({ command: 'sleep 5', label: 'first' }));
    await executeTool('bg_start', JSON.stringify({ command: 'sleep 5', label: 'second' }));
    const result = await executeTool('bg_status', JSON.stringify({}));
    expect(result).toContain('first');
    expect(result).toContain('second');
  });

  it('returns message when no processes', async () => {
    // Force shutdown to clear any lingering processes
    const { shutdownProcessManager } = await import('../../src/core/tools.js');
    await shutdownProcessManager();
    const result = await executeTool('bg_status', JSON.stringify({}));
    expect(result).toContain('No background processes');
  });
});

describe('bg_output', () => {
  it('returns stdout from completed process', async () => {
    const startResult = await executeTool('bg_start', JSON.stringify({ command: 'echo bg-output-test' }));
    const id = startResult.match(/id=([a-zA-Z0-9_-]{8})/)?.[1];
    await new Promise((r) => setTimeout(r, 200));
    const outputResult = await executeTool('bg_output', JSON.stringify({ id }));
    expect(outputResult).toContain('bg-output-test');
  });

  it('returns error for unknown process', async () => {
    const result = await executeTool('bg_output', JSON.stringify({ id: 'nonexist' }));
    expect(result).toContain('Error:');
  });
});

describe('bg_kill', () => {
  it('kills a running process', async () => {
    const startResult = await executeTool('bg_start', JSON.stringify({ command: 'sleep 30' }));
    const id = startResult.match(/id=([a-zA-Z0-9_-]{8})/)?.[1];
    const killResult = await executeTool('bg_kill', JSON.stringify({ id }));
    expect(killResult).toContain('killed');
  });

  it('reports already-dead process', async () => {
    const startResult = await executeTool('bg_start', JSON.stringify({ command: 'echo done' }));
    const id = startResult.match(/id=([a-zA-Z0-9_-]{8})/)?.[1];
    await new Promise((r) => setTimeout(r, 200));
    const killResult = await executeTool('bg_kill', JSON.stringify({ id }));
    expect(killResult).toContain('already');
  });
});

describe('forceKillAllProcesses', () => {
  it('kills running processes and nullifies manager', async () => {
    const { forceKillAllProcesses } = await import('../../src/core/tools.js');
    // Start a process to ensure the manager exists
    await executeTool('bg_start', JSON.stringify({ command: 'sleep 30' }));
    // Force kill should not throw
    forceKillAllProcesses();
    // After force kill, status should show no processes (fresh manager)
    const result = await executeTool('bg_status', JSON.stringify({}));
    expect(result).toContain('No background processes');
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

describe('web_fetch', () => {
  it('schema is present in TOOL_SCHEMAS', () => {
    const schema = TOOL_SCHEMAS.find((s) => s.function.name === 'web_fetch');
    expect(schema).toBeDefined();
    expect(schema!.function.parameters.properties).toHaveProperty('url');
    expect(schema!.function.parameters.properties).toHaveProperty('max_chars');
    expect(schema!.function.parameters.required).toContain('url');
  });

  it('schema description mentions fetching URL and extracting text', () => {
    const schema = TOOL_SCHEMAS.find((s) => s.function.name === 'web_fetch');
    expect(schema!.function.description).toMatch(/fetch/i);
    expect(schema!.function.description).toMatch(/url/i);
  });

  it('rejects file:// URLs', async () => {
    const result = await executeTool('web_fetch', JSON.stringify({ url: 'file:///etc/passwd' }));
    expect(result).toContain('Error');
    expect(result).toMatch(/http|https|not allowed|invalid/i);
  });

  it('rejects data: URLs', async () => {
    const result = await executeTool('web_fetch', JSON.stringify({ url: 'data:text/html,<h1>hi</h1>' }));
    expect(result).toContain('Error');
    expect(result).toMatch(/http|https|not allowed|invalid/i);
  });

  it('rejects javascript: URLs', async () => {
    const result = await executeTool('web_fetch', JSON.stringify({ url: 'javascript:alert(1)' }));
    expect(result).toContain('Error');
    expect(result).toMatch(/http|https|not allowed|invalid/i);
  });

  it('fetches and strips HTML from a mocked response', async () => {
    const mockHtml = '<html><body><h1>Title</h1><p>Hello world</p></body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200, headers: { 'Content-Type': 'text/html' } })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com' }));
    expect(result).toContain('Title');
    expect(result).toContain('Hello world');
    expect(result).not.toContain('<h1>');
    expect(result).not.toContain('<p>');

    fetchSpy.mockRestore();
  });

  it('truncates output to max_chars', async () => {
    const longContent = '<html><body>' + 'a'.repeat(20000) + '</body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(longContent, { status: 200, headers: { 'Content-Type': 'text/html' } })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com', max_chars: 500 }));
    expect(result.length).toBeLessThanOrEqual(500);

    fetchSpy.mockRestore();
  });

  it('defaults to 10000 max_chars', async () => {
    const longContent = '<html><body>' + 'x'.repeat(20000) + '</body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(longContent, { status: 200, headers: { 'Content-Type': 'text/html' } })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com' }));
    expect(result.length).toBeLessThanOrEqual(10000);

    fetchSpy.mockRestore();
  });

  it('extracts content from <main> tag when present', async () => {
    const mockHtml = '<html><body><nav>Nav stuff</nav><main><p>Main content here</p></main><footer>Footer</footer></body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200, headers: { 'Content-Type': 'text/html' } })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com' }));
    expect(result).toContain('Main content here');
    // Should not include nav/footer since <main> is present
    expect(result).not.toContain('Nav stuff');
    expect(result).not.toContain('Footer');

    fetchSpy.mockRestore();
  });

  it('extracts content from <article> tag when present (no <main>)', async () => {
    const mockHtml = '<html><body><nav>Nav stuff</nav><article><p>Article content</p></article><footer>Footer</footer></body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200, headers: { 'Content-Type': 'text/html' } })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com' }));
    expect(result).toContain('Article content');
    expect(result).not.toContain('Nav stuff');
    expect(result).not.toContain('Footer');

    fetchSpy.mockRestore();
  });

  it('sets correct User-Agent header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html><body>test</body></html>', { status: 200 })
    );

    await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Opta-CLI/0.1 (web-fetch)',
        }),
      })
    );

    fetchSpy.mockRestore();
  });

  it('handles fetch errors gracefully', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error')
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://unreachable.example.com' }));
    expect(result).toContain('Error');
    expect(result).toContain('Network error');

    fetchSpy.mockRestore();
  });

  it('handles non-OK HTTP responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com/missing' }));
    expect(result).toContain('Error');
    expect(result).toContain('404');

    fetchSpy.mockRestore();
  });

  it('has allow permission by default', () => {
    expect(resolvePermission('web_fetch', DEFAULT_CONFIG)).toBe('allow');
  });

  it('strips script and style tags', async () => {
    const mockHtml = '<html><body><script>alert("xss")</script><style>.foo{color:red}</style><p>Clean text</p></body></html>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200 })
    );

    const result = await executeTool('web_fetch', JSON.stringify({ url: 'https://example.com' }));
    expect(result).toContain('Clean text');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('color:red');

    fetchSpy.mockRestore();
  });
});
