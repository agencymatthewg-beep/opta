import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deriveBrowserReplayVisualDiffPairs,
  readBrowserReplayRecordings,
  readBrowserReplayStepArtifactPreview,
  readBrowserReplaySteps,
  readBrowserReplayVisualDiffManifest,
  readBrowserReplayVisualDiffResults,
  summarizeBrowserReplay,
} from '../../src/browser/replay.js';
import {
  appendBrowserVisualDiffResultEntry,
  browserSessionVisualDiffResultsPath,
  readBrowserVisualDiffResults,
} from '../../src/browser/artifacts.js';
import type {
  BrowserSessionMetadata,
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserVisualDiffManifestEntry,
  BrowserVisualDiffResultEntry,
} from '../../src/browser/types.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

function metadataFixture(sessionId: string, runId?: string): BrowserSessionMetadata {
  return {
    schemaVersion: 1,
    sessionId,
    runId,
    mode: 'isolated',
    status: 'closed',
    runtime: 'unavailable',
    createdAt: '2026-02-23T12:00:00.000Z',
    updatedAt: '2026-02-23T12:00:09.000Z',
    artifacts: [],
    actions: [],
  };
}

describe('browser replay', () => {
  it('prefers steps.jsonl for action counts, failures, and last action timestamp', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-001';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId);
    metadata.actions.push({
      action: {
        id: 'action-000001',
        sessionId,
        type: 'openSession',
        createdAt: '2026-02-23T12:00:00.000Z',
        input: {},
      },
      ok: false,
      error: {
        code: 'PLAYWRIGHT_UNAVAILABLE',
        message: 'Playwright runtime is unavailable.',
      },
      artifactIds: [],
    });
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        actionId: 'action-000001',
        actionType: 'openSession',
        timestamp: '2026-02-23T12:00:01.000Z',
        ok: true,
        artifactIds: [],
        artifactPaths: [],
      },
      {
        sequence: 2,
        sessionId,
        actionId: 'action-000002',
        actionType: 'navigate',
        timestamp: '2026-02-23T12:00:02.000Z',
        ok: false,
        error: {
          code: 'NAVIGATE_FAILED',
          message: 'Navigate failed',
        },
        artifactIds: [],
        artifactPaths: [],
      },
      {
        sequence: 3,
        sessionId,
        actionId: 'action-000003',
        actionType: 'closeSession',
        timestamp: '2026-02-23T12:00:03.000Z',
        ok: true,
        artifactIds: [],
        artifactPaths: [],
      },
    ];
    await writeFile(
      join(sessionDir, 'steps.jsonl'),
      steps.map((step) => JSON.stringify(step)).join('\n') + '\n',
      'utf-8',
    );

    const summary = await summarizeBrowserReplay(testDir, sessionId);
    expect(summary).not.toBeNull();
    expect(summary?.actionCount).toBe(3);
    expect(summary?.failureCount).toBe(1);
    expect(summary?.lastActionAt).toBe('2026-02-23T12:00:03.000Z');
    expect(summary?.lastUpdatedAt).toBe('2026-02-23T12:00:09.000Z');
    expect(summary?.regressionSignal).toBe('none');
    expect(summary?.regressionPairCount).toBe(0);

    const loadedSteps = await readBrowserReplaySteps(testDir, sessionId);
    expect(loadedSteps).toHaveLength(3);
  });

  it('falls back to metadata actions when steps.jsonl is missing', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-002';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId);
    metadata.actions.push({
      action: {
        id: 'action-000001',
        sessionId,
        type: 'openSession',
        createdAt: '2026-02-23T12:00:01.000Z',
        input: {},
      },
      ok: true,
      artifactIds: [],
    });
    metadata.actions.push({
      action: {
        id: 'action-000002',
        sessionId,
        type: 'closeSession',
        createdAt: '2026-02-23T12:00:04.000Z',
        input: {},
      },
      ok: false,
      error: {
        code: 'CLOSE_FAILED',
        message: 'Close failed',
      },
      artifactIds: [],
    });
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const summary = await summarizeBrowserReplay(testDir, sessionId);
    expect(summary).not.toBeNull();
    expect(summary?.actionCount).toBe(2);
    expect(summary?.failureCount).toBe(1);
    expect(summary?.lastActionAt).toBe('2026-02-23T12:00:04.000Z');
    expect(summary?.regressionSignal).toBe('none');
  });

  it('falls back to recordings.json when steps.jsonl is missing', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-004';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId, 'run-replay-004');
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const recordings: BrowserSessionRecordingIndex = {
      schemaVersion: 1,
      sessionId,
      runId: 'run-replay-004',
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      recordings: [
        {
          sequence: 1,
          sessionId,
          runId: 'run-replay-004',
          actionId: 'action-000001',
          actionType: 'openSession',
          timestamp: '2026-02-23T12:00:01.000Z',
          ok: true,
          artifactIds: [],
          artifactPaths: [],
        },
        {
          sequence: 2,
          sessionId,
          runId: 'run-replay-004',
          actionId: 'action-000002',
          actionType: 'navigate',
          timestamp: '2026-02-23T12:00:05.000Z',
          ok: false,
          error: {
            code: 'NAVIGATE_FAILED',
            message: 'Navigate failed',
          },
          artifactIds: [],
          artifactPaths: [],
        },
      ],
    };
    await writeFile(join(sessionDir, 'recordings.json'), JSON.stringify(recordings, null, 2) + '\n', 'utf-8');

    const summary = await summarizeBrowserReplay(testDir, sessionId);
    expect(summary).not.toBeNull();
    expect(summary?.runId).toBe('run-replay-004');
    expect(summary?.actionCount).toBe(2);
    expect(summary?.failureCount).toBe(1);
    expect(summary?.lastActionAt).toBe('2026-02-23T12:00:05.000Z');
    expect(summary?.regressionSignal).toBe('none');

    const loadedSteps = await readBrowserReplaySteps(testDir, sessionId);
    expect(loadedSteps).toHaveLength(2);
    expect(loadedSteps[0]?.actionType).toBe('openSession');
    expect(loadedSteps[1]?.actionType).toBe('navigate');

    const loadedRecordings = await readBrowserReplayRecordings(testDir, sessionId);
    expect(loadedRecordings).toHaveLength(2);
    expect(loadedRecordings.map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it('falls back to recordings runId when metadata runId is missing', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-009';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId);
    delete (metadata as { runId?: string }).runId;
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const recordings: BrowserSessionRecordingIndex = {
      schemaVersion: 1,
      sessionId,
      runId: 'run-replay-009',
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      recordings: [
        {
          sequence: 1,
          sessionId,
          runId: 'run-replay-009',
          actionId: 'action-000001',
          actionType: 'openSession',
          timestamp: '2026-02-23T12:00:01.000Z',
          ok: true,
          artifactIds: [],
          artifactPaths: [],
        },
      ],
    };
    await writeFile(join(sessionDir, 'recordings.json'), JSON.stringify(recordings, null, 2) + '\n', 'utf-8');

    const summary = await summarizeBrowserReplay(testDir, sessionId);
    expect(summary).not.toBeNull();
    expect(summary?.runId).toBe('run-replay-009');
    expect(summary?.actionCount).toBe(1);
    expect(summary?.lastActionAt).toBe('2026-02-23T12:00:01.000Z');
    expect(summary?.regressionSignal).toBe('none');
  });

  it('ignores a truncated trailing timeline line', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-003';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId);
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const validStep: BrowserSessionStepRecord = {
      sequence: 1,
      sessionId,
      actionId: 'action-000001',
      actionType: 'openSession',
      timestamp: '2026-02-23T12:00:01.000Z',
      ok: true,
      artifactIds: [],
      artifactPaths: [],
    };

    await writeFile(
      join(sessionDir, 'steps.jsonl'),
      `${JSON.stringify(validStep)}\n{"sequence":2`,
      'utf-8',
    );

    const steps = await readBrowserReplaySteps(testDir, sessionId);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.sequence).toBe(1);
  });

  it('tolerates missing recordings and visual diff files for backward compatibility', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-005';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId);
    delete (metadata as { runId?: string }).runId;
    metadata.actions.push({
      action: {
        id: 'action-000001',
        sessionId,
        type: 'openSession',
        createdAt: '2026-02-23T12:00:01.000Z',
        input: {},
      },
      ok: true,
      artifactIds: [],
    });
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const recordings = await readBrowserReplayRecordings(testDir, sessionId);
    expect(recordings).toEqual([]);

    const visualManifest = await readBrowserReplayVisualDiffManifest(testDir, sessionId);
    expect(visualManifest).toEqual([]);

    const visualResults = await readBrowserReplayVisualDiffResults(testDir, sessionId);
    expect(visualResults).toEqual([]);

    const summary = await summarizeBrowserReplay(testDir, sessionId);
    expect(summary).not.toBeNull();
    expect(summary?.runId).toBeUndefined();
    expect(summary?.actionCount).toBe(1);
    expect(summary?.failureCount).toBe(0);
    expect(summary?.lastActionAt).toBe('2026-02-23T12:00:01.000Z');
    expect(summary?.regressionSignal).toBe('none');
  });

  it('builds step artifact preview with html snippet and metadata details', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-007';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const htmlPath = join(sessionDir, '0001-snapshot.html');
    await writeFile(
      htmlPath,
      '<html>\n  <body>\n    <main id="root">Replay HTML preview</main>\n  </body>\n</html>\n',
      'utf-8',
    );

    const metadata = metadataFixture(sessionId);
    metadata.artifacts.push({
      id: 'art-html-1',
      sessionId,
      actionId: 'action-000001',
      kind: 'snapshot',
      createdAt: '2026-02-23T12:00:01.000Z',
      relativePath: join('.opta', 'browser', sessionId, '0001-snapshot.html'),
      absolutePath: htmlPath,
      mimeType: 'text/html',
      sizeBytes: 82,
    });

    const step: BrowserSessionStepRecord = {
      sequence: 1,
      sessionId,
      actionId: 'action-000001',
      actionType: 'snapshot',
      timestamp: '2026-02-23T12:00:01.000Z',
      ok: true,
      artifactIds: ['art-html-1'],
      artifactPaths: [join('.opta', 'browser', sessionId, '0001-snapshot.html')],
    };

    const preview = await readBrowserReplayStepArtifactPreview(testDir, sessionId, step, metadata);
    expect(preview.sequence).toBe(1);
    expect(preview.artifacts).toHaveLength(1);
    expect(preview.artifacts[0]?.path).toContain('0001-snapshot.html');
    expect(preview.artifacts[0]?.mimeType).toBe('text/html');
    expect(preview.artifacts[0]?.sizeBytes).toBe(82);
    expect(preview.artifacts[0]?.htmlSnippet).toContain('Replay HTML preview');
    expect(preview.artifacts[0]?.textSnippet).toContain('Replay HTML preview');
    expect(preview.artifacts[0]?.inlinePreview).toBeUndefined();
  });

  it('builds inline screenshot preview and png dimensions for image artifacts', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-013';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const pngPath = join(sessionDir, '0001-screenshot.png');
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03,
      0x08, 0x06, 0x00, 0x00, 0x00, 0xf4, 0x78, 0xd4,
    ]);
    await writeFile(pngPath, pngBytes);

    const metadata = metadataFixture(sessionId);
    metadata.artifacts.push({
      id: 'art-shot-inline-1',
      sessionId,
      actionId: 'action-inline-1',
      kind: 'screenshot',
      createdAt: '2026-02-23T12:00:01.000Z',
      relativePath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
      absolutePath: pngPath,
      mimeType: 'image/png',
      sizeBytes: pngBytes.length,
    });

    const step: BrowserSessionStepRecord = {
      sequence: 1,
      sessionId,
      actionId: 'action-inline-1',
      actionType: 'screenshot',
      timestamp: '2026-02-23T12:00:01.000Z',
      ok: true,
      artifactIds: ['art-shot-inline-1'],
      artifactPaths: [join('.opta', 'browser', sessionId, '0001-screenshot.png')],
    };

    const preview = await readBrowserReplayStepArtifactPreview(testDir, sessionId, step, metadata);
    expect(preview.artifacts).toHaveLength(1);
    expect(preview.artifacts[0]?.imageWidth).toBe(2);
    expect(preview.artifacts[0]?.imageHeight).toBe(3);
    expect(preview.artifacts[0]?.inlinePreview?.length).toBeGreaterThan(0);
    expect(preview.artifacts[0]?.textSnippet).toBeUndefined();
  });

  it('derives deterministic visual diff statuses from screenshot byte equality', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-008';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const screenshot1 = join(sessionDir, '0001-screenshot.png');
    const screenshot2 = join(sessionDir, '0002-screenshot.png');
    const screenshot3 = join(sessionDir, '0003-screenshot.png');
    await writeFile(screenshot1, 'same-bytes', 'utf-8');
    await writeFile(screenshot2, 'same-bytes', 'utf-8');
    await writeFile(screenshot3, 'different-bytes', 'utf-8');

    const metadata = metadataFixture(sessionId);
    metadata.artifacts.push(
      {
        id: 'art-shot-1',
        sessionId,
        actionId: 'action-000001',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:01.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
        absolutePath: screenshot1,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
      {
        id: 'art-shot-2',
        sessionId,
        actionId: 'action-000002',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:02.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
        absolutePath: screenshot2,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
      {
        id: 'art-shot-3',
        sessionId,
        actionId: 'action-000003',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:03.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0003-screenshot.png'),
        absolutePath: screenshot3,
        mimeType: 'image/png',
        sizeBytes: 15,
      },
    );

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        actionId: 'action-000001',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:01.000Z',
        ok: true,
        artifactIds: ['art-shot-1'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0001-screenshot.png')],
      },
      {
        sequence: 2,
        sessionId,
        actionId: 'action-000002',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:02.000Z',
        ok: true,
        artifactIds: ['art-shot-2'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0002-screenshot.png')],
      },
      {
        sequence: 3,
        sessionId,
        actionId: 'action-000003',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:03.000Z',
        ok: true,
        artifactIds: ['art-shot-3'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0003-screenshot.png')],
      },
      {
        sequence: 4,
        sessionId,
        actionId: 'action-000004',
        actionType: 'click',
        timestamp: '2026-02-23T12:00:04.000Z',
        ok: true,
        artifactIds: [],
        artifactPaths: [],
      },
    ];

    const diffs = await deriveBrowserReplayVisualDiffPairs(testDir, sessionId, steps, metadata);
    expect(diffs).toHaveLength(3);
    expect(diffs[0]?.status).toBe('unchanged');
    expect(diffs[0]?.severity).toBe('low');
    expect(diffs[0]?.changedByteRatio).toBe(0);
    expect(diffs[0]?.perceptualDiffScore).toBe(0);
    expect(diffs[0]?.regressionScore).toBe(0);
    expect(diffs[0]?.regressionSignal).toBe('none');
    expect(diffs[1]?.status).toBe('changed');
    expect(diffs[1]?.severity).toBe('high');
    expect(diffs[1]?.changedByteRatio).toBeGreaterThan(0.15);
    expect(diffs[1]?.perceptualDiffScore).toBeGreaterThan(0);
    expect(diffs[1]?.regressionScore).toBeGreaterThanOrEqual(0.75);
    expect(diffs[1]?.regressionSignal).toBe('regression');
    expect(diffs[2]?.status).toBe('missing');
    expect(diffs[2]?.severity).toBe('high');
    expect(diffs[2]?.changedByteRatio).toBeUndefined();
    expect(diffs[2]?.perceptualDiffScore).toBeUndefined();
    expect(diffs[2]?.regressionScore).toBe(1);
    expect(diffs[2]?.regressionSignal).toBe('regression');
    expect(diffs[0]?.fromScreenshotPath).toContain('0001-screenshot.png');
    expect(diffs[0]?.toScreenshotPath).toContain('0002-screenshot.png');
  });

  it('summarizes replay regression signal from derived visual diff results', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-014';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const screenshot1 = join(sessionDir, '0001-screenshot.png');
    const screenshot2 = join(sessionDir, '0002-screenshot.png');
    await writeFile(screenshot1, 'AAAAAAAAAA', 'utf-8');
    await writeFile(screenshot2, 'BBBBBBBBBB', 'utf-8');

    const metadata = metadataFixture(sessionId, 'run-replay-014');
    metadata.artifacts.push(
      {
        id: 'art-shot-1',
        sessionId,
        actionId: 'action-000001',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:01.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
        absolutePath: screenshot1,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
      {
        id: 'art-shot-2',
        sessionId,
        actionId: 'action-000002',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:02.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
        absolutePath: screenshot2,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
    );
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        runId: 'run-replay-014',
        actionId: 'action-000001',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:01.000Z',
        ok: true,
        artifactIds: ['art-shot-1'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0001-screenshot.png')],
      },
      {
        sequence: 2,
        sessionId,
        runId: 'run-replay-014',
        actionId: 'action-000002',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:02.000Z',
        ok: true,
        artifactIds: ['art-shot-2'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0002-screenshot.png')],
      },
    ];
    await writeFile(
      join(sessionDir, 'steps.jsonl'),
      steps.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf-8',
    );

    const summary = await summarizeBrowserReplay(testDir, sessionId);
    expect(summary).not.toBeNull();
    expect(summary?.regressionSignal).toBe('regression');
    expect(summary?.regressionPairCount).toBe(1);
    expect(summary?.regressionScore).toBeGreaterThanOrEqual(0.7);
  });

  it('prefers persisted visual diff results and falls back to byte comparison when missing', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-010';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const screenshot1 = join(sessionDir, '0001-screenshot.png');
    const screenshot2 = join(sessionDir, '0002-screenshot.png');
    const screenshot3 = join(sessionDir, '0003-screenshot.png');
    await writeFile(screenshot1, 'same-bytes', 'utf-8');
    await writeFile(screenshot2, 'same-bytes', 'utf-8');
    await writeFile(screenshot3, 'different-bytes', 'utf-8');

    const metadata = metadataFixture(sessionId);
    metadata.artifacts.push(
      {
        id: 'art-shot-1',
        sessionId,
        actionId: 'action-000001',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:01.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
        absolutePath: screenshot1,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
      {
        id: 'art-shot-2',
        sessionId,
        actionId: 'action-000002',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:02.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
        absolutePath: screenshot2,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
      {
        id: 'art-shot-3',
        sessionId,
        actionId: 'action-000003',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:03.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0003-screenshot.png'),
        absolutePath: screenshot3,
        mimeType: 'image/png',
        sizeBytes: 15,
      },
    );

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        actionId: 'action-000001',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:01.000Z',
        ok: true,
        artifactIds: ['art-shot-1'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0001-screenshot.png')],
      },
      {
        sequence: 2,
        sessionId,
        actionId: 'action-000002',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:02.000Z',
        ok: true,
        artifactIds: ['art-shot-2'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0002-screenshot.png')],
      },
      {
        sequence: 3,
        sessionId,
        actionId: 'action-000003',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:03.000Z',
        ok: true,
        artifactIds: ['art-shot-3'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0003-screenshot.png')],
      },
      {
        sequence: 4,
        sessionId,
        actionId: 'action-000004',
        actionType: 'click',
        timestamp: '2026-02-23T12:00:04.000Z',
        ok: true,
        artifactIds: [],
        artifactPaths: [],
      },
    ];

    await appendBrowserVisualDiffResultEntry(testDir, {
      schemaVersion: 1,
      sessionId,
      index: 0,
      fromSequence: 1,
      fromActionId: 'action-000001',
      fromActionType: 'screenshot',
      toSequence: 2,
      toActionId: 'action-000002',
      toActionType: 'screenshot',
      fromScreenshotPath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
      toScreenshotPath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
      status: 'changed',
      changedByteRatio: 0.6,
      severity: 'high',
    });

    const diffs = await deriveBrowserReplayVisualDiffPairs(testDir, sessionId, steps, metadata);
    expect(diffs).toHaveLength(3);
    expect(diffs[0]?.status).toBe('changed');
    expect(diffs[0]?.changedByteRatio).toBe(0.6);
    expect(diffs[0]?.severity).toBe('high');
    expect(diffs[0]?.perceptualDiffScore).toBeUndefined();
    expect(diffs[0]?.regressionScore).toBe(0.75);
    expect(diffs[0]?.regressionSignal).toBe('regression');
    expect(diffs[1]?.status).toBe('changed');
    expect(diffs[1]?.severity).toBe('high');
    expect(diffs[1]?.changedByteRatio).toBeGreaterThan(0.15);
    expect(diffs[1]?.perceptualDiffScore).toBeGreaterThan(0);
    expect(diffs[1]?.regressionSignal).toBe('regression');
    expect(diffs[2]?.status).toBe('missing');
    expect(diffs[2]?.severity).toBe('high');
    expect(diffs[2]?.regressionScore).toBe(1);
    expect(diffs[2]?.regressionSignal).toBe('regression');
  });

  it('infers severity for legacy persisted diff entries without ratio metadata', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-012';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const screenshot1 = join(sessionDir, '0001-screenshot.png');
    const screenshot2 = join(sessionDir, '0002-screenshot.png');
    await writeFile(screenshot1, 'same-bytes', 'utf-8');
    await writeFile(screenshot2, 'same-bytes', 'utf-8');

    const metadata = metadataFixture(sessionId);
    metadata.artifacts.push(
      {
        id: 'art-shot-1',
        sessionId,
        actionId: 'action-000001',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:01.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
        absolutePath: screenshot1,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
      {
        id: 'art-shot-2',
        sessionId,
        actionId: 'action-000002',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:02.000Z',
        relativePath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
        absolutePath: screenshot2,
        mimeType: 'image/png',
        sizeBytes: 10,
      },
    );

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        actionId: 'action-000001',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:01.000Z',
        ok: true,
        artifactIds: ['art-shot-1'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0001-screenshot.png')],
      },
      {
        sequence: 2,
        sessionId,
        actionId: 'action-000002',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:02.000Z',
        ok: true,
        artifactIds: ['art-shot-2'],
        artifactPaths: [join('.opta', 'browser', sessionId, '0002-screenshot.png')],
      },
    ];

    await appendBrowserVisualDiffResultEntry(testDir, {
      schemaVersion: 1,
      sessionId,
      index: 0,
      fromSequence: 1,
      fromActionId: 'action-000001',
      fromActionType: 'screenshot',
      toSequence: 2,
      toActionId: 'action-000002',
      toActionType: 'screenshot',
      fromScreenshotPath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
      toScreenshotPath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
      status: 'changed',
    });

    const diffs = await deriveBrowserReplayVisualDiffPairs(testDir, sessionId, steps, metadata);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.status).toBe('changed');
    expect(diffs[0]?.severity).toBe('medium');
    expect(diffs[0]?.changedByteRatio).toBeUndefined();
    expect(diffs[0]?.perceptualDiffScore).toBeUndefined();
    expect(diffs[0]?.regressionScore).toBe(0.5);
    expect(diffs[0]?.regressionSignal).toBe('investigate');
  });

  it('appends and reads visual diff results with truncated trailing-line tolerance', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-011';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const entry: BrowserVisualDiffResultEntry = {
      schemaVersion: 1,
      sessionId,
      index: 0,
      fromSequence: 1,
      fromActionId: 'action-000001',
      fromActionType: 'screenshot',
      toSequence: 2,
      toActionId: 'action-000002',
      toActionType: 'screenshot',
      fromScreenshotPath: join('.opta', 'browser', sessionId, '0001-screenshot.png'),
      toScreenshotPath: join('.opta', 'browser', sessionId, '0002-screenshot.png'),
      status: 'unchanged',
      changedByteRatio: 0,
      perceptualDiffScore: 0,
      severity: 'low',
      regressionScore: 0,
      regressionSignal: 'none',
    };
    const resultsPath = browserSessionVisualDiffResultsPath(testDir, sessionId);
    expect(resultsPath).toBe(join(sessionDir, 'visual-diff-results.jsonl'));

    await appendBrowserVisualDiffResultEntry(testDir, entry);
    const baselineEntries = await readBrowserVisualDiffResults(testDir, sessionId);
    expect(baselineEntries).toHaveLength(1);
    expect(baselineEntries[0]?.status).toBe('unchanged');
    expect(baselineEntries[0]?.changedByteRatio).toBe(0);
    expect(baselineEntries[0]?.perceptualDiffScore).toBe(0);
    expect(baselineEntries[0]?.severity).toBe('low');
    expect(baselineEntries[0]?.regressionScore).toBe(0);
    expect(baselineEntries[0]?.regressionSignal).toBe('none');

    const raw = await readFile(resultsPath, 'utf-8');
    await writeFile(resultsPath, `${raw}{"schemaVersion":1`, 'utf-8');

    const fromArtifacts = await readBrowserVisualDiffResults(testDir, sessionId);
    expect(fromArtifacts).toHaveLength(1);
    expect(fromArtifacts[0]?.fromSequence).toBe(1);

    const fromReplay = await readBrowserReplayVisualDiffResults(testDir, sessionId);
    expect(fromReplay).toHaveLength(1);
    expect(fromReplay[0]?.toSequence).toBe(2);
    expect(fromReplay[0]?.severity).toBe('low');
    expect(fromReplay[0]?.regressionSignal).toBe('none');
  });

  it('ignores a truncated trailing visual diff manifest line', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-replay-'));
    const sessionId = 'sess-replay-006';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata = metadataFixture(sessionId);
    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');

    const validEntry: BrowserVisualDiffManifestEntry = {
      schemaVersion: 1,
      sessionId,
      sequence: 1,
      actionId: 'action-000001',
      actionType: 'openSession',
      timestamp: '2026-02-23T12:00:01.000Z',
      status: 'pending',
      artifactIds: [],
      artifactPaths: [],
    };

    await writeFile(
      join(sessionDir, 'visual-diff-manifest.jsonl'),
      `${JSON.stringify(validEntry)}\n{"schemaVersion":1`,
      'utf-8',
    );

    const entries = await readBrowserReplayVisualDiffManifest(testDir, sessionId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sequence).toBe(1);
    expect(entries[0]?.status).toBe('pending');
  });
});
