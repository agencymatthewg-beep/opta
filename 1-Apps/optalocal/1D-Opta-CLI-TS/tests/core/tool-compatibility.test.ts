import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildToolCompatibilityInstruction,
  readToolCompatibilityEntry,
  recordToolCompatibilityEvent,
} from '../../src/core/tool-compatibility.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('tool compatibility telemetry', () => {
  it('records deterministic per-model success/failure counters', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-tool-compat-'));

    await recordToolCompatibilityEvent(testDir, {
      model: 'glm-5-mlx',
      provider: 'lmx',
      status: 'pseudo_failure',
      pseudoTags: ['run_command', 'browser_open'],
      timestamp: '2026-02-24T14:00:00.000Z',
    });
    await recordToolCompatibilityEvent(testDir, {
      model: 'glm-5-mlx',
      provider: 'lmx',
      status: 'success',
      timestamp: '2026-02-24T14:01:00.000Z',
    });

    const entry = await readToolCompatibilityEntry(testDir, {
      model: 'glm-5-mlx',
      provider: 'lmx',
    });

    expect(entry).not.toBeNull();
    expect(entry?.successCount).toBe(1);
    expect(entry?.pseudoFailureCount).toBe(1);
    expect(entry?.lastStatus).toBe('success');
    expect(entry?.lastSeenAt).toBe('2026-02-24T14:01:00.000Z');
    expect(entry?.lastPseudoTags).toEqual([]);
  });

  it('builds a compatibility instruction for failure-prone models', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-tool-compat-'));

    await recordToolCompatibilityEvent(testDir, {
      model: 'glm-5-mlx',
      provider: 'lmx',
      status: 'pseudo_failure',
      pseudoTags: ['run_command'],
      timestamp: '2026-02-24T14:00:00.000Z',
    });

    const entry = await readToolCompatibilityEntry(testDir, {
      model: 'glm-5-mlx',
      provider: 'lmx',
    });
    const instruction = buildToolCompatibilityInstruction(entry);

    expect(instruction).toContain('### Tool-Call Compatibility');
    expect(instruction).toContain('lmx/glm-5-mlx');
    expect(instruction).toContain('pseudo tool markup');
    expect(instruction).toContain('run_command');
  });
});
