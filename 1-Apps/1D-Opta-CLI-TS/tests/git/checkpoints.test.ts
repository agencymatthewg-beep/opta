import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import {
  createCheckpoint,
  listCheckpoints,
  undoCheckpoint,
  cleanupCheckpoints,
  readPatchContent,
  patchStat,
  undoAllCheckpoints,
} from '../../src/git/checkpoints.js';

let testDir: string;
const SESSION_ID = 'test-session-001';

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-checkpoint-test-'));
  await execa('git', ['init'], { cwd: testDir });
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: testDir });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: testDir });
  await writeFile(join(testDir, 'code.ts'), 'const x = 1;\n');
  await execa('git', ['add', '-A'], { cwd: testDir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: testDir });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('createCheckpoint', () => {
  it('saves a patch file at the correct path', async () => {
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');

    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    const patchPath = join(testDir, '.opta', 'checkpoints', SESSION_ID, '1.patch');
    const content = await readFile(patchPath, 'utf-8');
    expect(content).toContain('-const x = 1;');
    expect(content).toContain('+const x = 2;');
  });

  it('creates index.json with metadata', async () => {
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');

    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    const indexPath = join(testDir, '.opta', 'checkpoints', SESSION_ID, 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf-8'));
    expect(index.session).toBe(SESSION_ID);
    expect(index.checkpoints).toHaveLength(1);
    expect(index.checkpoints[0]).toMatchObject({
      n: 1,
      tool: 'edit_file',
      path: 'code.ts',
    });
    expect(index.checkpoints[0].timestamp).toBeDefined();
  });

  it('appends to existing index.json for multiple checkpoints', async () => {
    // First checkpoint
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    // Commit the change so the next diff is clean against HEAD
    await execa('git', ['add', '-A'], { cwd: testDir });
    await execa('git', ['commit', '-m', 'second'], { cwd: testDir });

    // Second checkpoint
    await writeFile(join(testDir, 'code.ts'), 'const x = 3;\n');
    await createCheckpoint(testDir, SESSION_ID, 2, 'write_file', 'code.ts');

    const indexPath = join(testDir, '.opta', 'checkpoints', SESSION_ID, 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf-8'));
    expect(index.checkpoints).toHaveLength(2);
    expect(index.checkpoints[0]!.n).toBe(1);
    expect(index.checkpoints[1]!.n).toBe(2);
    expect(index.checkpoints[1]!.tool).toBe('write_file');
  });

  it('is a no-op for unmodified files', async () => {
    // code.ts is unchanged since the last commit
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    const checkpointDir = join(testDir, '.opta', 'checkpoints', SESSION_ID);
    // The directory should not be created for empty diffs
    await expect(access(checkpointDir)).rejects.toThrow();
  });
});

describe('listCheckpoints', () => {
  it('returns all checkpoints in order', async () => {
    // Create two checkpoints
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    await execa('git', ['add', '-A'], { cwd: testDir });
    await execa('git', ['commit', '-m', 'second'], { cwd: testDir });

    await writeFile(join(testDir, 'code.ts'), 'const x = 3;\n');
    await createCheckpoint(testDir, SESSION_ID, 2, 'write_file', 'code.ts');

    const checkpoints = await listCheckpoints(testDir, SESSION_ID);
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]!.n).toBe(1);
    expect(checkpoints[1]!.n).toBe(2);
  });

  it('returns empty array for unknown session', async () => {
    const checkpoints = await listCheckpoints(testDir, 'nonexistent-session');
    expect(checkpoints).toEqual([]);
  });
});

describe('undoCheckpoint', () => {
  it('without n, undoes the last checkpoint (file content restored)', async () => {
    // Modify and checkpoint
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    // Undo the last checkpoint
    await undoCheckpoint(testDir, SESSION_ID);

    const content = await readFile(join(testDir, 'code.ts'), 'utf-8');
    expect(content).toBe('const x = 1;\n');
  });

  it('with specific n, undoes that checkpoint', async () => {
    // Modify and checkpoint
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    // Undo checkpoint #1 explicitly
    await undoCheckpoint(testDir, SESSION_ID, 1);

    const content = await readFile(join(testDir, 'code.ts'), 'utf-8');
    expect(content).toBe('const x = 1;\n');
  });
});

describe('cleanupCheckpoints', () => {
  it('removes the session directory', async () => {
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    const sessionDir = join(testDir, '.opta', 'checkpoints', SESSION_ID);
    // Confirm it exists
    await access(sessionDir);

    await cleanupCheckpoints(testDir, SESSION_ID);

    await expect(access(sessionDir)).rejects.toThrow();
  });

  it('is a no-op for unknown session', async () => {
    // Should not throw
    await expect(
      cleanupCheckpoints(testDir, 'nonexistent-session'),
    ).resolves.toBeUndefined();
  });
});

describe('readPatchContent', () => {
  it('returns patch content for an existing checkpoint', async () => {
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    const content = await readPatchContent(testDir, SESSION_ID, 1);
    expect(content).toContain('-const x = 1;');
    expect(content).toContain('+const x = 2;');
  });

  it('returns empty string for non-existent checkpoint', async () => {
    const content = await readPatchContent(testDir, SESSION_ID, 999);
    expect(content).toBe('');
  });

  it('returns empty string for non-existent session', async () => {
    const content = await readPatchContent(testDir, 'no-such-session', 1);
    expect(content).toBe('');
  });
});

describe('patchStat', () => {
  it('counts additions and deletions', () => {
    const patch = [
      'diff --git a/code.ts b/code.ts',
      '--- a/code.ts',
      '+++ b/code.ts',
      '@@ -1 +1 @@',
      '-const x = 1;',
      '+const x = 2;',
      '+const y = 3;',
    ].join('\n');

    const stat = patchStat(patch);
    expect(stat.additions).toBe(2);
    expect(stat.deletions).toBe(1);
  });

  it('does not count --- and +++ as changes', () => {
    const patch = [
      '--- a/code.ts',
      '+++ b/code.ts',
      '@@ -1 +1 @@',
      ' unchanged line',
    ].join('\n');

    const stat = patchStat(patch);
    expect(stat.additions).toBe(0);
    expect(stat.deletions).toBe(0);
  });

  it('returns zeros for empty patch', () => {
    const stat = patchStat('');
    expect(stat.additions).toBe(0);
    expect(stat.deletions).toBe(0);
  });
});

describe('undoAllCheckpoints', () => {
  it('reverts a single checkpoint', async () => {
    await writeFile(join(testDir, 'code.ts'), 'const x = 2;\n');
    await createCheckpoint(testDir, SESSION_ID, 1, 'edit_file', 'code.ts');

    const undone = await undoAllCheckpoints(testDir, SESSION_ID);
    expect(undone).toBe(1);

    const content = await readFile(join(testDir, 'code.ts'), 'utf-8');
    expect(content).toBe('const x = 1;\n');
  });

  it('throws for empty session', async () => {
    await expect(
      undoAllCheckpoints(testDir, 'nonexistent-session'),
    ).rejects.toThrow('No checkpoints found');
  });
});
