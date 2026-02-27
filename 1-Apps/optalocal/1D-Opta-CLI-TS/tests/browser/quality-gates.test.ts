import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ingestBrowserBenchmarkTelemetry,
  validateBrowserBenchmarkThresholdFeed,
  validateBrowserBenchmarkThresholds,
  validateBrowserSessionArtifactCompleteness,
} from '../../src/browser/quality-gates.js';
import type {
  BrowserSessionMetadata,
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserVisualDiffManifestEntry,
} from '../../src/browser/types.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

async function writeConsistentSessionFixture(cwd: string, sessionId: string): Promise<void> {
  const sessionDir = join(cwd, '.opta', 'browser', sessionId);
  await mkdir(sessionDir, { recursive: true });

  const artifactRelativePath = join('.opta', 'browser', sessionId, '0001-screenshot.png');
  const artifactAbsolutePath = join(cwd, artifactRelativePath);
  await writeFile(artifactAbsolutePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const metadata: BrowserSessionMetadata = {
    schemaVersion: 1,
    sessionId,
    runId: 'run-quality-gate-001',
    mode: 'isolated',
    status: 'closed',
    runtime: 'playwright',
    createdAt: '2026-02-23T12:00:00.000Z',
    updatedAt: '2026-02-23T12:00:02.000Z',
    artifacts: [
      {
        id: 'artifact-0001',
        sessionId,
        actionId: 'action-000002',
        kind: 'screenshot',
        createdAt: '2026-02-23T12:00:02.000Z',
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
          createdAt: '2026-02-23T12:00:00.000Z',
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
          createdAt: '2026-02-23T12:00:02.000Z',
          input: {
            fullPage: true,
          },
        },
        ok: true,
        artifactIds: ['artifact-0001'],
      },
    ],
  };

  const steps: BrowserSessionStepRecord[] = [
    {
      sequence: 1,
      sessionId,
      runId: 'run-quality-gate-001',
      actionId: 'action-000001',
      actionType: 'openSession',
      timestamp: '2026-02-23T12:00:00.000Z',
      ok: true,
      artifactIds: [],
      artifactPaths: [],
    },
    {
      sequence: 2,
      sessionId,
      runId: 'run-quality-gate-001',
      actionId: 'action-000002',
      actionType: 'screenshot',
      timestamp: '2026-02-23T12:00:02.000Z',
      ok: true,
      artifactIds: ['artifact-0001'],
      artifactPaths: [artifactRelativePath],
    },
  ];

  const recordings: BrowserSessionRecordingIndex = {
    schemaVersion: 1,
    sessionId,
    runId: 'run-quality-gate-001',
    createdAt: '2026-02-23T12:00:00.000Z',
    updatedAt: '2026-02-23T12:00:02.000Z',
    recordings: [...steps],
  };

  const visualDiffEntries: BrowserVisualDiffManifestEntry[] = [
    {
      schemaVersion: 1,
      sessionId,
      runId: 'run-quality-gate-001',
      sequence: 1,
      actionId: 'action-000001',
      actionType: 'openSession',
      timestamp: '2026-02-23T12:00:00.000Z',
      status: 'pending',
      artifactIds: [],
      artifactPaths: [],
    },
    {
      schemaVersion: 1,
      sessionId,
      runId: 'run-quality-gate-001',
      sequence: 2,
      actionId: 'action-000002',
      actionType: 'screenshot',
      timestamp: '2026-02-23T12:00:02.000Z',
      status: 'pending',
      artifactIds: ['artifact-0001'],
      artifactPaths: [artifactRelativePath],
    },
  ];

  await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
  await writeFile(
    join(sessionDir, 'steps.jsonl'),
    steps.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
    'utf-8',
  );
  await writeFile(join(sessionDir, 'recordings.json'), JSON.stringify(recordings, null, 2) + '\n', 'utf-8');
  await writeFile(
    join(sessionDir, 'visual-diff-manifest.jsonl'),
    visualDiffEntries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
    'utf-8',
  );
}

