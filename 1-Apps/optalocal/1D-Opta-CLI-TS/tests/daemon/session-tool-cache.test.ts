/**
 * Tests for the SessionManager tool-result cache (runToolWithCache).
 *
 * Strategy: mock agentLoop to capture the `toolExecutor` function that
 * SessionManager passes in. After the turn completes we invoke the captured
 * executor directly to observe hit/miss behaviour without needing to trigger
 * another full agent loop iteration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OptaConfig } from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Captured state — set by the agentLoop mock
// ---------------------------------------------------------------------------

type ToolExecutor = (name: string, argsJson: string, signal?: AbortSignal) => Promise<string>;

let capturedToolExecutor: ToolExecutor | null = null;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const runToolMock = vi.fn().mockResolvedValue('file-contents');

vi.mock('../../src/daemon/worker-pool.js', () => ({
  ToolWorkerPool: vi.fn().mockImplementation(() => ({
    runTool: runToolMock,
    getStats: vi.fn().mockReturnValue({ workers: 0, busy: 0, queued: 0 }),
    warmUp: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../../src/daemon/session-store.js', () => ({
  listStoredSessions: vi.fn().mockResolvedValue([]),
  readSessionSnapshot: vi.fn().mockResolvedValue(null),
  writeSessionSnapshot: vi.fn().mockResolvedValue(undefined),
  appendSessionEvent: vi.fn().mockResolvedValue(undefined),
  readSessionEventsAfter: vi.fn().mockResolvedValue([]),
  hasSessionStore: vi.fn().mockResolvedValue(false),
  ensureDaemonStore: vi.fn().mockResolvedValue(undefined),
  ensureSessionStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/daemon/background-manager.js', () => ({
  BackgroundManager: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue(() => {}),
    list: vi.fn().mockResolvedValue([]),
    start: vi.fn().mockResolvedValue({ processId: 'p-1', state: 'running' }),
    status: vi.fn().mockReturnValue(null),
    output: vi.fn().mockReturnValue(null),
    kill: vi.fn().mockResolvedValue(null),
    close: vi.fn(),
    updateOptions: vi.fn(),
  })),
}));

vi.mock('../../src/daemon/telemetry.js', () => ({
  logDaemonEvent: vi.fn().mockResolvedValue(undefined),
}));

// agentLoop mock: capture the toolExecutor and return a completed turn result
vi.mock('../../src/core/agent.js', () => ({
  agentLoop: vi.fn().mockImplementation(
    async (
      _content: unknown,
      _config: unknown,
      opts: { toolExecutor?: ToolExecutor }
    ) => {
      if (opts?.toolExecutor) {
        capturedToolExecutor = opts.toolExecutor;
      }
      return {
        messages: [{ role: 'assistant', content: 'done' }],
        toolCallCount: 0,
      };
    }
  ),
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: vi.fn().mockImplementation(() => ({
    models: vi.fn().mockResolvedValue({ models: [{ model_id: 'test-model' }] }),
  })),
}));

vi.mock('../../src/lmx/model-lifecycle.js', () => ({
  findMatchingModelId: vi.fn().mockReturnValue('test-model'),
  normalizeConfiguredModelId: vi.fn().mockReturnValue('test-model'),
}));

// statSync is used by runToolWithCache for mtime-based cache validation on
// read_file / list_dir. Return a stable mtime so mtime checks always pass.
vi.mock('node:fs', () => ({
  statSync: vi.fn().mockReturnValue({ mtimeMs: 1_000_000 }),
}));

vi.mock('../../src/utils/errors.js', () => ({
  errorMessage: vi.fn().mockImplementation((err: unknown) =>
    err instanceof Error ? err.message : String(err)
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubConfig(): OptaConfig {
  return {
    connection: { host: '127.0.0.1', fallbackHosts: [], port: 1234, adminKey: undefined },
    model: { default: 'test-model', contextLimit: 32_000 },
    provider: { active: 'lmx' },
    permissions: {},
    autonomy: { level: 0, headlessContinue: false },
    background: {
      maxConcurrent: 5,
      defaultTimeout: 300_000,
      maxBufferSize: 1_048_576,
      killOnSessionEnd: true,
    },
  } as unknown as OptaConfig;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for condition');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionManager tool-result cache', () => {
  let manager: InstanceType<typeof import('../../src/daemon/session-manager.js').SessionManager>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedToolExecutor = null;
    runToolMock.mockResolvedValue('file-contents');

    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    manager = new SessionManager('test-daemon', async () => stubConfig());
  });

  afterEach(async () => {
    await manager.close();
  });

  // -------------------------------------------------------------------------
  // Test 1: read_file called twice with same args → worker called only once
  // -------------------------------------------------------------------------

  it('serves read_file from cache on second call with same args', async () => {
    const SESSION_ID = 'sess-cache-hit';
    await manager.createSession({ sessionId: SESSION_ID, model: 'test-model' });

    const emitted: string[] = [];
    const unsubscribe = manager.subscribe(SESSION_ID, (env) => {
      emitted.push(env.event);
    });

    // Trigger the turn — agentLoop mock will capture toolExecutor
    await manager.submitTurn(SESSION_ID, {
      clientId: 'c1',
      writerId: 'w1',
      content: 'read a file',
      mode: 'chat',
    });

    await waitFor(() => emitted.includes('turn.done'));
    unsubscribe();

    expect(capturedToolExecutor).not.toBeNull();

    // Call the executor twice with identical args
    const argsJson = JSON.stringify({ path: '/tmp/test-file.txt' });
    const result1 = await capturedToolExecutor!('read_file', argsJson);
    const result2 = await capturedToolExecutor!('read_file', argsJson);

    expect(result1).toBe('file-contents');
    expect(result2).toBe('file-contents');

    // runTool must have been called exactly once despite two invocations
    expect(runToolMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Test 2: write_file clears cache → subsequent read_file calls worker again
  // -------------------------------------------------------------------------

  it('clears cache after write_file so subsequent read_file re-executes', async () => {
    const SESSION_ID = 'sess-cache-clear';
    await manager.createSession({ sessionId: SESSION_ID, model: 'test-model' });

    const emitted: string[] = [];
    const unsubscribe = manager.subscribe(SESSION_ID, (env) => {
      emitted.push(env.event);
    });

    await manager.submitTurn(SESSION_ID, {
      clientId: 'c1',
      writerId: 'w1',
      content: 'do some work',
      mode: 'chat',
    });

    await waitFor(() => emitted.includes('turn.done'));
    unsubscribe();

    expect(capturedToolExecutor).not.toBeNull();

    // Step 1: warm the cache with a read_file call
    const readArgs = JSON.stringify({ path: '/tmp/important.ts' });
    runToolMock.mockResolvedValue('original-file-contents');
    await capturedToolExecutor!('read_file', readArgs);

    expect(runToolMock).toHaveBeenCalledTimes(1);

    // Step 2: perform a write_file — this should clear the entire session cache
    runToolMock.mockResolvedValue('write-ok');
    await capturedToolExecutor!('write_file', JSON.stringify({ path: '/tmp/important.ts', content: 'new content' }));

    expect(runToolMock).toHaveBeenCalledTimes(2);

    // Step 3: read the same file again — cache was cleared, so worker must be called again
    runToolMock.mockResolvedValue('new-file-contents');
    const result = await capturedToolExecutor!('read_file', readArgs);

    expect(result).toBe('new-file-contents');
    expect(runToolMock).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // Test 3: non-cacheable tool (e.g. run_command) bypasses the cache entirely
  // -------------------------------------------------------------------------

  it('does not cache results for non-CACHEABLE_TOOLS', async () => {
    const SESSION_ID = 'sess-no-cache';
    await manager.createSession({ sessionId: SESSION_ID, model: 'test-model' });

    const emitted: string[] = [];
    const unsubscribe = manager.subscribe(SESSION_ID, (env) => {
      emitted.push(env.event);
    });

    await manager.submitTurn(SESSION_ID, {
      clientId: 'c1',
      writerId: 'w1',
      content: 'run something',
      mode: 'chat',
    });

    await waitFor(() => emitted.includes('turn.done'));
    unsubscribe();

    expect(capturedToolExecutor).not.toBeNull();

    const argsJson = JSON.stringify({ command: 'echo hello' });
    runToolMock.mockResolvedValue('hello');
    await capturedToolExecutor!('run_command', argsJson);
    await capturedToolExecutor!('run_command', argsJson);

    // run_command is not cacheable — worker must be invoked both times
    expect(runToolMock).toHaveBeenCalledTimes(2);
  });
});
