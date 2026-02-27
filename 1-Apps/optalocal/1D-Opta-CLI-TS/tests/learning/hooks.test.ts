import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { readLedgerEntries } from '../../src/learning/ledger.js';
import {
  calibrationPath,
  captureLearningEvent,
  resolveCaptureLevel,
  resolveGovernorThresholds,
} from '../../src/learning/hooks.js';

describe('learning hooks', () => {
  let testCwd = '';

  beforeEach(async () => {
    testCwd = await mkdtemp(join(tmpdir(), 'opta-learning-hooks-'));
  });

  afterEach(async () => {
    await rm(testCwd, { recursive: true, force: true });
  });

  it('downshifts capture level when pressure exceeds thresholds', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.learning.captureLevel = 'exhaustive';

    const resolved = await resolveCaptureLevel(config, {
      cwd: testCwd,
      sample: {
        cpuPct: 99,
        memoryPct: 99,
        eventLoopLagMs: 500,
        diskWriteKbPerSec: 200_000,
      },
    });

    expect(resolved.captureLevel).toBe('balanced');
    expect(resolved.reason).toContain('Auto-downshifted');
  });

  it('captures sanitized learning events into ledger', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    const now = () => new Date('2026-02-22T18:30:00.000Z');

    const result = await captureLearningEvent(
      config,
      {
        kind: 'problem',
        topic: 'Provider key leak apiKey=abcd1234',
        content: 'Observed bad credential sk-this-should-not-persist in logs.',
        tags: ['Security', '  security ', 'ops'],
        evidence: [{ label: 'run', uri: 'file://logs/run.txt' }],
      },
      { cwd: testCwd, now },
    );

    expect(result.captured).toBe(true);
    const entries = await readLedgerEntries({ cwd: testCwd });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('problem');
    expect(entries[0]?.tags).toEqual(['security', 'ops']);
    expect(entries[0]?.topic).toContain('[REDACTED]');
    expect(entries[0]?.content).toContain('[REDACTED]');
  });

  it('writes and reuses per-device calibration thresholds', async () => {
    const config = structuredClone(DEFAULT_CONFIG);

    const first = await resolveGovernorThresholds(config, { cwd: testCwd });
    const second = await resolveGovernorThresholds(config, { cwd: testCwd });

    expect(first.source).toBe('calibrated');
    expect(second.source).toBe('calibrated');
    expect(second.thresholds).toEqual(first.thresholds);

    const raw = JSON.parse(await readFile(calibrationPath(testCwd), 'utf-8')) as {
      schemaVersion: number;
    };
    expect(raw.schemaVersion).toBe(1);
  });

  it('skips capture when learning is disabled', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.learning.enabled = false;

    const result = await captureLearningEvent(
      config,
      {
        kind: 'reflection',
        topic: 'Skipped event',
        content: 'should not persist',
      },
      { cwd: testCwd },
    );

    expect(result.captured).toBe(false);
    const entries = await readLedgerEntries({ cwd: testCwd });
    expect(entries).toHaveLength(0);
  });
});