async function writeBenchmarkTelemetryFixture(cwd: string, sessionId: string): Promise<void> {
  const sessionDir = join(cwd, '.opta', 'browser', sessionId);
  await mkdir(sessionDir, { recursive: true });

  const metadata: BrowserSessionMetadata = {
    schemaVersion: 1,
    sessionId,
    runId: 'run-benchmark-telemetry-001',
    mode: 'isolated',
    status: 'closed',
    runtime: 'playwright',
    createdAt: '2026-02-23T12:00:00.000Z',
    updatedAt: '2026-02-23T12:00:04.500Z',
    artifacts: [],
    actions: [
      {
        action: {
          id: 'action-000001',
          sessionId,
          type: 'openSession',
          createdAt: '2026-02-23T12:00:00.000Z',
          input: {},
        },
        ok: true,
        artifactIds: [],
      },
      {
        action: {
          id: 'action-000002',
          sessionId,
          type: 'navigate',
          createdAt: '2026-02-23T12:00:01.000Z',
          input: { url: 'https://example.com' },
        },
        ok: true,
        artifactIds: [],
      },
      {
        action: {
          id: 'action-000003',
          sessionId,
          type: 'click',
          createdAt: '2026-02-23T12:00:02.000Z',
          input: { selector: '#broken-button' },
        },
        ok: false,
        artifactIds: [],
      },
      {
        action: {
          id: 'action-000004',
          sessionId,
          type: 'type',
          createdAt: '2026-02-23T12:00:03.000Z',
          input: { selector: '#name', text: 'Opta' },
        },
        ok: false,
        artifactIds: [],
      },
      {
        action: {
          id: 'action-000005',
          sessionId,
          type: 'screenshot',
          createdAt: '2026-02-23T12:00:04.000Z',
          input: { fullPage: true },
        },
        ok: true,
        artifactIds: [],
      },
    ],
  };

  // Intentionally out of sequence on disk to validate deterministic ingestion ordering by sequence.
  const steps: BrowserSessionStepRecord[] = [
    {
      sequence: 2,
      sessionId,
      runId: 'run-benchmark-telemetry-001',
      actionId: 'action-000002',
      actionType: 'navigate',
      timestamp: '2026-02-23T12:00:01.200Z',
      ok: true,
      artifactIds: [],
      artifactPaths: [],
    },
    {
      sequence: 1,
      sessionId,
      runId: 'run-benchmark-telemetry-001',
      actionId: 'action-000001',
      actionType: 'openSession',
      timestamp: '2026-02-23T12:00:00.100Z',
      ok: true,
      artifactIds: [],
      artifactPaths: [],
    },
    {
      sequence: 4,
      sessionId,
      runId: 'run-benchmark-telemetry-001',
      actionId: 'action-000004',
      actionType: 'type',
      timestamp: '2026-02-23T12:00:03.250Z',
      ok: false,
      artifactIds: [],
      artifactPaths: [],
    },
    {
      sequence: 3,
      sessionId,
      runId: 'run-benchmark-telemetry-001',
      actionId: 'action-000003',
      actionType: 'click',
      timestamp: '2026-02-23T12:00:02.300Z',
      ok: false,
      artifactIds: [],
      artifactPaths: [],
    },
    {
      sequence: 5,
      sessionId,
      runId: 'run-benchmark-telemetry-001',
      actionId: 'action-000005',
      actionType: 'screenshot',
      timestamp: '2026-02-23T12:00:04.500Z',
      ok: true,
      artifactIds: [],
      artifactPaths: [],
    },
  ];

  await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
  await writeFile(
    join(sessionDir, 'steps.jsonl'),
    steps.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
    'utf-8',
  );
}

