import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanExports, formatExportMap, loadGitignorePatterns } from '../../src/context/exports.js';

const TEST_DIR = join(tmpdir(), 'opta-exports-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('scanExports', () => {
  it('finds TypeScript exports (function, class, const, type, interface, enum, async function, default class)', async () => {
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });

    await writeFile(
      join(TEST_DIR, 'src', 'utils.ts'),
      [
        'export function greet(name: string): string { return name; }',
        'export class UserService {}',
        'export const MAX_ITEMS = 100;',
        'export type UserRole = "admin" | "user";',
        'export interface Config { host: string; }',
        'export enum Status { Active, Inactive }',
        'export async function fetchData() { return []; }',
      ].join('\n'),
    );

    await writeFile(
      join(TEST_DIR, 'src', 'app.tsx'),
      'export default class App extends Component {}',
    );

    const map = await scanExports(TEST_DIR);

    const utilsEntry = map.entries.find((e) => e.path === 'src/utils.ts');
    expect(utilsEntry).toBeDefined();
    expect(utilsEntry!.exports).toContain('greet');
    expect(utilsEntry!.exports).toContain('UserService');
    expect(utilsEntry!.exports).toContain('MAX_ITEMS');
    expect(utilsEntry!.exports).toContain('UserRole');
    expect(utilsEntry!.exports).toContain('Config');
    expect(utilsEntry!.exports).toContain('Status');
    expect(utilsEntry!.exports).toContain('fetchData');

    const appEntry = map.entries.find((e) => e.path === 'src/app.tsx');
    expect(appEntry).toBeDefined();
    expect(appEntry!.exports).toContain('App');
  });

  it('finds Python definitions (class, def, async def, top-level UPPER_CASE assignments)', async () => {
    await writeFile(
      join(TEST_DIR, 'main.py'),
      [
        'MAX_RETRIES = 3',
        'DEFAULT_TIMEOUT = 30',
        '',
        'class DataProcessor:',
        '    pass',
        '',
        'def process_items(items):',
        '    return items',
        '',
        'async def fetch_remote():',
        '    pass',
        '',
        'local_var = "not exported"',
      ].join('\n'),
    );

    const map = await scanExports(TEST_DIR);

    const entry = map.entries.find((e) => e.path === 'main.py');
    expect(entry).toBeDefined();
    expect(entry!.exports).toContain('MAX_RETRIES');
    expect(entry!.exports).toContain('DEFAULT_TIMEOUT');
    expect(entry!.exports).toContain('DataProcessor');
    expect(entry!.exports).toContain('process_items');
    expect(entry!.exports).toContain('fetch_remote');
    // lowercase assignments should NOT be included
    expect(entry!.exports).not.toContain('local_var');
  });

  it('finds Swift declarations (func, class, struct, enum, protocol with optional public/open modifiers)', async () => {
    await writeFile(
      join(TEST_DIR, 'Sources.swift'),
      [
        'public class NetworkManager {',
        '    func privateHelper() {}',
        '}',
        '',
        'open class BaseController {}',
        '',
        'struct AppConfig {}',
        '',
        'enum Theme { case dark, light }',
        '',
        'protocol Renderable {}',
        '',
        'func globalSetup() {}',
        '',
        'public actor DataStore {}',
      ].join('\n'),
    );

    const map = await scanExports(TEST_DIR);

    const entry = map.entries.find((e) => e.path === 'Sources.swift');
    expect(entry).toBeDefined();
    expect(entry!.exports).toContain('NetworkManager');
    expect(entry!.exports).toContain('BaseController');
    expect(entry!.exports).toContain('AppConfig');
    expect(entry!.exports).toContain('Theme');
    expect(entry!.exports).toContain('Renderable');
    expect(entry!.exports).toContain('globalSetup');
    expect(entry!.exports).toContain('DataStore');
  });

  it('skips test files (.test.ts, .spec.ts, __tests__/)', async () => {
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });
    await mkdir(join(TEST_DIR, '__tests__'), { recursive: true });

    await writeFile(
      join(TEST_DIR, 'src', 'real.ts'),
      'export function realFunction() {}',
    );

    await writeFile(
      join(TEST_DIR, 'src', 'app.test.ts'),
      'export function testHelper() {}',
    );

    await writeFile(
      join(TEST_DIR, 'src', 'app.spec.ts'),
      'export function specHelper() {}',
    );

    await writeFile(
      join(TEST_DIR, '__tests__', 'helper.ts'),
      'export function testSetup() {}',
    );

    // Python test files
    await writeFile(
      join(TEST_DIR, 'test_utils.py'),
      'def test_something(): pass',
    );

    await writeFile(
      join(TEST_DIR, 'utils_test.py'),
      'def test_other(): pass',
    );

    const map = await scanExports(TEST_DIR);

    const paths = map.entries.map((e) => e.path);
    expect(paths).toContain('src/real.ts');
    expect(paths).not.toContain('src/app.test.ts');
    expect(paths).not.toContain('src/app.spec.ts');
    expect(paths.some((p) => p.includes('__tests__'))).toBe(false);
    expect(paths).not.toContain('test_utils.py');
    expect(paths).not.toContain('utils_test.py');
  });

  it('skips node_modules and dist directories', async () => {
    await mkdir(join(TEST_DIR, 'node_modules', 'some-pkg'), { recursive: true });
    await mkdir(join(TEST_DIR, 'dist'), { recursive: true });
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });

    await writeFile(
      join(TEST_DIR, 'node_modules', 'some-pkg', 'index.ts'),
      'export function external() {}',
    );

    await writeFile(
      join(TEST_DIR, 'dist', 'bundle.js'),
      'export function compiled() {}',
    );

    await writeFile(
      join(TEST_DIR, 'src', 'index.ts'),
      'export function main() {}',
    );

    const map = await scanExports(TEST_DIR);

    const paths = map.entries.map((e) => e.path);
    expect(paths).toContain('src/index.ts');
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(paths.some((p) => p.includes('dist/'))).toBe(false);
  });

  it('truncates at 100 files (sets truncated=true, preserves fileCount with total count)', async () => {
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });

    // Create 110 source files
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 110; i++) {
      const filename = `file${String(i).padStart(3, '0')}.ts`;
      writes.push(
        writeFile(
          join(TEST_DIR, 'src', filename),
          `export function fn${i}() {}`,
        ),
      );
    }
    await Promise.all(writes);

    const map = await scanExports(TEST_DIR);

    expect(map.truncated).toBe(true);
    expect(map.entries).toHaveLength(100);
    expect(map.fileCount).toBe(110);
  });

  it('returns empty entries for directories with no source files', async () => {
    // Create only non-source files
    await writeFile(join(TEST_DIR, 'README.md'), '# Hello');
    await writeFile(join(TEST_DIR, 'config.json'), '{}');

    const map = await scanExports(TEST_DIR);

    expect(map.entries).toHaveLength(0);
    expect(map.truncated).toBe(false);
    expect(map.fileCount).toBe(0);
  });
});

