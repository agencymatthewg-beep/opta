import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserRuntimeDaemon,
  browserRuntimeSessionStorePath,
  getSharedBrowserRuntimeDaemon,
  resetSharedBrowserRuntimeDaemonForTests,
} from '../../src/browser/runtime-daemon.js';
import { browserRunCorpusLatestPath } from '../../src/browser/run-corpus.js';
import * as artifacts from '../../src/browser/artifacts.js';
import * as profileStore from '../../src/browser/profile-store.js';

let testDir = '';

afterEach(async () => {
  await resetSharedBrowserRuntimeDaemonForTests();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('BrowserRuntimeDaemon', () => {
  async function pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  it('persists sessions and recovers them on restart', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const daemonA = new BrowserRuntimeDaemon({
      cwd: testDir,
      loadPlaywright: async () => null,
      now: () => new Date('2026-02-23T10:00:00.000Z'),
    });

    await daemonA.start();
    const opened = await daemonA.openSession({ sessionId: 'sess-recover-01' });
    expect(opened.action.sessionId).toBe('sess-recover-01');

    const storePath = browserRuntimeSessionStorePath(testDir);
    const stored = JSON.parse(await readFile(storePath, 'utf-8')) as {
      sessions: Array<{ sessionId: string }>;
    };
    expect(stored.sessions.some((item) => item.sessionId === 'sess-recover-01')).toBe(true);

    const daemonB = new BrowserRuntimeDaemon({
      cwd: testDir,
      loadPlaywright: async () => null,
      now: () => new Date('2026-02-23T10:01:00.000Z'),
    });
    await daemonB.start();

    const health = daemonB.health();
    expect(health.running).toBe(true);
    expect(health.sessionCount).toBe(1);
    expect(health.recoveredSessionIds).toContain('sess-recover-01');
  });

  it('refreshes run corpus summary on session close and daemon stop', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));
    let nowValue = new Date('2026-02-23T10:00:00.000Z');

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      loadPlaywright: async () => null,
      now: () => nowValue,
    });

    await daemon.start();
    const opened = await daemon.openSession({ sessionId: 'sess-run-corpus-01' });
    expect(opened.action.sessionId).toBe('sess-run-corpus-01');
    expect(opened.data?.id).toBe('sess-run-corpus-01');

    nowValue = new Date('2026-02-23T10:00:10.000Z');
    const closed = await daemon.closeSession('sess-run-corpus-01');
    expect(closed.ok).toBe(true);

    const corpusPath = browserRunCorpusLatestPath(testDir);
    const afterClose = JSON.parse(await readFile(corpusPath, 'utf-8')) as {
      generatedAt: string;
      assessedSessionCount: number;
    };
    expect(afterClose.generatedAt).toBe('2026-02-23T10:00:10.000Z');
    expect(afterClose.assessedSessionCount).toBeGreaterThanOrEqual(1);

    nowValue = new Date('2026-02-23T10:00:30.000Z');
    await daemon.stop();

    const afterStop = JSON.parse(await readFile(corpusPath, 'utf-8')) as {
      generatedAt: string;
    };
    expect(afterStop.generatedAt).toBe('2026-02-23T10:00:30.000Z');
  });

  it('enforces max sessions and supports pause/resume/kill controls', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      maxSessions: 1,
      loadPlaywright: async () => null,
    });

    await daemon.start();

    const first = await daemon.openSession({ sessionId: 'sess-control-01' });
    expect(first.action.sessionId).toBe('sess-control-01');

    const second = await daemon.openSession({ sessionId: 'sess-control-02' });
    expect(second.ok).toBe(false);
    expect(second.error?.code).toBe('MAX_SESSIONS_REACHED');

    daemon.pause();
    const pausedNavigate = await daemon.navigate('sess-control-01', {
      url: 'https://example.com',
    });
    expect(pausedNavigate.ok).toBe(false);
    expect(pausedNavigate.error?.code).toBe('DAEMON_PAUSED');

    daemon.resume();
    const resumedNavigate = await daemon.navigate('sess-control-01', {
      url: 'https://example.com',
    });
    expect(resumedNavigate.error?.code).not.toBe('DAEMON_PAUSED');

    await daemon.kill();
    const afterKill = await daemon.openSession({ sessionId: 'sess-control-03' });
    expect(afterKill.ok).toBe(false);
    expect(afterKill.error?.code).toBe('DAEMON_STOPPED');
  });

  it('does not persist failed open attempts as active sessions', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      loadPlaywright: async () => ({
        chromium: {
          launch: vi.fn(async () => {
            throw new Error('launch failed');
          }),
        },
      } as unknown as NonNullable<Awaited<ReturnType<NonNullable<ConstructorParameters<typeof BrowserRuntimeDaemon>[0]>['loadPlaywright']>>>),
    });

    await daemon.start();
    const opened = await daemon.openSession({ sessionId: 'sess-open-failed-01' });
    expect(opened.ok).toBe(false);
    expect(opened.error?.code).toBe('OPEN_SESSION_FAILED');
    expect(daemon.health().sessionCount).toBe(0);

    const stored = JSON.parse(await readFile(browserRuntimeSessionStorePath(testDir), 'utf-8')) as {
      sessions: Array<{ sessionId: string }>;
    };
    expect(stored.sessions).toEqual([]);
  });

  it('continues recovering persisted sessions when one recovery open throws', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));
    const now = '2026-02-23T10:00:00.000Z';

    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    await writeFile(
      browserRuntimeSessionStorePath(testDir),
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: now,
        sessions: [
          {
            sessionId: 'sess-bad-01',
            mode: 'isolated',
            status: 'open',
            runtime: 'playwright',
            createdAt: now,
            updatedAt: now,
          },
          {
            sessionId: 'sess-good-01',
            mode: 'isolated',
            status: 'open',
            runtime: 'playwright',
            createdAt: now,
            updatedAt: now,
          },
        ],
      }, null, 2) + '\n',
      'utf-8',
    );

    const sessionManager = {
      openSession: vi.fn(async (input: { sessionId: string; mode?: 'isolated' | 'attach' }) => {
        if (input.sessionId === 'sess-bad-01') {
          throw new Error('corrupt persisted session');
        }
        return {
          ok: true,
          action: {
            id: 'action-open-good-01',
            sessionId: input.sessionId,
            type: 'openSession' as const,
            createdAt: now,
            input: {},
          },
          data: {
            id: input.sessionId,
            runId: input.sessionId,
            mode: input.mode ?? 'isolated',
            status: 'open' as const,
            runtime: 'playwright' as const,
            createdAt: now,
            updatedAt: now,
            artifactsDir: join(testDir, '.opta', 'browser', input.sessionId),
          },
        };
      }),
      closeSession: vi.fn(async (sessionId: string) => ({
        ok: true,
        action: {
          id: 'action-close',
          sessionId,
          type: 'closeSession' as const,
          createdAt: now,
          input: {},
        },
        data: {
          sessionId,
          status: 'closed' as const,
        },
      })),
    } as unknown as ConstructorParameters<typeof BrowserRuntimeDaemon>[0]['sessionManager'];

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      sessionManager,
      now: () => new Date(now),
    });

    await daemon.start();
    const health = daemon.health();
    expect(health.running).toBe(true);
    expect(health.sessionCount).toBe(1);
    expect(health.sessions[0]?.sessionId).toBe('sess-good-01');
    expect(health.recoveredSessionIds).toEqual(['sess-good-01']);
  });

  it('recovers from malformed runtime session store JSON', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));
    const storePath = browserRuntimeSessionStorePath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    await writeFile(storePath, '{\n  "schemaVersion": 1,\n  "sessions": [\n', 'utf-8');

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      loadPlaywright: async () => null,
    });
    await daemon.start();

    const health = daemon.health();
    expect(health.running).toBe(true);
    expect(health.sessionCount).toBe(0);

    const stored = JSON.parse(await readFile(storePath, 'utf-8')) as {
      schemaVersion: number;
      sessions: Array<{ sessionId: string }>;
    };
    expect(stored.schemaVersion).toBe(1);
    expect(stored.sessions).toEqual([]);
  });

  it('computes deterministic isolated profile dirs when continuity is enabled', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com'),
    };
    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };
    const launchPersistentContext = vi.fn(async () => context);
    const launch = vi.fn(async () => {
      throw new Error('launch should not be used when continuity is enabled');
    });

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      persistSessions: false,
      persistProfileContinuity: true,
      loadPlaywright: async () => ({
        chromium: {
          launch,
          launchPersistentContext,
          connectOverCDP: vi.fn(async () => {
            throw new Error('attach path should not be used in this test');
          }),
        },
      }),
    });

    await daemon.start();
    const opened = await daemon.openSession({ sessionId: 'sess-profile-01', mode: 'isolated' });
    expect(opened.ok).toBe(true);
    expect(opened.data?.profileDir).toBe(join(testDir, '.opta', 'browser', 'profiles', 'sess-profile-01'));
    expect(launchPersistentContext).toHaveBeenCalledWith(
      join(testDir, '.opta', 'browser', 'profiles', 'sess-profile-01'),
      { headless: true },
    );
    expect(launch).not.toHaveBeenCalled();
  });

  it('still opens and navigates when profile continuity is disabled', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com/dashboard'),
    };
    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };
    const browser = {
      newContext: vi.fn(async () => context),
      contexts: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };
    const launch = vi.fn(async () => browser);
    const launchPersistentContext = vi.fn(async () => context);

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      persistSessions: false,
      persistProfileContinuity: false,
      loadPlaywright: async () => ({
        chromium: {
          launch,
          launchPersistentContext,
          connectOverCDP: vi.fn(async () => browser),
        },
      }),
    });

    await daemon.start();
    const opened = await daemon.openSession({ sessionId: 'sess-profile-off-01', mode: 'isolated' });
    expect(opened.ok).toBe(true);
    expect(opened.data?.profileDir).toBeUndefined();
    expect(launch).toHaveBeenCalledWith({ headless: true });
    expect(launchPersistentContext).not.toHaveBeenCalled();

    const navigated = await daemon.navigate('sess-profile-off-01', { url: 'https://example.com/dashboard' });
    expect(navigated.ok).toBe(true);
    expect(navigated.data?.url).toBe('https://example.com/dashboard');
  });

  it('auto-prunes stale profile dirs while preserving recovered active sessions', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));
    const now = new Date('2026-02-23T10:00:00.000Z');
    const profileRoot = profileStore.browserProfilesRootPath(testDir);
    const oldModifiedAt = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1_000);
    const keepSessionId = 'sess-keep-active';
    const pruneSessionId = 'sess-prune-old';

    const keepProfileDir = join(profileRoot, keepSessionId);
    const pruneProfileDir = join(profileRoot, pruneSessionId);
    await mkdir(keepProfileDir, { recursive: true });
    await mkdir(pruneProfileDir, { recursive: true });
    await writeFile(join(keepProfileDir, 'profile.json'), '{}\n', 'utf-8');
    await writeFile(join(pruneProfileDir, 'profile.json'), '{}\n', 'utf-8');
    await utimes(keepProfileDir, oldModifiedAt, oldModifiedAt);
    await utimes(pruneProfileDir, oldModifiedAt, oldModifiedAt);

    const storePath = browserRuntimeSessionStorePath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    await writeFile(
      storePath,
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: now.toISOString(),
        sessions: [
          {
            sessionId: keepSessionId,
            mode: 'isolated',
            status: 'open',
            runtime: 'unavailable',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
      }, null, 2) + '\n',
      'utf-8',
    );

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      now: () => now,
      persistProfileContinuity: true,
      profileRetentionPolicy: {
        retentionDays: 30,
        maxPersistedProfiles: 200,
      },
      loadPlaywright: async () => null,
    });

    await daemon.start();
    expect(daemon.health().sessionCount).toBe(1);
    expect(daemon.health().sessions[0]?.sessionId).toBe(keepSessionId);

    expect(await pathExists(keepProfileDir)).toBe(true);
    expect(await pathExists(pruneProfileDir)).toBe(false);
  });

  it('auto-prunes stale browser artifact session dirs when retention is enabled', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));
    const now = new Date('2026-02-23T10:00:00.000Z');
    const artifactsRoot = artifacts.browserArtifactsRootPath(testDir);
    const oldSessionDir = join(artifactsRoot, 'sess-artifact-old');
    const freshSessionDir = join(artifactsRoot, 'sess-artifact-fresh');
    const reservedDir = join(artifactsRoot, 'run-corpus');
    const oldModifiedAt = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1_000);

    await mkdir(oldSessionDir, { recursive: true });
    await mkdir(freshSessionDir, { recursive: true });
    await mkdir(reservedDir, { recursive: true });
    await writeFile(join(oldSessionDir, 'metadata.json'), '{}\n', 'utf-8');
    await writeFile(join(freshSessionDir, 'metadata.json'), '{}\n', 'utf-8');
    await utimes(oldSessionDir, oldModifiedAt, oldModifiedAt);

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      now: () => now,
      persistSessions: false,
      artifactPrune: {
        enabled: true,
        policy: {
          retentionDays: 30,
          maxPersistedSessions: 200,
        },
        intervalMs: 60 * 60 * 1_000,
      },
      runCorpusRefresh: { enabled: false },
      loadPlaywright: async () => null,
    });

    await daemon.start();

    expect(await pathExists(oldSessionDir)).toBe(false);
    expect(await pathExists(freshSessionDir)).toBe(true);
    expect(await pathExists(reservedDir)).toBe(true);
    expect(daemon.health().artifactPrune?.lastStatus).toBe('success');
    expect(daemon.health().artifactPrune?.lastReason).toBe('startup');
    await daemon.stop();
  });

  it('schedules periodic auto-prune and clears timer on stop', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const pruneSpy = vi.spyOn(profileStore, 'pruneBrowserProfileDirs').mockResolvedValue({
      rootDir: profileStore.browserProfilesRootPath(testDir),
      policy: profileStore.resolveBrowserProfileRetentionPolicy({
        retentionDays: 30,
        maxPersistedProfiles: 200,
      }),
      listed: [],
      kept: [],
      pruned: [],
    });

    vi.useFakeTimers();
    try {
      const daemon = new BrowserRuntimeDaemon({
        cwd: testDir,
        now: () => new Date('2026-02-23T10:00:00.000Z'),
        persistSessions: false,
        persistProfileContinuity: true,
        profilePruneIntervalMs: 1_000,
        loadPlaywright: async () => null,
      });

      await daemon.start();
      expect(pruneSpy).toHaveBeenCalledTimes(1);
      expect(daemon.health().profilePrune.enabled).toBe(true);
      expect(daemon.health().profilePrune.lastReason).toBe('startup');
      expect(daemon.health().profilePrune.lastStatus).toBe('success');
      expect(daemon.health().profilePrune.lastPrunedCount).toBe(0);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(pruneSpy).toHaveBeenCalledTimes(2);
      expect(daemon.health().profilePrune.lastReason).toBe('interval');
      expect(daemon.health().profilePrune.lastStatus).toBe('success');

      await daemon.stop();
      await vi.advanceTimersByTimeAsync(3_000);
      expect(pruneSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      pruneSpy.mockRestore();
    }
  });

  it('records prune telemetry when auto-prune fails', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));
    const pruneSpy = vi.spyOn(profileStore, 'pruneBrowserProfileDirs').mockRejectedValue(
      new Error('permission denied'),
    );

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      now: () => new Date('2026-02-23T10:00:00.000Z'),
      persistSessions: false,
      persistProfileContinuity: true,
      loadPlaywright: async () => null,
    });

    await daemon.start();
    const pruneHealth = daemon.health().profilePrune;
    expect(pruneSpy).toHaveBeenCalledTimes(1);
    expect(pruneHealth.enabled).toBe(true);
    expect(pruneHealth.lastStatus).toBe('error');
    expect(pruneHealth.lastReason).toBe('startup');
    expect(pruneHealth.lastError).toContain('permission denied');
    expect(pruneHealth.lastPrunedCount).toBeUndefined();
    await daemon.stop();
    pruneSpy.mockRestore();
  });

  it('closes old shared daemon sessions when runtime config key changes', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-runtime-'));

    const daemonA = await getSharedBrowserRuntimeDaemon({
      cwd: testDir,
      maxSessions: 1,
      persistSessions: true,
      loadPlaywright: async () => null,
    });
    await daemonA.start();
    const opened = await daemonA.openSession({ sessionId: 'sess-rekey-01' });
    expect(opened.action.sessionId).toBe('sess-rekey-01');
    expect(opened.data?.status).toBe('open');

    const daemonB = await getSharedBrowserRuntimeDaemon({
      cwd: testDir,
      maxSessions: 2,
      persistSessions: true,
      loadPlaywright: async () => null,
    });

    expect(daemonB).not.toBe(daemonA);
    const stored = JSON.parse(await readFile(browserRuntimeSessionStorePath(testDir), 'utf-8')) as {
      sessions: Array<{ sessionId: string }>;
    };
    expect(stored.sessions).toEqual([]);
  });
});
