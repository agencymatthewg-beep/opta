import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  browserProfilesRootPath,
  DEFAULT_BROWSER_PROFILE_RETENTION_POLICY,
  listBrowserProfileDirs,
  pruneBrowserProfileDirs,
} from '../../src/browser/profile-store.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('browser profile store', () => {
  let testDir = '';

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-profiles-'));
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
      testDir = '';
    }
  });

  async function createProfile(sessionId: string, modifiedAt: Date): Promise<string> {
    const dir = join(browserProfilesRootPath(testDir), sessionId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'profile.json'), `{"sessionId":"${sessionId}"}\n`, 'utf-8');
    await utimes(dir, modifiedAt, modifiedAt);
    return dir;
  }

  async function pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  it('returns empty list when the profile root does not exist', async () => {
    const listed = await listBrowserProfileDirs(testDir);
    expect(listed).toEqual([]);
  });

  it('lists profile directories with deterministic ordering', async () => {
    const root = browserProfilesRootPath(testDir);
    await mkdir(root, { recursive: true });
    await mkdir(join(root, 'sess-b'), { recursive: true });
    await mkdir(join(root, 'sess-a'), { recursive: true });
    await writeFile(join(root, 'notes.txt'), 'not a profile dir\n', 'utf-8');

    const listed = await listBrowserProfileDirs(testDir);
    expect(listed.map((entry) => entry.sessionId)).toEqual(['sess-a', 'sess-b']);
  });

  it('prunes profiles by retention days and max persisted count', async () => {
    const now = new Date('2026-02-23T12:00:00.000Z');
    await createProfile('sess-old-1', new Date(now.getTime() - 40 * DAY_MS));
    await createProfile('sess-old-2', new Date(now.getTime() - 31 * DAY_MS));
    await createProfile('sess-fresh-1', new Date(now.getTime() - 10 * DAY_MS));
    await createProfile('sess-fresh-2', new Date(now.getTime() - 2 * DAY_MS));
    await createProfile('sess-fresh-3', new Date(now.getTime() - 1 * DAY_MS));

    const result = await pruneBrowserProfileDirs({
      cwd: testDir,
      now: () => now,
      policy: {
        retentionDays: 30,
        maxPersistedProfiles: 2,
      },
    });

    expect(result.pruned.map((entry) => entry.sessionId)).toEqual([
      'sess-fresh-1',
      'sess-old-1',
      'sess-old-2',
    ]);
    expect(result.kept.map((entry) => entry.sessionId)).toEqual([
      'sess-fresh-2',
      'sess-fresh-3',
    ]);

    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-old-1'))).toBe(false);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-old-2'))).toBe(false);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-fresh-1'))).toBe(false);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-fresh-2'))).toBe(true);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-fresh-3'))).toBe(true);
  });

  it('never prunes excluded session ids', async () => {
    const now = new Date('2026-02-23T12:00:00.000Z');
    await createProfile('sess-protected', new Date(now.getTime() - 45 * DAY_MS));
    await createProfile('sess-old-eligible', new Date(now.getTime() - 40 * DAY_MS));

    const result = await pruneBrowserProfileDirs({
      cwd: testDir,
      now: () => now,
      excludeSessionIds: ['sess-protected'],
      policy: {
        retentionDays: 30,
        maxPersistedProfiles: 200,
      },
    });

    expect(result.pruned.map((entry) => entry.sessionId)).toEqual(['sess-old-eligible']);
    expect(result.kept.map((entry) => entry.sessionId)).toEqual(['sess-protected']);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-protected'))).toBe(true);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-old-eligible'))).toBe(false);
  });

  it('uses the safe default retention policy when policy is omitted', async () => {
    const now = new Date('2026-02-23T12:00:00.000Z');
    await createProfile('sess-old-default', new Date(now.getTime() - 40 * DAY_MS));
    await createProfile('sess-fresh-default', new Date(now.getTime() - 1 * DAY_MS));

    const result = await pruneBrowserProfileDirs({
      cwd: testDir,
      now: () => now,
    });

    expect(result.policy).toEqual(DEFAULT_BROWSER_PROFILE_RETENTION_POLICY);
    expect(result.pruned.map((entry) => entry.sessionId)).toEqual(['sess-old-default']);
    expect(result.kept.map((entry) => entry.sessionId)).toEqual(['sess-fresh-default']);
  });

  it('prunes only the explicit session profile when provided', async () => {
    const now = new Date('2026-02-23T12:00:00.000Z');
    await createProfile('sess-keep-1', new Date(now.getTime() - 10 * DAY_MS));
    await createProfile('sess-prune-1', new Date(now.getTime() - 10 * DAY_MS));

    const result = await pruneBrowserProfileDirs({
      cwd: testDir,
      now: () => now,
      sessionId: 'sess-prune-1',
      policy: {
        retentionDays: 365,
        maxPersistedProfiles: 200,
      },
    });

    expect(result.pruned.map((entry) => entry.sessionId)).toEqual(['sess-prune-1']);
    expect(result.kept.map((entry) => entry.sessionId)).toEqual(['sess-keep-1']);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-prune-1'))).toBe(false);
    expect(await pathExists(join(browserProfilesRootPath(testDir), 'sess-keep-1'))).toBe(true);
  });

  it('rejects unsafe explicit session ids', async () => {
    const outside = join(testDir, 'outside-profile');
    await mkdir(outside, { recursive: true });

    await expect(() =>
      pruneBrowserProfileDirs({
        cwd: testDir,
        sessionId: '../outside-profile',
        policy: {
          retentionDays: 30,
          maxPersistedProfiles: 200,
        },
      })
    ).rejects.toThrow('Invalid browser profile session id');

    expect(await pathExists(outside)).toBe(true);
  });
});