describe('loadGitignorePatterns', () => {
  it('returns empty array when no .gitignore exists', () => {
    const patterns = loadGitignorePatterns(TEST_DIR);
    expect(patterns).toEqual([]);
  });

  it('parses .gitignore entries and converts to fast-glob patterns', async () => {
    await writeFile(
      join(TEST_DIR, '.gitignore'),
      ['dist/', '*.log', 'tmp'].join('\n'),
    );

    const patterns = loadGitignorePatterns(TEST_DIR);

    // dist/ → trailing slash stripped → simple name → **/dist/**
    expect(patterns).toContain('**/dist/**');
    // *.log → contains no slash but has wildcard → simple name → **/*.log/**
    expect(patterns).toContain('**/*.log/**');
    // tmp → simple name → **/tmp/**
    expect(patterns).toContain('**/tmp/**');
  });

  it('skips comments and blank lines', async () => {
    await writeFile(
      join(TEST_DIR, '.gitignore'),
      ['# This is a comment', '', '  ', 'node_modules', '# Another comment', 'dist'].join('\n'),
    );

    const patterns = loadGitignorePatterns(TEST_DIR);

    expect(patterns).toHaveLength(2);
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/dist/**');
  });

  it('converts rooted patterns (starting with /) to relative glob', async () => {
    await writeFile(
      join(TEST_DIR, '.gitignore'),
      ['/build', '/out/'].join('\n'),
    );

    const patterns = loadGitignorePatterns(TEST_DIR);

    // /build → build/**
    expect(patterns).toContain('build/**');
    // /out/ → trailing slash stripped → out/**
    expect(patterns).toContain('out/**');
  });

  it('skips negation patterns (starting with !)', async () => {
    await writeFile(
      join(TEST_DIR, '.gitignore'),
      ['dist', '!dist/keep.js', 'tmp'].join('\n'),
    );

    const patterns = loadGitignorePatterns(TEST_DIR);

    expect(patterns).toHaveLength(2);
    expect(patterns).toContain('**/dist/**');
    expect(patterns).toContain('**/tmp/**');
    // Negation pattern should NOT be present
    expect(patterns.some((p) => p.includes('keep'))).toBe(false);
  });

  it('passes through patterns containing slashes (directory-relative)', async () => {
    await writeFile(
      join(TEST_DIR, '.gitignore'),
      ['docs/generated', 'src/vendor/legacy'].join('\n'),
    );

    const patterns = loadGitignorePatterns(TEST_DIR);

    // These contain slashes but don't start with / — pass through as-is
    expect(patterns).toContain('docs/generated');
    expect(patterns).toContain('src/vendor/legacy');
  });
});

describe('scanExports with .gitignore', () => {
  it('excludes files matched by .gitignore patterns', async () => {
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });
    await mkdir(join(TEST_DIR, 'generated'), { recursive: true });

    await writeFile(
      join(TEST_DIR, 'src', 'index.ts'),
      'export function main() {}',
    );

    await writeFile(
      join(TEST_DIR, 'generated', 'output.ts'),
      'export function generatedFn() {}',
    );

    // .gitignore excludes the generated directory
    await writeFile(join(TEST_DIR, '.gitignore'), 'generated\n');

    const map = await scanExports(TEST_DIR);

    const paths = map.entries.map((e) => e.path);
    expect(paths).toContain('src/index.ts');
    expect(paths.some((p) => p.includes('generated'))).toBe(false);
  });

  it('uses hardcoded list even when no .gitignore exists', async () => {
    // node_modules is in the hardcoded list
    await mkdir(join(TEST_DIR, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });

    await writeFile(
      join(TEST_DIR, 'node_modules', 'pkg', 'index.ts'),
      'export function external() {}',
    );

    await writeFile(
      join(TEST_DIR, 'src', 'app.ts'),
      'export function app() {}',
    );

    // No .gitignore — hardcoded list should still exclude node_modules
    const map = await scanExports(TEST_DIR);

    const paths = map.entries.map((e) => e.path);
    expect(paths).toContain('src/app.ts');
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
  });

  it('combines hardcoded and .gitignore patterns additively', async () => {
    // Create dirs: node_modules (hardcoded), custom-cache (gitignore), src (keep)
    await mkdir(join(TEST_DIR, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(join(TEST_DIR, 'custom-cache'), { recursive: true });
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });

    await writeFile(
      join(TEST_DIR, 'node_modules', 'pkg', 'index.ts'),
      'export function nmFn() {}',
    );

    await writeFile(
      join(TEST_DIR, 'custom-cache', 'cached.ts'),
      'export function cachedFn() {}',
    );

    await writeFile(
      join(TEST_DIR, 'src', 'real.ts'),
      'export function realFn() {}',
    );

    await writeFile(join(TEST_DIR, '.gitignore'), 'custom-cache\n');

    const map = await scanExports(TEST_DIR);

    const paths = map.entries.map((e) => e.path);
    expect(paths).toContain('src/real.ts');
    // Both hardcoded (node_modules) and gitignore (custom-cache) should be excluded
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(paths.some((p) => p.includes('custom-cache'))).toBe(false);
  });
});

describe('formatExportMap', () => {
  it('formats as "path: export1, export2" per line', () => {
    const result = formatExportMap({
      entries: [
        { path: 'src/utils.ts', exports: ['greet', 'UserService', 'MAX_ITEMS'] },
        { path: 'src/app.ts', exports: ['App'] },
      ],
      truncated: false,
      fileCount: 2,
    });

    const lines = result.split('\n');
    expect(lines).toContain('src/utils.ts: greet, UserService, MAX_ITEMS');
    expect(lines).toContain('src/app.ts: App');
  });

  it('shows truncation notice when truncated=true', () => {
    const result = formatExportMap({
      entries: [
        { path: 'src/a.ts', exports: ['a'] },
      ],
      truncated: true,
      fileCount: 150,
    });

    expect(result).toContain('... and 149 more files (150 total)');
  });
});
