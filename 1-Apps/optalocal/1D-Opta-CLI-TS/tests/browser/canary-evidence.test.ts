import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  browserCanaryLatestPath,
  buildBrowserCanaryEvidence,
  readLatestBrowserCanaryEvidence,
  updateBrowserCanaryRollbackDrill,
  writeBrowserCanaryEvidence,
} from '../../src/browser/canary-evidence.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

async function createSessionFixture(cwd: string, sessionId: string, updatedAt: string): Promise<void> {
  const sessionDir = join(cwd, '.opta', 'browser', sessionId);
  await mkdir(sessionDir, { recursive: true });
  const artifactRelativePath = join('.opta', 'browser', sessionId, '0001-screenshot.png');
  const artifactAbsolutePath = join(cwd, artifactRelativePath);
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

describe('browser canary evidence', () => {
  it('builds, writes, and updates canary evidence deterministically', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-canary-'));
    await createSessionFixture(testDir, 'sess-canary-001', '2026-02-23T20:20:00.000Z');

    const evidence = await buildBrowserCanaryEvidence(testDir, {
      windowHours: 24,
      now: () => new Date('2026-02-23T21:00:00.000Z'),
    });

    expect(evidence.assessedSessionCount).toBe(1);
    expect(evidence.passCount).toBe(1);
    expect(evidence.failCount).toBe(0);
    expect(evidence.overallStatus).toBe('pass');
    expect(evidence.rollbackDrill.status).toBe('pending');

    const paths = await writeBrowserCanaryEvidence(testDir, evidence);
    const latestRaw = await readFile(paths.latestPath, 'utf-8');
    expect(latestRaw).toContain('"overallStatus": "pass"');

    const updated = await updateBrowserCanaryRollbackDrill(testDir, {
      status: 'pass',
      notes: 'rollback rehearsal complete',
      now: () => new Date('2026-02-23T21:05:00.000Z'),
    });
    expect(updated?.rollbackDrill.status).toBe('pass');
    expect(updated?.rollbackDrill.notes).toBe('rollback rehearsal complete');
    expect(updated?.rollbackDrill.executedAt).toBe('2026-02-23T21:05:00.000Z');

    const loaded = await readLatestBrowserCanaryEvidence(testDir);
    expect(loaded?.rollbackDrill.status).toBe('pass');
    expect(loaded?.rollbackDrill.notes).toBe('rollback rehearsal complete');
  });

  it('returns null when rollback update is requested before canary capture', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-canary-'));
    const updated = await updateBrowserCanaryRollbackDrill(testDir, {
      status: 'fail',
      notes: 'no evidence',
      now: () => new Date('2026-02-23T21:05:00.000Z'),
    });

    expect(updated).toBeNull();
    expect(await readLatestBrowserCanaryEvidence(testDir)).toBeNull();
    expect(browserCanaryLatestPath(testDir)).toContain('.opta/browser/canary-evidence/latest.json');
  });
});
