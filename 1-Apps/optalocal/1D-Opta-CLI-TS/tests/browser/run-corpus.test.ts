import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  browserRunCorpusLatestPath,
  buildBrowserRunCorpusSummary,
  readLatestBrowserRunCorpusSummary,
  refreshBrowserRunCorpusSummary,
  writeBrowserRunCorpusSummary,
} from '../../src/browser/run-corpus.js';
import type { BrowserSessionMetadata, BrowserSessionStepRecord } from '../../src/browser/types.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

async function createSessionFixture(
  cwd: string,
  input: {
    sessionId: string;
    updatedAt: string;
    withRegression?: boolean;
  },
): Promise<void> {
  const sessionDir = join(cwd, '.opta', 'browser', input.sessionId);
  await mkdir(sessionDir, { recursive: true });

  const metadata: BrowserSessionMetadata = {
    schemaVersion: 1,
    sessionId: input.sessionId,
    runId: `run-${input.sessionId}`,
    mode: 'isolated',
    status: 'closed',
    runtime: 'playwright',
    createdAt: '2026-02-23T20:00:00.000Z',
    updatedAt: input.updatedAt,
    artifacts: [],
    actions: [],
  };

  if (!input.withRegression) {
    metadata.actions.push({
      action: {
        id: 'action-000001',
        sessionId: input.sessionId,
        type: 'openSession',
        createdAt: '2026-02-23T20:00:01.000Z',
        input: {},
      },
      ok: true,
      artifactIds: [],
    });
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
    return;
  }

  const artifactAPath = join(cwd, '.opta', 'browser', input.sessionId, '0001-screenshot.png');
  const artifactBPath = join(cwd, '.opta', 'browser', input.sessionId, '0002-screenshot.png');
  const artifactARel = join('.opta', 'browser', input.sessionId, '0001-screenshot.png');
  const artifactBRel = join('.opta', 'browser', input.sessionId, '0002-screenshot.png');
  await writeFile(artifactAPath, Buffer.from([0x10, 0x20, 0x30, 0x40]));
  await writeFile(artifactBPath, Buffer.from([0x40, 0x30, 0x20, 0x10]));

  metadata.artifacts.push(
    {
      id: 'artifact-0001',
      sessionId: input.sessionId,
      actionId: 'action-000001',
      kind: 'screenshot',
      createdAt: '2026-02-23T20:00:00.100Z',
      relativePath: artifactARel,
      absolutePath: artifactAPath,
      mimeType: 'image/png',
      sizeBytes: 4,
    },
    {
      id: 'artifact-0002',
      sessionId: input.sessionId,
      actionId: 'action-000002',
      kind: 'screenshot',
      createdAt: '2026-02-23T20:00:00.200Z',
      relativePath: artifactBRel,
      absolutePath: artifactBPath,
      mimeType: 'image/png',
      sizeBytes: 4,
    },
  );
  metadata.actions.push(
    {
      action: {
        id: 'action-000001',
        sessionId: input.sessionId,
        type: 'screenshot',
        createdAt: '2026-02-23T20:00:00.100Z',
        input: {},
      },
      ok: true,
      artifactIds: ['artifact-0001'],
    },
    {
      action: {
        id: 'action-000002',
        sessionId: input.sessionId,
        type: 'screenshot',
        createdAt: '2026-02-23T20:00:00.200Z',
        input: {},
      },
      ok: true,
      artifactIds: ['artifact-0002'],
    },
  );

  const steps: BrowserSessionStepRecord[] = [
    {
      sequence: 1,
      sessionId: input.sessionId,
      runId: `run-${input.sessionId}`,
      actionId: 'action-000001',
      actionType: 'screenshot',
      timestamp: '2026-02-23T20:00:00.100Z',
      ok: true,
      artifactIds: ['artifact-0001'],
      artifactPaths: [artifactARel],
    },
    {
      sequence: 2,
      sessionId: input.sessionId,
      runId: `run-${input.sessionId}`,
      actionId: 'action-000002',
      actionType: 'screenshot',
      timestamp: '2026-02-23T20:00:00.200Z',
      ok: true,
      artifactIds: ['artifact-0002'],
      artifactPaths: [artifactBRel],
    },
  ];

  await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
  await writeFile(
    join(sessionDir, 'steps.jsonl'),
    steps.map((step) => JSON.stringify(step)).join('\n') + '\n',
    'utf-8',
  );
}

describe('browser run corpus', () => {
  it('builds deterministic run corpus summary from replay sessions in the window', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-run-corpus-'));

    await createSessionFixture(testDir, {
      sessionId: 'sess-regression-001',
      updatedAt: '2026-02-23T23:00:00.000Z',
      withRegression: true,
    });
    await createSessionFixture(testDir, {
      sessionId: 'sess-clean-001',
      updatedAt: '2026-02-23T22:00:00.000Z',
      withRegression: false,
    });
    await createSessionFixture(testDir, {
      sessionId: 'sess-old-001',
      updatedAt: '2026-02-20T22:00:00.000Z',
      withRegression: false,
    });

    const summary = await buildBrowserRunCorpusSummary(testDir, {
      windowHours: 24,
      now: () => new Date('2026-02-24T00:00:00.000Z'),
    });

    expect(summary.windowHours).toBe(24);
    expect(summary.assessedSessionCount).toBe(2);
    expect(summary.regressionSessionCount).toBe(1);
    expect(summary.maxRegressionScore).toBeGreaterThan(0);
    expect(summary.meanRegressionScore).toBeGreaterThan(0);
    expect(summary.entries).toHaveLength(2);
    expect(summary.entries.map((entry) => entry.sessionId)).toEqual([
      'sess-regression-001',
      'sess-clean-001',
    ]);
  });

  it('writes and reloads run corpus snapshots', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-run-corpus-'));

    const summary = await buildBrowserRunCorpusSummary(testDir, {
      windowHours: 24,
      now: () => new Date('2026-02-24T00:00:00.000Z'),
    });
    const paths = await writeBrowserRunCorpusSummary(testDir, summary);
    const loaded = await readLatestBrowserRunCorpusSummary(testDir);

    expect(paths.latestPath).toBe(browserRunCorpusLatestPath(testDir));
    expect(paths.snapshotPath).toContain('.opta/browser/run-corpus/2026-02-24T00-00-00-000Z.json');
    expect(loaded).not.toBeNull();
    expect(loaded?.generatedAt).toBe('2026-02-24T00:00:00.000Z');
    expect(loaded?.assessedSessionCount).toBe(0);
  });

  it('refreshes run corpus summary deterministically and skips when disabled', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-run-corpus-'));
    await createSessionFixture(testDir, {
      sessionId: 'sess-refresh-001',
      updatedAt: '2026-02-23T23:00:00.000Z',
      withRegression: false,
    });

    const refreshed = await refreshBrowserRunCorpusSummary(testDir, {
      enabled: true,
      windowHours: 24,
      now: () => new Date('2026-02-24T00:00:00.000Z'),
    });
    expect(refreshed).not.toBeNull();
    expect(refreshed?.summary.generatedAt).toBe('2026-02-24T00:00:00.000Z');
    expect(refreshed?.summary.assessedSessionCount).toBe(1);
    expect(refreshed?.latestPath).toBe(browserRunCorpusLatestPath(testDir));
    expect(refreshed?.snapshotPath).toContain('.opta/browser/run-corpus/2026-02-24T00-00-00-000Z.json');

    const skipped = await refreshBrowserRunCorpusSummary(testDir, {
      enabled: false,
      now: () => new Date('2026-02-24T00:05:00.000Z'),
    });
    expect(skipped).toBeNull();
  });
});
