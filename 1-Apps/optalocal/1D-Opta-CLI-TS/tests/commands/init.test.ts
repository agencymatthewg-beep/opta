import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let testDir: string;
let originalCwd: string;

beforeEach(async () => {
  vi.resetModules();
  testDir = await mkdtemp(join(tmpdir(), 'opta-init-test-'));
  originalCwd = process.cwd();
  process.chdir(testDir);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('detectProjectType', () => {
  it('detects node projects from package.json', async () => {
    await writeFile(join(testDir, 'package.json'), '{}');
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType(testDir);
    expect(result).toEqual({ type: 'node', marker: 'package.json' });
  });

  it('detects rust projects from Cargo.toml', async () => {
    await writeFile(join(testDir, 'Cargo.toml'), '');
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType(testDir);
    expect(result).toEqual({ type: 'rust', marker: 'Cargo.toml' });
  });

  it('detects python projects from pyproject.toml', async () => {
    await writeFile(join(testDir, 'pyproject.toml'), '');
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType(testDir);
    expect(result).toEqual({ type: 'python', marker: 'pyproject.toml' });
  });

  it('detects go projects from go.mod', async () => {
    await writeFile(join(testDir, 'go.mod'), '');
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType(testDir);
    expect(result).toEqual({ type: 'go', marker: 'go.mod' });
  });

  it('detects swift projects from Package.swift', async () => {
    await writeFile(join(testDir, 'Package.swift'), '');
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType(testDir);
    expect(result).toEqual({ type: 'swift', marker: 'Package.swift' });
  });

  it('returns null for unknown project types', async () => {
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType(testDir);
    expect(result).toBeNull();
  });

  it('returns null for invalid directories', async () => {
    const { detectProjectType } = await import('../../src/commands/init.js');
    const result = await detectProjectType('/nonexistent/path/abc123');
    expect(result).toBeNull();
  });
});

describe('init command with --yes flag', () => {
  it('creates APP.md with correct frontmatter', async () => {
    await writeFile(join(testDir, 'package.json'), '{}');
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    const appMd = await readFile(join(testDir, 'APP.md'), 'utf-8');
    expect(appMd).toContain('title:');
    expect(appMd).toContain('type: node');
    expect(appMd).toContain('status: active');
  });

  it('creates docs/ directory and all OPIS files', async () => {
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    expect(await fileExists(join(testDir, 'APP.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'ARCHITECTURE.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'GUARDRAILS.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'DECISIONS.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'ECOSYSTEM.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'KNOWLEDGE.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'WORKFLOWS.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'ROADMAP.md'))).toBe(true);
    expect(await fileExists(join(testDir, 'docs', 'INDEX.md'))).toBe(true);
  });

  it('creates 9 files total (APP.md + 8 docs)', async () => {
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    // Verify the summary output mentions 9 files
    const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const allOutput = calls.map((c: unknown[]) => c.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('9');
  });

  it('uses directory name as project name', async () => {
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    const appMd = await readFile(join(testDir, 'APP.md'), 'utf-8');
    // The temp dir name includes 'opta-init-test-' prefix
    const dirName = testDir.split('/').pop()!;
    expect(appMd).toContain(`title: ${dirName}`);
  });

  it('sets type to unknown when no marker found', async () => {
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    const appMd = await readFile(join(testDir, 'APP.md'), 'utf-8');
    expect(appMd).toContain('type: unknown');
  });

  it('detects node type when package.json exists', async () => {
    await writeFile(join(testDir, 'package.json'), '{}');
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    const appMd = await readFile(join(testDir, 'APP.md'), 'utf-8');
    expect(appMd).toContain('type: node');
  });

  it('doc files have YAML frontmatter', async () => {
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    const arch = await readFile(join(testDir, 'docs', 'ARCHITECTURE.md'), 'utf-8');
    expect(arch).toMatch(/^---\n/);
    expect(arch).toContain('title: Architecture');
    expect(arch).toContain('type: opis');
    expect(arch).toContain('status: draft');
  });
});

describe('init command does not overwrite without confirmation', () => {
  it('skips when APP.md exists and --yes is set without --force', async () => {
    await writeFile(join(testDir, 'APP.md'), 'existing content');
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    // APP.md should remain unchanged
    const content = await readFile(join(testDir, 'APP.md'), 'utf-8');
    expect(content).toBe('existing content');
  });

  it('overwrites when APP.md exists and --force is set', async () => {
    await writeFile(join(testDir, 'APP.md'), 'old content');
    await writeFile(join(testDir, 'package.json'), '{}');
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true, force: true });

    const content = await readFile(join(testDir, 'APP.md'), 'utf-8');
    expect(content).not.toBe('old content');
    expect(content).toContain('type: node');
  });

  it('prints warning message when skipping', async () => {
    await writeFile(join(testDir, 'APP.md'), 'existing');
    const { init } = await import('../../src/commands/init.js');
    await init({ yes: true });

    const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const allOutput = calls.map((c: unknown[]) => c.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('already exists');
  });
});
