import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { assertWithinCwd, executeTool } from '../../src/core/tools.js';

// Use realpathSync to resolve symlinks (macOS: /var -> /private/var)
const RAW_TEST_DIR = join(tmpdir(), 'opta-path-safety-' + Date.now());
let TEST_DIR: string;

beforeEach(async () => {
  await mkdir(RAW_TEST_DIR, { recursive: true });
  TEST_DIR = realpathSync(RAW_TEST_DIR);
  await writeFile(join(TEST_DIR, 'test.txt'), 'test content\n');
});

afterEach(async () => {
  await rm(RAW_TEST_DIR, { recursive: true, force: true });
});

describe('assertWithinCwd', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('allows paths within cwd', () => {
    expect(() => assertWithinCwd(join(TEST_DIR, 'file.txt'))).not.toThrow();
  });

  it('allows cwd itself', () => {
    expect(() => assertWithinCwd(TEST_DIR)).not.toThrow();
  });

  it('allows nested subdirectories within cwd', () => {
    expect(() => assertWithinCwd(join(TEST_DIR, 'a', 'b', 'c', 'file.txt'))).not.toThrow();
  });

  it('blocks parent directory traversal (..)', () => {
    const parentPath = resolve(TEST_DIR, '..');
    expect(() => assertWithinCwd(parentPath)).toThrow('Path traversal blocked');
  });

  it('blocks absolute paths outside cwd', () => {
    expect(() => assertWithinCwd('/etc/passwd')).toThrow('Path traversal blocked');
  });

  it('blocks /tmp root when cwd is a subdirectory of /tmp', () => {
    expect(() => assertWithinCwd('/tmp')).toThrow('Path traversal blocked');
  });

  it('blocks paths that share a prefix but are different directories', () => {
    // e.g., if cwd is /tmp/opta-test-123, block /tmp/opta-test-123-evil
    const evilPath = TEST_DIR + '-evil/file.txt';
    expect(() => assertWithinCwd(evilPath)).toThrow('Path traversal blocked');
  });

  it('includes the blocked path in the error message', () => {
    try {
      assertWithinCwd('/etc/passwd');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('/etc/passwd');
      expect((err as Error).message).toContain(TEST_DIR);
    }
  });
});

describe('path traversal via tool executors', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('read_file blocks path outside cwd', async () => {
    const result = await executeTool('read_file', JSON.stringify({ path: '/etc/hosts' }));
    expect(result).toContain('Error');
    expect(result).toContain('Path traversal blocked');
  });

  it('write_file blocks path outside cwd', async () => {
    const result = await executeTool('write_file', JSON.stringify({ path: '/tmp/evil.txt', content: 'pwned' }));
    expect(result).toContain('Error');
    expect(result).toContain('Path traversal blocked');
  });

  it('edit_file blocks path outside cwd', async () => {
    const result = await executeTool('edit_file', JSON.stringify({
      path: '/etc/hosts',
      old_text: 'localhost',
      new_text: 'hacked',
    }));
    expect(result).toContain('Error');
    expect(result).toContain('Path traversal blocked');
  });

  it('list_dir blocks path outside cwd', async () => {
    const result = await executeTool('list_dir', JSON.stringify({ path: '/etc' }));
    expect(result).toContain('Error');
    expect(result).toContain('Path traversal blocked');
  });

  it('delete_file blocks path outside cwd', async () => {
    const result = await executeTool('delete_file', JSON.stringify({ path: '/tmp/some-file.txt' }));
    expect(result).toContain('Error');
    expect(result).toContain('Path traversal blocked');
  });

  it('read_file allows path within cwd', async () => {
    const result = await executeTool('read_file', JSON.stringify({ path: 'test.txt' }));
    expect(result).toContain('test content');
    expect(result).not.toContain('Path traversal blocked');
  });

  it('write_file allows path within cwd', async () => {
    const result = await executeTool('write_file', JSON.stringify({
      path: 'new-file.txt',
      content: 'safe content',
    }));
    expect(result).toContain('File written');
    expect(result).not.toContain('Path traversal blocked');
  });

  it('blocks relative path that escapes via ../', async () => {
    const result = await executeTool('read_file', JSON.stringify({ path: '../../etc/passwd' }));
    expect(result).toContain('Error');
    expect(result).toContain('Path traversal blocked');
  });
});
