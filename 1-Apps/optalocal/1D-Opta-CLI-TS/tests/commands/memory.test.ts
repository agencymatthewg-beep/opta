import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let testDir: string;
let originalCwd: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-memory-test-'));
  originalCwd = process.cwd();
  process.chdir(testDir);
  await mkdir(join(testDir, '.opta', 'memory'), { recursive: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('memorySync command', () => {
  it('scaffolds default memory files on first run', async () => {
    const { memorySync } = await import('../../src/commands/memory.js');

    await memorySync({ scope: 'main' });

    const dir = join(testDir, '.opta', 'memory');
    const main = await readFile(join(dir, 'main.md'), 'utf-8');
    const atpo = await readFile(join(dir, 'atpo.md'), 'utf-8');
    const gemini = await readFile(join(dir, 'gemini.md'), 'utf-8');

    expect(main).toContain('Model Memory');
    expect(main).toContain('Provider profile: main');
    expect(atpo).toContain('Provider profile: atpo');
    expect(gemini).toContain('Model Memory');
  });

  it('syncs active provider memory from main (non-dry-run)', async () => {
    const { memorySync } = await import('../../src/commands/memory.js');
    const dir = join(testDir, '.opta', 'memory');

    await writeFile(join(testDir, '.opta', 'memory.md'), 'legacy anchor', 'utf-8');
    await writeFile(join(dir, 'main.md'), '# Main\n\nFrom main context', 'utf-8');
    await writeFile(join(dir, 'claude.md'), 'to be replaced', 'utf-8');

    await memorySync({ scope: 'provider', provider: 'anthropic', force: true });

    const content = await readFile(join(dir, 'claude.md'), 'utf-8');
    expect(content).toContain('From main context');
  });

  it('dry-run does not mutate destination file', async () => {
    const { memorySync } = await import('../../src/commands/memory.js');
    const dir = join(testDir, '.opta', 'memory');

    await writeFile(join(dir, 'main.md'), '# Main\n\nDry run payload', 'utf-8');
    await writeFile(join(dir, 'opencode-zen.md'), 'original', 'utf-8');

    await memorySync({ scope: 'provider', provider: 'opencode_zen', dryRun: true, force: true });

    const content = await readFile(join(dir, 'opencode-zen.md'), 'utf-8');
    expect(content).toBe('original');
  });

  it('appends sync payload when policy=append and conflict exists', async () => {
    const { memorySync } = await import('../../src/commands/memory.js');
    const dir = join(testDir, '.opta', 'memory');

    await writeFile(join(dir, 'main.md'), '# Main\n\nMain context', 'utf-8');
    await writeFile(join(dir, 'gemini.md'), '# Existing Gemini\n\nold context', 'utf-8');

    await memorySync({ scope: 'provider', provider: 'gemini', policy: 'append', force: false });

    const content = await readFile(join(dir, 'gemini.md'), 'utf-8');
    expect(content).toContain('# Existing Gemini');
    expect(content).toContain('## Memory Sync');
    expect(content).toContain('Main context');
  });

  it('replaces only with policy=replace', async () => {
    const { memorySync } = await import('../../src/commands/memory.js');
    const dir = join(testDir, '.opta', 'memory');

    await writeFile(join(dir, 'main.md'), '# Main\n\nMain context', 'utf-8');
    await writeFile(join(dir, 'claude.md'), '# Existing Claude\n\nold context', 'utf-8');

    await memorySync({ scope: 'provider', provider: 'anthropic', policy: 'replace' });

    const content = await readFile(join(dir, 'claude.md'), 'utf-8');
    expect(content).toContain('Main context');
    expect(content).not.toContain('old context');
  });
});
