import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendBrowserApprovalEvent } from '../../src/browser/approval-log.js';
import { browserCanaryLatestPath } from '../../src/browser/canary-evidence.js';
import { browserProfilesRootPath } from '../../src/browser/profile-store.js';
import { browserRunCorpusLatestPath } from '../../src/browser/run-corpus.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

type DispatchSlashCommand = typeof import('../../src/commands/slash/index.js').dispatchSlashCommand;

describe('/browser approvals slash path', () => {
  let dispatchSlashCommand: DispatchSlashCommand;
  let testDir = '';
  let logs: string[] = [];
  const DAY_MS = 24 * 60 * 60 * 1000;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T21:00:00.000Z'));
    logs = [];
    testDir = await mkdtemp(join(tmpdir(), 'opta-slash-browser-'));

    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    ({ dispatchSlashCommand } = await import('../../src/commands/slash/index.js'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
      testDir = '';
    }
  });

  function makeCtx() {
    return {
      session: { id: 'session-test', messages: [] },
      config: structuredClone(DEFAULT_CONFIG),
      chatState: {},
    } as any;
  }

  async function createProfile(sessionId: string, modifiedAt: Date): Promise<void> {
    const dir = join(browserProfilesRootPath(testDir), sessionId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'profile.json'), `{"sessionId":"${sessionId}"}\n`, 'utf-8');
    await utimes(dir, modifiedAt, modifiedAt);
  }

  async function createCanarySession(sessionId: string, updatedAt: string): Promise<void> {
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });
    const artifactRelativePath = join('.opta', 'browser', sessionId, '0001-screenshot.png');
    const artifactAbsolutePath = join(testDir, artifactRelativePath);
    await writeFile(artifactAbsolutePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await writeFile(
      join(sessionDir, 'metadata.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessionId,
        runId: `run-${sessionId}`,
        mode: 'isolated',
        status: 'closed',
        runtime: 'playwright',
        createdAt: '2026-02-23T20:00:00.000Z',
        updatedAt,
        artifacts: [
          {
            id: 'artifact-0001',
            sessionId,
            actionId: 'action-000002',
            kind: 'screenshot',
            createdAt: '2026-02-23T20:00:00.200Z',
            relativePath: artifactRelativePath,
            absolutePath: artifactAbsolutePath,
            mimeType: 'image/png',
            sizeBytes: 4,
          },
        ],
        actions: [
          {
            action: {
              id: 'action-000001',
              sessionId,
              type: 'openSession',
              createdAt: '2026-02-23T20:00:00.000Z',
              input: {},
            },
            ok: true,
            artifactIds: [],
          },
          {
            action: {
              id: 'action-000002',
              sessionId,
              type: 'screenshot',
              createdAt: '2026-02-23T20:00:00.100Z',
              input: {},
            },
            ok: true,
            artifactIds: ['artifact-0001'],
          },
        ],
      }, null, 2) + '\n',
      'utf-8',
    );

    await writeFile(
      join(sessionDir, 'steps.jsonl'),
      [
        JSON.stringify({
          sequence: 1,
          sessionId,
          runId: `run-${sessionId}`,
          actionId: 'action-000001',
          actionType: 'openSession',
          timestamp: '2026-02-23T20:00:00.050Z',
          ok: true,
          artifactIds: [],
          artifactPaths: [],
        }),
        JSON.stringify({
          sequence: 2,
          sessionId,
          runId: `run-${sessionId}`,
          actionId: 'action-000002',
          actionType: 'screenshot',
          timestamp: '2026-02-23T20:00:00.200Z',
          ok: true,
          artifactIds: ['artifact-0001'],
          artifactPaths: [artifactRelativePath],
        }),
      ].join('\n') + '\n',
      'utf-8',
    );

    await writeFile(
      join(sessionDir, 'recordings.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessionId,
        runId: `run-${sessionId}`,
        createdAt: '2026-02-23T20:00:00.000Z',
        updatedAt,
        recordings: [
          {
            sequence: 1,
            sessionId,
            runId: `run-${sessionId}`,
            actionId: 'action-000001',
            actionType: 'openSession',
            timestamp: '2026-02-23T20:00:00.050Z',
            ok: true,
            artifactIds: [],
            artifactPaths: [],
          },
          {
            sequence: 2,
            sessionId,
            runId: `run-${sessionId}`,
            actionId: 'action-000002',
            actionType: 'screenshot',
            timestamp: '2026-02-23T20:00:00.200Z',
            ok: true,
            artifactIds: ['artifact-0001'],
            artifactPaths: [artifactRelativePath],
          },
        ],
      }, null, 2) + '\n',
      'utf-8',
    );

    await writeFile(
      join(sessionDir, 'visual-diff-manifest.jsonl'),
      [
        JSON.stringify({
          schemaVersion: 1,
          sessionId,
          runId: `run-${sessionId}`,
          sequence: 1,
          actionId: 'action-000001',
          actionType: 'openSession',
          timestamp: '2026-02-23T20:00:00.050Z',
          status: 'pending',
          artifactIds: [],
          artifactPaths: [],
        }),
        JSON.stringify({
          schemaVersion: 1,
          sessionId,
          runId: `run-${sessionId}`,
          sequence: 2,
          actionId: 'action-000002',
          actionType: 'screenshot',
          timestamp: '2026-02-23T20:00:00.200Z',
          status: 'pending',
          artifactIds: ['artifact-0001'],
          artifactPaths: [artifactRelativePath],
        }),
      ].join('\n') + '\n',
      'utf-8',
    );
  }

  it('preserves /browser status behavior for runtime health output', async () => {
    const result = await dispatchSlashCommand('/browser status', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Browser runtime status retrieved.');
    expect(output).toContain('running=');
    expect(output).toContain('sessions=');
    expect(output).toContain('profile_prune=disabled');
  });

  it('prints recent browser approval events with the requested limit', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T20:00:00.000Z',
      tool: 'browser_click',
      sessionId: 'sess-001',
      decision: 'approved',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T20:01:00.000Z',
      tool: 'browser_type',
      sessionId: 'sess-001',
      decision: 'denied',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T20:02:00.000Z',
      tool: 'browser_navigate',
      sessionId: 'sess-002',
      decision: 'approved',
    });

    const result = await dispatchSlashCommand('/browser approvals 2', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Recent browser approvals (2/2)');
    expect(output).toContain('browser_navigate');
    expect(output).toContain('browser_type');
    expect(output).toContain('sess-002');
    expect(output).not.toContain('browser_click');
  });

  it('prints a clear empty state when approval log has no events', async () => {
    const result = await dispatchSlashCommand('/browser approvals', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('No browser approval events found.');
    expect(output).toContain('.opta/browser/approval-log.jsonl');
  });

  it('prints usage when approvals limit is invalid', async () => {
    const result = await dispatchSlashCommand('/browser approvals nope', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Usage: /browser');
    expect(output).toContain('/browser approvals 20');
  });

  it('shows profile policy even when no profiles are persisted', async () => {
    const result = await dispatchSlashCommand('/browser profiles', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('No persisted browser profiles found.');
    expect(output).toContain('policy: retentionDays=30 maxPersistedProfiles=200');
  });

  it('prints replay summary including runId when available', async () => {
    const sessionId = 'sess-replay-001';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, 'metadata.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessionId,
        runId: 'run-replay-001',
        mode: 'isolated',
        status: 'closed',
        runtime: 'playwright',
        createdAt: '2026-02-23T20:00:00.000Z',
        updatedAt: '2026-02-23T20:00:05.000Z',
        artifacts: [],
        actions: [
          {
            action: {
              id: 'action-000001',
              sessionId,
              type: 'openSession',
              createdAt: '2026-02-23T20:00:01.000Z',
              input: {},
            },
            ok: true,
            artifactIds: [],
          },
        ],
      }, null, 2) + '\n',
      'utf-8',
    );

    const result = await dispatchSlashCommand(`/browser replay ${sessionId}`, makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain(`Replay summary for ${sessionId}`);
    expect(output).toContain('status=closed runtime=playwright run=run-replay-001');
    expect(output).toContain('actions=1 failures=0 artifacts=0');
    expect(output).toContain('regression=none');
  });

  it('prints replay summary without runId for legacy metadata', async () => {
    const sessionId = 'sess-replay-002';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, 'metadata.json'),
      JSON.stringify({
        schemaVersion: 1,
        sessionId,
        mode: 'isolated',
        status: 'closed',
        runtime: 'unavailable',
        createdAt: '2026-02-23T20:00:00.000Z',
        updatedAt: '2026-02-23T20:00:05.000Z',
        artifacts: [],
        actions: [],
      }, null, 2) + '\n',
      'utf-8',
    );

    const result = await dispatchSlashCommand(`/browser replay ${sessionId}`, makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain(`Replay summary for ${sessionId}`);
    expect(output).toContain('status=closed runtime=unavailable');
    expect(output).toContain('regression=none');
    expect(output).not.toContain('run=');
  });

  it('lists persisted browser profiles in deterministic order', async () => {
    const now = new Date('2026-02-23T20:10:00.000Z');
    await createProfile('sess-b', new Date(now.getTime() - 2 * DAY_MS));
    await createProfile('sess-a', new Date(now.getTime() - 1 * DAY_MS));

    const result = await dispatchSlashCommand('/browser profiles', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Persisted browser profiles (2)');
    expect(output).toContain('policy: retentionDays=30 maxPersistedProfiles=200');
    expect(output).toContain('sess-a');
    expect(output).toContain('sess-b');
    expect(output.indexOf('sess-a')).toBeLessThan(output.indexOf('sess-b'));
  });

  it('prunes profiles by configured retention policy', async () => {
    const now = new Date('2026-02-23T20:15:00.000Z');
    await createProfile('sess-old-1', new Date(now.getTime() - 45 * DAY_MS));
    await createProfile('sess-cap-1', new Date(now.getTime() - 5 * DAY_MS));
    await createProfile('sess-keep-1', new Date(now.getTime() - 1 * DAY_MS));

    const ctx = makeCtx();
    ctx.config.browser.runtime.profileRetentionDays = 30;
    ctx.config.browser.runtime.maxPersistedProfiles = 1;

    const result = await dispatchSlashCommand('/browser profiles prune', ctx);
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Pruned browser profiles (2)');
    expect(output).toContain('sess-old-1');
    expect(output).toContain('sess-cap-1');
    expect(output).toContain('policy: retentionDays=30 maxPersistedProfiles=1');

    logs = [];
    await dispatchSlashCommand('/browser profiles', ctx);
    const listOutput = logs.join('\n');
    expect(listOutput).toContain('Persisted browser profiles (1)');
    expect(listOutput).toContain('sess-keep-1');
    expect(listOutput).not.toContain('sess-old-1');
    expect(listOutput).not.toContain('sess-cap-1');
  });

  it('prunes only the requested session profile when provided', async () => {
    const now = new Date('2026-02-23T20:20:00.000Z');
    await createProfile('sess-target', new Date(now.getTime() - 2 * DAY_MS));
    await createProfile('sess-other', new Date(now.getTime() - 1 * DAY_MS));

    const result = await dispatchSlashCommand('/browser profiles prune sess-target', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Pruned browser profiles (1)');
    expect(output).toContain('sess-target');
    expect(output).not.toContain('sess-other');
    expect(output).toContain('policy: retentionDays=30 maxPersistedProfiles=200');
  });

  it('prints usage for invalid profile prune session id', async () => {
    const result = await dispatchSlashCommand('/browser profiles prune ../danger', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Usage: /browser');
    expect(output).toContain('/browser profiles prune <session_id>');
  });

  it('captures canary evidence and updates rollback drill evidence', async () => {
    await createCanarySession('sess-canary-001', '2026-02-23T20:20:00.000Z');

    const captureResult = await dispatchSlashCommand('/browser canary 24', makeCtx());
    expect(captureResult).toBe('handled');

    const captureOutput = logs.join('\n');
    expect(captureOutput).toContain('Browser canary evidence captured.');
    expect(captureOutput).toContain('overall=pass');
    expect(captureOutput).toContain('rollback_drill=pending');
    expect(captureOutput).toContain(browserCanaryLatestPath(testDir));

    const latestRaw = await readFile(browserCanaryLatestPath(testDir), 'utf-8');
    const latest = JSON.parse(latestRaw) as {
      assessedSessionCount: number;
      rollbackDrill: { status: string };
    };
    expect(latest.assessedSessionCount).toBe(1);
    expect(latest.rollbackDrill.status).toBe('pending');

    logs = [];
    const rollbackResult = await dispatchSlashCommand(
      '/browser canary rollback pass rehearsal complete',
      makeCtx(),
    );
    expect(rollbackResult).toBe('handled');

    const rollbackOutput = logs.join('\n');
    expect(rollbackOutput).toContain('Canary rollback drill updated.');
    expect(rollbackOutput).toContain('rollback_drill=pass');
    expect(rollbackOutput).toContain('notes=rehearsal complete');

    const updatedRaw = await readFile(browserCanaryLatestPath(testDir), 'utf-8');
    const updated = JSON.parse(updatedRaw) as {
      rollbackDrill: { status: string; notes?: string; executedAt?: string };
    };
    expect(updated.rollbackDrill.status).toBe('pass');
    expect(updated.rollbackDrill.notes).toBe('rehearsal complete');
    expect(typeof updated.rollbackDrill.executedAt).toBe('string');
  });

  it('captures browser run trends and persists run-corpus latest snapshot', async () => {
    await createCanarySession('sess-trend-001', '2026-02-23T20:20:00.000Z');
    await createCanarySession('sess-trend-002', '2026-02-23T20:10:00.000Z');

    const result = await dispatchSlashCommand('/browser trends 24 1', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Browser run trends captured.');
    expect(output).toContain('window_hours=24 sessions=2');
    expect(output).toContain('top_sessions=1');
    expect(output).toContain(browserRunCorpusLatestPath(testDir));
    expect(output).toContain('sess-trend-001');

    const latestRaw = await readFile(browserRunCorpusLatestPath(testDir), 'utf-8');
    const latest = JSON.parse(latestRaw) as {
      assessedSessionCount: number;
      windowHours: number;
    };
    expect(latest.assessedSessionCount).toBe(2);
    expect(latest.windowHours).toBe(24);
  });

  it('prints usage when trends args are invalid', async () => {
    const result = await dispatchSlashCommand('/browser trends 24 nope', makeCtx());
    expect(result).toBe('handled');

    const output = logs.join('\n');
    expect(output).toContain('Usage: /browser');
    expect(output).toContain('/browser trends 24 10');
  });
});
