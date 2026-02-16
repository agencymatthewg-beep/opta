import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';

let testDir: string;
let originalCwd: string;

async function gitInit(dir: string) {
  await execa('git', ['init'], { cwd: dir });
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

async function gitCommitAll(dir: string, msg: string) {
  await execa('git', ['add', '-A'], { cwd: dir });
  await execa('git', ['commit', '-m', msg], { cwd: dir });
}

beforeEach(async () => {
  vi.resetModules();
  testDir = await mkdtemp(join(tmpdir(), 'opta-diff-test-'));
  originalCwd = process.cwd();
  process.chdir(testDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(testDir, { recursive: true, force: true });
});

describe('diff command', () => {
  it('handles non-git directories gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { diff } = await import('../../src/commands/diff.js');
    await diff();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not a git repository'));
    consoleSpy.mockRestore();
  });

  it('shows no changes for clean repo', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'file.txt'), 'content');
    await gitCommitAll(testDir, 'init');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { diff } = await import('../../src/commands/diff.js');
    await diff();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No uncommitted changes'));
    consoleSpy.mockRestore();
  });

  it('shows diff output for modified files', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'file.txt'), 'original');
    await gitCommitAll(testDir, 'init');
    await writeFile(join(testDir, 'file.txt'), 'modified');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { diff } = await import('../../src/commands/diff.js');
    await diff();
    // Should show the file count and diff
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('file(s) changed'));
    consoleSpy.mockRestore();
  });

  it('shows no checkpoints for unknown session', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'file.txt'), 'content');
    await gitCommitAll(testDir, 'init');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { diff } = await import('../../src/commands/diff.js');
    await diff({ session: 'nonexistent-session' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No checkpoints'));
    consoleSpy.mockRestore();
  });
});