describe('browser quality gates', () => {
  it('passes artifact completeness checks for a consistent browser session fixture', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-quality-gates-'));
    const sessionId = 'sess-quality-gate-001';
    await writeConsistentSessionFixture(testDir, sessionId);

    const result = await validateBrowserSessionArtifactCompleteness(testDir, sessionId);

    expect(result.ok).toBe(true);
    expect(result.missingFiles).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.counts).toEqual({
      metadataActions: 2,
      metadataArtifacts: 1,
      stepEntries: 2,
      recordingEntries: 2,
      visualDiffEntries: 2,
      stepArtifactRefs: 1,
      recordingArtifactRefs: 1,
      visualDiffArtifactRefs: 1,
    });
  });

  it('fails artifact completeness checks when required files, counts, and artifact files mismatch', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-quality-gates-'));
    const sessionId = 'sess-quality-gate-002';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const missingArtifactPath = join('.opta', 'browser', sessionId, '0001-screenshot.png');

    const metadata: BrowserSessionMetadata = {
      schemaVersion: 1,
      sessionId,
      mode: 'isolated',
      status: 'closed',
      runtime: 'playwright',
      createdAt: '2026-02-23T12:00:00.000Z',
      updatedAt: '2026-02-23T12:00:01.000Z',
      artifacts: [
        {
          id: 'artifact-0001',
          sessionId,
          actionId: 'action-000001',
          kind: 'screenshot',
          createdAt: '2026-02-23T12:00:01.000Z',
          relativePath: missingArtifactPath,
          absolutePath: join(testDir, missingArtifactPath),
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
            createdAt: '2026-02-23T12:00:00.000Z',
            input: {},
          },
          ok: true,
          artifactIds: [],
        },
      ],
    };

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        actionId: 'action-000001',
        actionType: 'openSession',
        timestamp: '2026-02-23T12:00:00.000Z',
        ok: true,
        artifactIds: [],
        artifactPaths: [],
      },
      {
        sequence: 2,
        sessionId,
        actionId: 'action-000002',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:01.000Z',
        ok: true,
        artifactIds: ['artifact-0001'],
        artifactPaths: [missingArtifactPath],
      },
    ];

    const visualDiffEntries: BrowserVisualDiffManifestEntry[] = [
      {
        schemaVersion: 1,
        sessionId,
        sequence: 1,
        actionId: 'action-000001',
        actionType: 'openSession',
        timestamp: '2026-02-23T12:00:00.000Z',
        status: 'pending',
        artifactIds: [],
        artifactPaths: [],
      },
      {
        schemaVersion: 1,
        sessionId,
        sequence: 2,
        actionId: 'action-000002',
        actionType: 'screenshot',
        timestamp: '2026-02-23T12:00:01.000Z',
        status: 'pending',
        artifactIds: ['artifact-0001'],
        artifactPaths: [missingArtifactPath],
      },
    ];

    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
    await writeFile(
      join(sessionDir, 'steps.jsonl'),
      steps.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf-8',
    );
    await writeFile(
      join(sessionDir, 'visual-diff-manifest.jsonl'),
      visualDiffEntries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf-8',
    );

    const result = await validateBrowserSessionArtifactCompleteness(testDir, sessionId);

    expect(result.ok).toBe(false);
    expect(result.missingFiles).toContain('recordings.json');
    expect(result.issues.some((issue) => issue.includes('metadata.json action count (1) does not match steps.jsonl count (2).'))).toBe(true);
    expect(result.issues.some((issue) => issue.includes('metadata.json artifact file is missing'))).toBe(true);
  });

  it('passes benchmark thresholds when all metrics are within bounds', () => {
    const result = validateBrowserBenchmarkThresholds(
      {
        successRate: 0.985,
        medianActionLatencyMs: 320,
        recoveryMs: 650,
      },
      {
        minSuccessRate: 0.95,
        maxMedianActionLatencyMs: 400,
        maxRecoveryMs: 700,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails benchmark thresholds when metrics violate bounds', () => {
    const result = validateBrowserBenchmarkThresholds(
      {
        successRate: 0.9,
        medianActionLatencyMs: 900,
        recoveryMs: 1500,
      },
      {
        minSuccessRate: 0.95,
        maxMedianActionLatencyMs: 800,
        maxRecoveryMs: 1200,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      'successRate 0.9 is below minimum 0.95.',
      'medianActionLatencyMs 900 exceeds maximum 800.',
      'recoveryMs 1500 exceeds maximum 1200.',
    ]);
  });

  it('fails benchmark threshold validation when metrics or thresholds are non-finite', () => {
    const result = validateBrowserBenchmarkThresholds(
      {
        successRate: Number.NaN,
        medianActionLatencyMs: Number.POSITIVE_INFINITY,
        recoveryMs: Number.NaN,
      },
      {
        minSuccessRate: Number.NaN,
        maxMedianActionLatencyMs: Number.POSITIVE_INFINITY,
        maxRecoveryMs: Number.NaN,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      'Metric successRate must be a finite number.',
      'Metric medianActionLatencyMs must be a finite number.',
      'Metric recoveryMs must be a finite number.',
      'Threshold minSuccessRate must be a finite number.',
      'Threshold maxMedianActionLatencyMs must be a finite number.',
      'Threshold maxRecoveryMs must be a finite number.',
    ]);
  });

  it('ingests deterministic benchmark telemetry from persisted session artifacts', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-quality-gates-'));
    const sessionId = 'sess-quality-gate-benchmark-001';
    await writeBenchmarkTelemetryFixture(testDir, sessionId);

    const ingestion = await ingestBrowserBenchmarkTelemetry(testDir, sessionId);

    expect(ingestion.ok).toBe(true);
    expect(ingestion.issues).toEqual([]);
    expect(ingestion.actionCount).toBe(5);
    expect(ingestion.successCount).toBe(3);
    expect(ingestion.failureCount).toBe(2);
    expect(ingestion.latencySamplesMs).toEqual([100, 200, 300, 250, 500]);
    expect(ingestion.recoverySamplesMs).toEqual([2200]);
    expect(ingestion.metrics).toEqual({
      successRate: 0.6,
      medianActionLatencyMs: 250,
      recoveryMs: 2200,
    });
  });

  it('flags malformed telemetry while keeping computed benchmark metrics finite', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-quality-gates-'));
    const sessionId = 'sess-quality-gate-benchmark-002';
    const sessionDir = join(testDir, '.opta', 'browser', sessionId);
    await mkdir(sessionDir, { recursive: true });

    const metadata: BrowserSessionMetadata = {
      schemaVersion: 1,
      sessionId,
      mode: 'isolated',
      status: 'closed',
      runtime: 'playwright',
      createdAt: '2026-02-23T12:00:00.000Z',
      updatedAt: '2026-02-23T12:00:02.000Z',
      artifacts: [],
      actions: [
        {
          action: {
            id: 'action-000001',
            sessionId,
            type: 'openSession',
            createdAt: 'not-a-timestamp',
            input: {},
          },
          ok: false,
          artifactIds: [],
        },
        {
          action: {
            id: 'action-000002',
            sessionId,
            type: 'navigate',
            createdAt: '2026-02-23T12:00:01.000Z',
            input: { url: 'https://example.com' },
          },
          ok: true,
          artifactIds: [],
        },
      ],
    };

    const steps: BrowserSessionStepRecord[] = [
      {
        sequence: 1,
        sessionId,
        actionId: 'action-000001',
        actionType: 'openSession',
        timestamp: 'not-a-timestamp',
        ok: false,
        artifactIds: [],
        artifactPaths: [],
      },
      {
        sequence: 2,
        sessionId,
        actionId: 'action-000002',
        actionType: 'navigate',
        timestamp: '2026-02-23T12:00:02.000Z',
        ok: true,
        artifactIds: [],
        artifactPaths: [],
      },
    ];

    await writeFile(join(sessionDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
    await writeFile(
      join(sessionDir, 'steps.jsonl'),
      steps.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf-8',
    );

    const ingestion = await ingestBrowserBenchmarkTelemetry(testDir, sessionId);

    expect(ingestion.ok).toBe(false);
    expect(ingestion.issues.some((issue) => issue.includes('metadata.json action action-000001 has invalid timestamp'))).toBe(true);
    expect(ingestion.issues.some((issue) => issue.includes('steps.jsonl action action-000001 has invalid timestamp'))).toBe(true);
    expect(Number.isFinite(ingestion.metrics.successRate)).toBe(true);
    expect(Number.isFinite(ingestion.metrics.medianActionLatencyMs)).toBe(true);
    expect(Number.isFinite(ingestion.metrics.recoveryMs)).toBe(true);
  });

  it('feeds ingested benchmark telemetry into threshold validation', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-quality-gates-'));
    const sessionId = 'sess-quality-gate-benchmark-003';
    await writeBenchmarkTelemetryFixture(testDir, sessionId);

    const result = await validateBrowserBenchmarkThresholdFeed(
      testDir,
      sessionId,
      {
        minSuccessRate: 0.7,
        maxMedianActionLatencyMs: 260,
        maxRecoveryMs: 2000,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      'successRate 0.6 is below minimum 0.7.',
      'recoveryMs 2200 exceeds maximum 2000.',
    ]);
    expect(result.ingestion.issues).toEqual([]);
    expect(result.metrics).toEqual({
      successRate: 0.6,
      medianActionLatencyMs: 250,
      recoveryMs: 2200,
    });
  });

  it('surfaces telemetry ingestion issues as threshold feed failures', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-quality-gates-'));

    const result = await validateBrowserBenchmarkThresholdFeed(testDir, 'sess-missing-telemetry');

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('successRate 0 is below minimum 0.95.');
    expect(result.failures).toContain('Telemetry ingestion issue: Missing required telemetry file: metadata.json.');
    expect(result.failures).toContain('Telemetry ingestion issue: Missing required telemetry file: steps.jsonl.');
    expect(result.metrics).toEqual({
      successRate: 0,
      medianActionLatencyMs: 0,
      recoveryMs: 0,
    });
  });
});
