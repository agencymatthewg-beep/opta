/**
 * Integration: multi-writer turn ordering and isolation on the same session.
 *
 * Verifies that:
 * - Turns from two writers on the same session execute in FIFO order.
 * - Cancelling Writer A's queued turns does not affect Writer B's queued turns.
 * - Each turn's writerId is preserved in the emitted events.
 * - The queue drains correctly after both writers complete.
 *
 * The agentLoop mock resolves immediately so turns execute synchronously
 * (no real async I/O), making ordering assertions deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V3Envelope } from '../../src/protocol/v3/types.js';

// ---------------------------------------------------------------------------
// Module mocks
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

vi.mock('../../src/lmx/client.js', () => ({
  LmxClient: vi.fn().mockImplementation(() => ({
    models: vi
      .fn()
      .mockResolvedValue({ models: [{ model_id: 'test-model', status: 'loaded' }] }),
  })),
}));

// agentLoop resolves immediately — turns complete without blocking.
vi.mock('../../src/core/agent.js', () => ({
  agentLoop: vi.fn().mockResolvedValue({
    messages: [{ role: 'assistant', content: 'done' }],
    toolCallCount: 0,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
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

describe('multi-writer same session', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore the default fast-resolving agentLoop between tests.
    // vi.clearAllMocks() resets call history but NOT mockImplementation, so any
    // test that installs a hanging mock must be undone here.
    const { agentLoop } = await import('../../src/core/agent.js');
    vi.mocked(agentLoop).mockResolvedValue({
      messages: [{ role: 'assistant', content: 'done' }],
      toolCallCount: 0,
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('two writers enqueueing to same session: turns execute in FIFO order', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-fifo', model: 'test-model' });

    const startOrder: string[] = [];
    manager.subscribe('sess-fifo', (env: V3Envelope) => {
      if (env.event === 'turn.start') {
        const payload = env.payload as { writerId?: string; turnId?: string };
        if (payload.writerId) startOrder.push(payload.writerId);
      }
    });

    // Submit A then B — ingress order must be preserved
    await manager.submitTurn('sess-fifo', {
      clientId: 'c1',
      writerId: 'writer-a',
      content: 'task from A',
      mode: 'chat',
    });
    await manager.submitTurn('sess-fifo', {
      clientId: 'c2',
      writerId: 'writer-b',
      content: 'task from B',
      mode: 'chat',
    });

    // Wait for both turns to emit turn.start
    await waitFor(() => startOrder.length >= 2);

    // FIFO: A was submitted before B, so A must start first
    expect(startOrder[0]).toBe('writer-a');
    expect(startOrder[1]).toBe('writer-b');
  });

  it("cancelling Writer A's turns does not cancel Writer B's turns", async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');

    // Use a hanging agentLoop so we can control when turns complete
    const { agentLoop } = await import('../../src/core/agent.js');
    let releaseActive: (() => void) | null = null;
    vi.mocked(agentLoop).mockImplementation(
      async (_task: string, _config: unknown, opts?: { signal?: AbortSignal }) => {
        await new Promise<void>((resolve, reject) => {
          releaseActive = resolve;
          opts?.signal?.addEventListener('abort', () => {
            const err = new Error('cancelled');
            err.name = 'AbortError';
            reject(err);
          });
        });
        return { messages: [], toolCallCount: 0 };
      }
    );

    const manager = new SessionManager('daemon-test', async () => makeConfig());
    await manager.createSession({ sessionId: 'sess-isolation', model: 'test-model' });

    // First turn (writer-a) occupies the active slot and hangs
    const { turnId: _turnA } = await manager.submitTurn('sess-isolation', {
      clientId: 'c1',
      writerId: 'writer-a',
      content: 'active from A',
      mode: 'chat',
    });
    // Give the event loop a tick so processSessionQueue picks up the turn
    await new Promise((r) => setTimeout(r, 20));

    // Enqueue B's turn — it waits in the queue
    const { turnId: turnB } = await manager.submitTurn('sess-isolation', {
      clientId: 'c2',
      writerId: 'writer-b',
      content: 'queued from B',
      mode: 'chat',
    });

    // Cancel only writer-a's turns
    const cancelled = await manager.cancelSessionTurns('sess-isolation', {
      writerId: 'writer-a',
    });

    // writer-a's active turn should be aborted; writer-b's queued turn is intact
    expect(cancelled.cancelledActive).toBe(true);
    expect(cancelled.cancelledQueued).toBe(0); // writer-a has no queued turns (only active)

    // writer-b's turnId must still be in the queue
    const stats = manager.getRuntimeStats();
    expect(stats.queuedTurnCount).toBe(1);

    // Verify by submitting a cancel that targets the non-existent writer-b active
    // but queued count is 1 meaning turnB is safe.
    void turnB; // used above in assertion

    // Clean up
    releaseActive?.(); // this may or may not work depending on abort, but avoids process hang
    await manager.cancelSessionTurns('sess-isolation', { writerId: 'writer-b' });
  });

  it("each turn's writerId is preserved in emitted events", async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-writerid', model: 'test-model' });

    const queuedEvents: Array<{ writerId: string }> = [];
    manager.subscribe('sess-writerid', (env: V3Envelope) => {
      if (env.event === 'turn.queued') {
        const payload = env.payload as { writerId: string };
        queuedEvents.push({ writerId: payload.writerId });
      }
    });

    await manager.submitTurn('sess-writerid', {
      clientId: 'c1',
      writerId: 'writer-alpha',
      content: 'alpha task',
      mode: 'chat',
    });
    await manager.submitTurn('sess-writerid', {
      clientId: 'c2',
      writerId: 'writer-beta',
      content: 'beta task',
      mode: 'chat',
    });

    await waitFor(() => queuedEvents.length >= 2);

    const writerIds = queuedEvents.map((e) => e.writerId);
    expect(writerIds).toContain('writer-alpha');
    expect(writerIds).toContain('writer-beta');
  });

  it('queue drains correctly after both writers complete', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');
    const manager = new SessionManager('daemon-test', async () => makeConfig());

    await manager.createSession({ sessionId: 'sess-drain', model: 'test-model' });

    // Subscribe BEFORE submitting turns to avoid missing fast-resolving events.
    const doneEvents: Array<{ writerId: string }> = [];
    manager.subscribe('sess-drain', (env: V3Envelope) => {
      if (env.event === 'turn.done') {
        const payload = env.payload as { writerId: string };
        doneEvents.push({ writerId: payload.writerId });
      }
    });

    await manager.submitTurn('sess-drain', {
      clientId: 'c1',
      writerId: 'writer-a',
      content: 'task from A',
      mode: 'chat',
    });
    await manager.submitTurn('sess-drain', {
      clientId: 'c2',
      writerId: 'writer-b',
      content: 'task from B',
      mode: 'chat',
    });

    // Wait for both turns to complete (agentLoop mock resolves immediately so
    // both should finish within a few event-loop ticks).
    await waitFor(() => doneEvents.length >= 2, 3_000);

    // Queue must be empty and no active turn
    const stats = manager.getRuntimeStats();
    expect(stats.queuedTurnCount).toBe(0);
    expect(stats.activeTurnCount).toBe(0);

    // Both writers completed
    const completedWriters = doneEvents.map((e) => e.writerId);
    expect(completedWriters).toContain('writer-a');
    expect(completedWriters).toContain('writer-b');
  });
});
