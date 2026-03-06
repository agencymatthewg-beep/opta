import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildCeoBenchmarkPrompt,
  CeoBenchTraceCollector,
  type CeoBenchTraceArtifact,
  persistCeoBenchTraceArtifact,
  seedBenchmarkWorkspace,
  type CeoBenchTask,
} from '../../src/benchmark/ceo/runner.js';

describe('ceo benchmark runner helpers', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('builds a deterministic execution-focused prompt', () => {
    const task: CeoBenchTask = {
      id: 'math-function',
      description: 'Create math.js with add(a,b)',
      verifyScript: 'node -e "process.exit(0)"',
    };
    const prompt = buildCeoBenchmarkPrompt(task);
    expect(prompt).toContain(task.description);
    expect(prompt).toContain(task.verifyScript);
    expect(prompt).toContain('Do not produce implementation plans');
    expect(prompt).toContain('respond with: VERIFIED');
  });

  it('seeds minimal OPIS docs for ephemeral benchmark workspaces', async () => {
    const task: CeoBenchTask = {
      id: 'seed-docs',
      description: 'Do benchmark work',
      verifyScript: 'echo ok',
    };
    tempDir = await mkdtemp(join(tmpdir(), 'opta-ceo-seed-test-'));

    await seedBenchmarkWorkspace(tempDir, task);

    const appDoc = await readFile(join(tempDir, 'APP.md'), 'utf8');
    const indexDoc = await readFile(join(tempDir, 'INDEX.md'), 'utf8');
    expect(appDoc).toContain(task.id);
    expect(appDoc).toContain(task.description);
    expect(indexDoc).toContain('APP.md');
  });

  it('detects repetitive tool-plan loops and records per-turn errors', () => {
    const collector = new CeoBenchTraceCollector({
      taskId: 'loop-task',
      repeatThreshold: 2,
    });

    collector.onToolStart('run_command', 'call-1', '{"command":"node test.js"}');
    const firstLoopSignal = collector.onToolEnd('run_command', 'call-1', 'Error: test failed');
    expect(firstLoopSignal).toBeNull();

    collector.onToolStart('run_command', 'call-2', '{"command":"node test.js"}');
    const secondLoopSignal = collector.onToolEnd('run_command', 'call-2', 'Error: test failed');
    expect(secondLoopSignal).toMatchObject({
      triggered: true,
      repeatCount: 2,
      turnIndex: 2,
    });

    const turns = collector.getTurns();
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      taskId: 'loop-task',
      turnIndex: 1,
      toolCalls: [{ name: 'run_command' }],
    });
    expect(turns[1]?.errors[0]).toContain('Error: test failed');
  });

  it('persists structured trace artifacts under docs/evidence/ceo-bench', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'opta-ceo-trace-test-'));
    const artifact: CeoBenchTraceArtifact = {
      schemaVersion: 1,
      taskId: 'trace-task',
      sessionId: 'bench-trace-task',
      generatedAt: new Date('2026-03-06T00:00:00.000Z').toISOString(),
      durationMs: 42,
      loopControl: {
        repeatThreshold: 3,
        triggered: false,
      },
      turns: [
        {
          taskId: 'trace-task',
          turnIndex: 1,
          durationMs: 15,
          toolCalls: [{ id: 'call-1', name: 'run_command', durationMs: 15 }],
          errors: [],
        },
      ],
    };

    const tracePath = await persistCeoBenchTraceArtifact(tempDir, artifact);
    expect(tracePath).toContain(join(tempDir, 'docs', 'evidence', 'ceo-bench'));

    const persisted = JSON.parse(await readFile(tracePath, 'utf8')) as CeoBenchTraceArtifact;
    expect(persisted.taskId).toBe('trace-task');
    expect(persisted.turns[0]).toMatchObject({
      taskId: 'trace-task',
      turnIndex: 1,
      durationMs: 15,
    });
  });
});
