import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const loadConfigMock = vi.fn();
const agentLoopMock = vi.fn();
const execaMock = vi.fn();

vi.mock('../../src/core/config.js', () => ({
  loadConfig: loadConfigMock,
}));

vi.mock('../../src/core/agent.js', () => ({
  agentLoop: agentLoopMock,
}));

vi.mock('execa', () => ({
  execa: execaMock,
}));

describe('runCeoBenchmark runtime hardening', () => {
  let originalCwd: string;
  let tempRoot: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let logs: string[];

  beforeEach(async () => {
    vi.resetModules();
    loadConfigMock.mockReset();
    agentLoopMock.mockReset();
    execaMock.mockReset();
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });

    tempRoot = await mkdtemp(join(tmpdir(), 'opta-ceo-bench-runtime-'));
    await mkdir(join(tempRoot, 'docs', 'evidence'), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(tempRoot);

    loadConfigMock.mockResolvedValue({
      model: { default: 'mock-model' },
      provider: { active: 'lmx' },
      autonomy: {
        level: 5,
        mode: 'ceo',
        headlessContinue: false,
        objectiveReassessment: false,
      },
      safety: { circuitBreaker: {} },
    });

    execaMock.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  });

  afterEach(async () => {
    logSpy.mockRestore();
    process.chdir(originalCwd);
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('aborts repeated tool-call loops and keeps benchmark JSON shape stable', async () => {
    agentLoopMock.mockImplementation(
      async (
        _task: string,
        _config: unknown,
        opts?: {
          signal?: AbortSignal;
          onStream?: {
            onToolStart?: (name: string, id: string, args: string) => void;
            onToolEnd?: (name: string, id: string, result: string) => void;
          };
        }
      ) => {
        if (!opts?.onStream?.onToolStart || !opts.onStream.onToolEnd) {
          throw new Error('missing stream callbacks');
        }

        for (let i = 0; i < 5; i += 1) {
          const id = `call-${i}`;
          opts.onStream.onToolStart('run_command', id, '{"command":"node test.js"}');
          opts.onStream.onToolEnd('run_command', id, 'Error: verification failed');

          if (opts.signal?.aborted) {
            const abortErr = new Error('Turn cancelled');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
        }

        return { messages: [], toolCallCount: 5 };
      }
    );

    const { runCeoBenchmark } = await import('../../src/benchmark/ceo/runner.js');
    await runCeoBenchmark({
      filter: 'math-function',
      model: 'mock-model',
      json: true,
      autonomyLevel: 5,
    });

    const output = logs.findLast((line) => line.trim().startsWith('['));
    expect(output).toBeTruthy();
    const parsed = JSON.parse(output as string) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: 'math-function',
      passed: false,
    });
    expect(parsed[0]?.['error']).toContain('Loop control stop');
    expect(Object.keys(parsed[0] ?? {}).sort()).toEqual([
      'durationMs',
      'error',
      'id',
      'passed',
      'turns',
    ]);

    const traceDir = join(tempRoot, 'docs', 'evidence', 'ceo-bench');
    const traceFiles = await readdir(traceDir);
    expect(traceFiles.length).toBe(1);

    const traceJson = JSON.parse(
      await readFile(join(traceDir, traceFiles[0] ?? ''), 'utf8')
    ) as { taskId: string; turns: Array<{ turnIndex: number; taskId: string }> };

    expect(traceJson.taskId).toBe('math-function');
    expect(traceJson.turns.length).toBeGreaterThan(0);
    expect(traceJson.turns[0]).toMatchObject({
      taskId: 'math-function',
      turnIndex: 1,
    });
  });
});
