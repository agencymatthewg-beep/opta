import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  browserArtifactsRootPath,
  listBrowserArtifactSessionDirs,
  pruneBrowserArtifactSessionDirs,
} from '../../src/browser/artifacts.js';

let testDir = '';

afterEach(async () => {
  if (!testDir) return;
  await rm(testDir, { recursive: true, force: true });
  testDir = '';
});

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('browser artifact retention', () => {
  it('lists session dirs and ignores reserved directories', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-artifacts-'));
    const root = browserArtifactsRootPath(testDir);
    await mkdir(join(root, 'sess-a'), { recursive: true });
    await mkdir(join(root, 'run-corpus'), { recursive: true });
    await writeFile(join(root, 'sess-a', 'metadata.json'), '{}\n', 'utf-8');

    const listed = await listBrowserArtifactSessionDirs(testDir);
    expect(listed.map((entry) => entry.sessionId)).toEqual(['sess-a']);
  });

  it('prunes stale session directories and preserves excluded sessions', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-artifacts-'));
    const root = browserArtifactsRootPath(testDir);
    const now = new Date('2026-02-24T00:00:00.000Z');
    const oldAt = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1_000);

    const keepDir = join(root, 'sess-keep');
    const oldDir = join(root, 'sess-old');
    const excludedDir = join(root, 'sess-excluded');
    await mkdir(keepDir, { recursive: true });
    await mkdir(oldDir, { recursive: true });
    await mkdir(excludedDir, { recursive: true });
    await writeFile(join(keepDir, 'metadata.json'), '{}\n', 'utf-8');
    await writeFile(join(oldDir, 'metadata.json'), '{}\n', 'utf-8');
    await writeFile(join(excludedDir, 'metadata.json'), '{}\n', 'utf-8');
    await utimes(oldDir, oldAt, oldAt);
    await utimes(excludedDir, oldAt, oldAt);

    const result = await pruneBrowserArtifactSessionDirs({
      cwd: testDir,
      now: () => now,
      excludeSessionIds: ['sess-excluded'],
      policy: {
        retentionDays: 30,
        maxPersistedSessions: 200,
      },
    });

    expect(result.pruned.map((entry) => entry.sessionId)).toEqual(['sess-old']);
    expect(await pathExists(oldDir)).toBe(false);
    expect(await pathExists(keepDir)).toBe(true);
    expect(await pathExists(excludedDir)).toBe(true);
  });
});
