import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { isGitRepo, isDirty, getModifiedFiles, gitDiff } from '../../src/git/utils.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-git-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

async function gitInit(dir: string) {
  await execa('git', ['init'], { cwd: dir });
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

async function gitCommitAll(dir: string, msg: string) {
  await execa('git', ['add', '-A'], { cwd: dir });
  await execa('git', ['commit', '-m', msg], { cwd: dir });
}

describe('isGitRepo', () => {
  it('returns true inside a git repo', async () => {
    await gitInit(testDir);
    expect(await isGitRepo(testDir)).toBe(true);
  });

  it('returns false for a non-repo temp directory', async () => {
    // testDir is a fresh temp dir with no .git
    expect(await isGitRepo(testDir)).toBe(false);
  });
});

describe('isDirty', () => {
  it('returns true when working tree has changes', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'init.txt'), 'initial');
    await gitCommitAll(testDir, 'initial commit');

    // Modify a tracked file
    await writeFile(join(testDir, 'init.txt'), 'modified');
    expect(await isDirty(testDir)).toBe(true);
  });

  it('returns false for clean working tree', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'init.txt'), 'initial');
    await gitCommitAll(testDir, 'initial commit');

    expect(await isDirty(testDir)).toBe(false);
  });
});

describe('getModifiedFiles', () => {
  it('returns list of changed files', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'a.txt'), 'hello');
    await writeFile(join(testDir, 'b.txt'), 'world');
    await gitCommitAll(testDir, 'initial');

    // Modify one file, add a new untracked file
    await writeFile(join(testDir, 'a.txt'), 'changed');
    await writeFile(join(testDir, 'c.txt'), 'new file');

    const files = await getModifiedFiles(testDir);
    expect(files).toContain('a.txt');
    expect(files).toContain('c.txt');
  });

  it('returns empty array for clean repo', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'a.txt'), 'hello');
    await gitCommitAll(testDir, 'initial');

    const files = await getModifiedFiles(testDir);
    expect(files).toEqual([]);
  });
});

describe('gitDiff', () => {
  it('returns diff output for a modified file', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'file.txt'), 'original\n');
    await gitCommitAll(testDir, 'initial');

    await writeFile(join(testDir, 'file.txt'), 'modified\n');

    const diff = await gitDiff(testDir, 'file.txt');
    expect(diff).toContain('-original');
    expect(diff).toContain('+modified');
  });

  it('returns empty string for unmodified file', async () => {
    await gitInit(testDir);
    await writeFile(join(testDir, 'file.txt'), 'unchanged\n');
    await gitCommitAll(testDir, 'initial');

    const diff = await gitDiff(testDir, 'file.txt');
    expect(diff).toBe('');
  });
});
