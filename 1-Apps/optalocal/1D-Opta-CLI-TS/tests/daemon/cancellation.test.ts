/**
 * Unit tests for cancelSessionTurns backpressure logic.
 *
 * Uses full module mocks for I/O boundaries (session-store, agent, lmx client,
 * worker-pool, background-manager, telemetry) so every test runs in-process with
 * no real async I/O.  The SessionManager is instantiated directly so we exercise
 * the real cancelSessionTurns / queue / AbortController wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V3Envelope } from '../../src/protocol/v3/types.js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that bring in the SUT
// ---------------------------------------------------------------------------

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

vi.mock('../../src/daemon/worker-pool.js', () => ({
  ToolWorkerPool: vi.fn().mockImplementation(() => ({
    runTool: vi.fn().mockResolvedValue('ok'),
    getStats: vi.fn().mockReturnValue({ workers: 0, busy: 0, queued: 0 }),
    close: vi.fn().mockResolvedValue(undefined),
    warmUp: vi.fn(),
  })),
}));

vi.mock('../../src/daemon/background-manager.js', () => ({
  BackgroundManager: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue(() => {}),
    list: vi.fn().mockResolvedValue([]),
    start: vi.fn().mockResolvedValue({ processId: 'p-1', state: 'running' }),
    status: vi.fn().mockReturnValue(null),
    output: vi.fn().mockReturnValue(null),
    kill: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    updateOptions: vi.fn(),
  })),
}));

vi.mock('../../src/daemon/telemetry.js', () => ({
  logDaemonEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lmx/model-lifecycle.js', () => ({
  findMatchingModelId: vi.fn().mockReturnValue('test-model'),
  normalizeConfiguredModelId: vi.fn().mockReturnValue('test-model'),
}));

vi.mock('../../src/utils/errors.js', () => ({
  errorMessage: vi.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

// agentLoop mock — hangs until the AbortSignal fires so we can test active-turn
// cancellation without timing races.
let capturedSignals: AbortSignal[] = [];
vi.mock('../../src/core/agent.js', () => ({
  agentLoop: vi.fn(
    async (_task: string, _config: unknown, options?: { signal?: AbortSignal }) => {
      const signal = options?.signal;
      if (signal) capturedSignals.push(signal);
      await new Promise<void>((_resolve, reject) => {
        if (signal?.aborted) {
          const err = new Error('cancelled');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        signal?.addEventListener(
          'abort',
          () => {
            const err = new Error('cancelled');
            err.name = 'AbortError';
            reject(err);
          },
          { once: true }
        );
        // Never resolves on its own — tests must cancel or we hang, which is fine
        // because each test that needs a hanging turn cancels it.
      });
      return { messages: [], toolCallCount: 0 };
    }
  ),
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: vi.fn().mockImplementation(() => ({
    models: vi
      .fn()
      .mockResolvedValue({ models: [{ model_id: 'test-model', status: 'loaded' }] }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('Timed out waiting for condition');
}

function makeConfig() {
  return {
    connection: { host: '127.0.0.1', fallbackHosts: [], port: 1234, adminKey: undefined },
    model: { default: 'test-model', contextLimit: 32_000 },
    provider: { active: 'lmx' as const },
    permissions: {
      read_file: 'allow' as const,
      list_dir: 'allow' as const,
      search_files: 'allow' as const,
      find_files: 'allow' as const,
      write_file: 'ask' as const,
      edit_file: 'ask' as const,
      run_command: 'ask' as const,
      ask_user: 'allow' as const,
    },
    autonomy: { level: 0, remember: false },
    tui: { theme: 'dark' as const, compactMode: false },
    browser: {
      mcp: { enabled: false },
      policy: {
        allowedDomains: [],
        blockedDomains: [],
        maxTabsOpen: 5,
        screenshotOnAction: false,
        riskThreshold: 'medium' as const,
      },
    },
    mcpServers: {},
    lsp: { enabled: false, servers: [] },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cancelSessionTurns', () => {
  beforeEach(() => {
    capturedSignals = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('cancel a queued turn returns { cancelledQueued: 1, cancelledActive: false }', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-queue', model: 'test-model' });

    // Block the queue from draining by stalling agentLoop before we enqueue
    // the turn we want to cancel: we need the target turn to remain queued.
    // Since agentLoop hangs, the first submitTurn occupies the active slot,
    // and the second is left in the queue.
    await manager.submitTurn('sess-queue', {
      clientId: 'c1',
      writerId: 'w1',
      content: 'first — keeps queue busy',
      mode: 'chat',
    });
    await waitFor(() => capturedSignals.length > 0); // active turn has started

    const { turnId } = await manager.submitTurn('sess-queue', {
      clientId: 'c1',
      writerId: 'w1',
      content: 'second — this stays queued',
      mode: 'chat',
    });

    const result = await manager.cancelSessionTurns('sess-queue', { turnId });

    expect(result.cancelledQueued).toBe(1);
    expect(result.cancelledActive).toBe(false);

    // Clean up the active turn so the test exits
    await manager.cancelSessionTurns('sess-queue', { writerId: 'w1' });
  });

  it('cancel an active turn calls abort and returns { cancelledQueued: 0, cancelledActive: true }', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-active', model: 'test-model' });
    await manager.submitTurn('sess-active', {
      clientId: 'c1',
      writerId: 'writer-active',
      content: 'run forever',
      mode: 'chat',
    });

    // Wait until agentLoop receives the signal (turn is active)
    await waitFor(() => capturedSignals.length > 0);
    const signal = capturedSignals[capturedSignals.length - 1]!;
    expect(signal.aborted).toBe(false);

    const result = await manager.cancelSessionTurns('sess-active', {
      writerId: 'writer-active',
    });

    expect(result.cancelledQueued).toBe(0);
    expect(result.cancelledActive).toBe(true);
    expect(signal.aborted).toBe(true);
  });

  it('cancel with nonexistent sessionId returns { cancelledQueued: 0, cancelledActive: false }', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    const result = await manager.cancelSessionTurns('no-such-session', {
      writerId: 'w1',
    });

    expect(result.cancelledQueued).toBe(0);
    expect(result.cancelledActive).toBe(false);
  });

  it('cancel by turnId only cancels that specific turn, not others', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-specific', model: 'test-model' });

    // First turn occupies active slot
    await manager.submitTurn('sess-specific', {
      clientId: 'c1',
      writerId: 'w1',
      content: 'active',
      mode: 'chat',
    });
    await waitFor(() => capturedSignals.length > 0);

    // Enqueue two more turns
    const { turnId: targetTurnId } = await manager.submitTurn('sess-specific', {
      clientId: 'c1',
      writerId: 'w1',
      content: 'target — should be cancelled',
      mode: 'chat',
    });
    await manager.submitTurn('sess-specific', {
      clientId: 'c1',
      writerId: 'w2',
      content: 'bystander — must survive',
      mode: 'chat',
    });

    const result = await manager.cancelSessionTurns('sess-specific', {
      turnId: targetTurnId,
    });

    expect(result.cancelledQueued).toBe(1);
    expect(result.cancelledActive).toBe(false);

    // Inspect runtime stats: one queued turn (the bystander) should remain
    const stats = manager.getRuntimeStats();
    expect(stats.queuedTurnCount).toBe(1);

    // Cleanup
    await manager.cancelSessionTurns('sess-specific', { writerId: 'w1' });
    await manager.cancelSessionTurns('sess-specific', { writerId: 'w2' });
  });

  it('cancel by writerId cancels all queued turns for that writer', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-writer', model: 'test-model' });

    // Occupy the active slot so subsequent enqueues stay queued
    await manager.submitTurn('sess-writer', {
      clientId: 'c1',
      writerId: 'other-writer',
      content: 'active',
      mode: 'chat',
    });
    await waitFor(() => capturedSignals.length > 0);

    // Enqueue 3 turns for the target writer
    for (let i = 0; i < 3; i++) {
      await manager.submitTurn('sess-writer', {
        clientId: 'c1',
        writerId: 'target-writer',
        content: `task ${i}`,
        mode: 'chat',
      });
    }

    const result = await manager.cancelSessionTurns('sess-writer', {
      writerId: 'target-writer',
    });

    expect(result.cancelledQueued).toBe(3);
    expect(result.cancelledActive).toBe(false);

    // Cleanup
    await manager.cancelSessionTurns('sess-writer', { writerId: 'other-writer' });
  });

  it("after cancel, 'session.cancelled' event is emitted", async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-event', model: 'test-model' });

    const emitted: V3Envelope[] = [];
    manager.subscribe('sess-event', (env) => emitted.push(env));

    // Occupy active slot
    await manager.submitTurn('sess-event', {
      clientId: 'c1',
      writerId: 'w-event',
      content: 'stall',
      mode: 'chat',
    });
    await waitFor(() => capturedSignals.length > 0);

    // Enqueue a queued turn to cancel
    await manager.submitTurn('sess-event', {
      clientId: 'c1',
      writerId: 'w-event',
      content: 'queued',
      mode: 'chat',
    });

    emitted.length = 0; // clear noise from submitTurn
    await manager.cancelSessionTurns('sess-event', { writerId: 'w-event' });

    await waitFor(() => emitted.some((e) => e.event === 'session.cancelled'));

    const cancelledEvent = emitted.find((e) => e.event === 'session.cancelled');
    expect(cancelledEvent).toBeDefined();
    expect(cancelledEvent?.payload).toMatchObject({ writerId: 'w-event' });
  });
});
