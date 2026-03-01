import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../../src/daemon/session-manager.js';
import type { OptaConfig } from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Mocks
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

vi.mock('../../src/core/agent.js', () => ({
  agentLoop: vi.fn().mockResolvedValue({
    messages: [{ role: 'assistant', content: 'done' }],
    toolCallCount: 0,
  }),
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

vi.mock('../../src/utils/errors.js', () => ({
  errorMessage: vi.fn().mockReturnValue('mock error'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubConfig(overrides: Partial<OptaConfig> = {}): OptaConfig {
  return {
    connection: {
      host: '127.0.0.1',
      fallbackHosts: [],
      port: 1234,
      adminKey: undefined,
    },
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
    ...overrides,
  } as unknown as OptaConfig;
}

const DAEMON_ID = 'test-daemon-001';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SessionManager(DAEMON_ID, async () => stubConfig());
  });

  afterEach(async () => {
    await manager.close();
  });

  // -----------------------------------------------------------------------
  // createSession
  // -----------------------------------------------------------------------

  describe('createSession', () => {
    it('creates a new session with a generated ID when none provided', async () => {
      const snapshot = await manager.createSession({});
      expect(snapshot.sessionId).toBeDefined();
      expect(snapshot.sessionId.length).toBeGreaterThan(0);
      expect(snapshot.model).toBe('test-model');
      expect(snapshot.queuedTurns).toBe(0);
      expect(snapshot.toolCallCount).toBe(0);
      expect(snapshot.writerCount).toBe(0);
    });

    it('uses the provided sessionId', async () => {
      const snapshot = await manager.createSession({ sessionId: 'custom-id' });
      expect(snapshot.sessionId).toBe('custom-id');
    });

    it('uses the provided model', async () => {
      const snapshot = await manager.createSession({ model: 'llama-3-8b' });
      expect(snapshot.model).toBe('llama-3-8b');
    });

    it('sets the provided title', async () => {
      const snapshot = await manager.createSession({ title: 'Test Session' });
      expect(snapshot.title).toBe('Test Session');
    });

    it('sets createdAt and updatedAt timestamps', async () => {
      const before = new Date().toISOString();
      const snapshot = await manager.createSession({});
      const after = new Date().toISOString();
      expect(snapshot.createdAt >= before).toBe(true);
      expect(snapshot.updatedAt <= after).toBe(true);
    });

    it('returns existing in-memory session if same ID used', async () => {
      const s1 = await manager.createSession({ sessionId: 'same-id', title: 'First' });
      const s2 = await manager.createSession({ sessionId: 'same-id', title: 'Second' });
      // Should return the existing session, not overwrite it
      expect(s2.title).toBe('First');
    });
  });

  // -----------------------------------------------------------------------
  // getSession
  // -----------------------------------------------------------------------

  describe('getSession', () => {
    it('returns null for a non-existent session', async () => {
      const result = await manager.getSession('nonexistent');
      expect(result).toBeNull();
    });

    it('returns snapshot for an existing session', async () => {
      await manager.createSession({ sessionId: 'my-sess', model: 'llama-3' });
      const snap = await manager.getSession('my-sess');
      expect(snap).not.toBeNull();
      expect(snap!.sessionId).toBe('my-sess');
      expect(snap!.model).toBe('llama-3');
    });
  });

  // -----------------------------------------------------------------------
  // getSessionMessages
  // -----------------------------------------------------------------------

  describe('getSessionMessages', () => {
    it('returns null for non-existent session', async () => {
      const result = await manager.getSessionMessages('nonexistent');
      expect(result).toBeNull();
    });

    it('returns empty messages for a new session', async () => {
      await manager.createSession({ sessionId: 'msg-test' });
      const msgs = await manager.getSessionMessages('msg-test');
      expect(msgs).toEqual([]);
    });

    it('returns initial messages when provided at creation', async () => {
      await manager.createSession({
        sessionId: 'msg-init',
        messages: [{ role: 'user', content: 'hello' }],
      });
      const msgs = await manager.getSessionMessages('msg-init');
      expect(msgs).toHaveLength(1);
      expect(msgs![0]).toEqual({ role: 'user', content: 'hello' });
    });

    it('filters out invalid messages', async () => {
      await manager.createSession({
        sessionId: 'msg-filter',
        messages: [
          { role: 'user', content: 'valid' },
          'not an object' as unknown,
          null as unknown,
          42 as unknown,
          { noRole: true } as unknown,
        ],
      });
      const msgs = await manager.getSessionMessages('msg-filter');
      expect(msgs).toHaveLength(1);
      expect(msgs![0]).toEqual({ role: 'user', content: 'valid' });
    });
  });

  // -----------------------------------------------------------------------
  // submitTurn
  // -----------------------------------------------------------------------

  describe('submitTurn', () => {
    it('throws when session does not exist', async () => {
      await expect(
        manager.submitTurn('nonexistent', {
          clientId: 'c1',
          writerId: 'w1',
          content: 'hello',
          mode: 'chat',
        }),
      ).rejects.toThrow('Session not found: nonexistent');
    });

    it('returns a turnId and queue count', async () => {
      await manager.createSession({ sessionId: 'turn-test' });
      const result = await manager.submitTurn('turn-test', {
        clientId: 'c1',
        writerId: 'w1',
        content: 'hello',
        mode: 'chat',
      });
      expect(result.turnId).toBeDefined();
      expect(typeof result.turnId).toBe('string');
      expect(result.turnId.length).toBeGreaterThan(0);
      // queued may be 0 if processing immediately picks it up, or 1 if still queued
      expect(typeof result.queued).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // cancelSessionTurns
  // -----------------------------------------------------------------------

  describe('cancelSessionTurns', () => {
    it('returns 0 for a non-existent session', async () => {
      const cancelled = await manager.cancelSessionTurns('nonexistent', { turnId: 't1' });
      expect(cancelled).toBe(0);
    });

    it('returns 0 when no matching queued turns', async () => {
      await manager.createSession({ sessionId: 'cancel-test' });
      const cancelled = await manager.cancelSessionTurns('cancel-test', {
        turnId: 'non-existent-turn',
      });
      expect(cancelled).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // resolvePermission
  // -----------------------------------------------------------------------

  describe('resolvePermission', () => {
    it('returns session not found for non-existent session', () => {
      const result = manager.resolvePermission('nonexistent', {
        requestId: 'r1',
        decision: 'allow',
        decidedBy: 'user-1',
      });
      expect(result.ok).toBe(false);
      expect(result.message).toBe('Session not found');
    });

    it('returns not-ok for unknown permission request', async () => {
      await manager.createSession({ sessionId: 'perm-test' });
      const result = manager.resolvePermission('perm-test', {
        requestId: 'unknown-req',
        decision: 'allow',
        decidedBy: 'user-1',
      });
      expect(result.ok).toBe(false);
      expect(result.conflict).toBe(false);
      expect(result.message).toBe('Unknown permission request');
    });
  });

  // -----------------------------------------------------------------------
  // subscribe / unsubscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('delivers events to subscribers', async () => {
      await manager.createSession({ sessionId: 'sub-test' });
      const events: unknown[] = [];
      const unsub = manager.subscribe('sub-test', (event) => {
        events.push(event);
      });

      // Creating the session already emitted 'session.snapshot', so there should be at least 1 event
      // But subscribe was set up after createSession, so events from create won't be captured
      // Let's trigger new events
      await manager.submitTurn('sub-test', {
        clientId: 'c1',
        writerId: 'w1',
        content: 'test',
        mode: 'chat',
      });

      // Give async work time to propagate
      await new Promise((r) => setTimeout(r, 100));

      expect(events.length).toBeGreaterThanOrEqual(1);
      unsub();
    });

    it('unsubscribe removes the listener', async () => {
      await manager.createSession({ sessionId: 'unsub-test' });
      const events: unknown[] = [];
      const unsub = manager.subscribe('unsub-test', (event) => {
        events.push(event);
      });

      unsub();

      await manager.submitTurn('unsub-test', {
        clientId: 'c1',
        writerId: 'w1',
        content: 'after-unsub',
        mode: 'chat',
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(events.length).toBe(0);
    });

    it('subscriber errors do not poison other subscribers', async () => {
      await manager.createSession({ sessionId: 'poison-test' });
      const good: unknown[] = [];

      manager.subscribe('poison-test', () => {
        throw new Error('bad subscriber');
      });
      manager.subscribe('poison-test', (event) => {
        good.push(event);
      });

      await manager.submitTurn('poison-test', {
        clientId: 'c1',
        writerId: 'w1',
        content: 'test',
        mode: 'chat',
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(good.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // getRuntimeStats
  // -----------------------------------------------------------------------

  describe('getRuntimeStats', () => {
    it('returns zeroed stats for a fresh manager', () => {
      const stats = manager.getRuntimeStats();
      expect(stats.sessionCount).toBe(0);
      expect(stats.activeTurnCount).toBe(0);
      expect(stats.queuedTurnCount).toBe(0);
      expect(stats.subscriberCount).toBe(0);
      expect(stats.ingressSeq).toBe(0);
    });

    it('reflects session count after creation', async () => {
      await manager.createSession({ sessionId: 'stat-1' });
      await manager.createSession({ sessionId: 'stat-2' });
      const stats = manager.getRuntimeStats();
      expect(stats.sessionCount).toBe(2);
    });

    it('reflects subscriber count', async () => {
      await manager.createSession({ sessionId: 'sub-stat' });
      const unsub1 = manager.subscribe('sub-stat', () => {});
      const unsub2 = manager.subscribe('sub-stat', () => {});
      expect(manager.getRuntimeStats().subscriberCount).toBe(2);
      unsub1();
      expect(manager.getRuntimeStats().subscriberCount).toBe(1);
      unsub2();
      expect(manager.getRuntimeStats().subscriberCount).toBe(0);
    });

    it('increments ingressSeq on submitTurn', async () => {
      await manager.createSession({ sessionId: 'seq-test' });
      await manager.submitTurn('seq-test', {
        clientId: 'c1',
        writerId: 'w1',
        content: 'first',
        mode: 'chat',
      });
      await manager.submitTurn('seq-test', {
        clientId: 'c1',
        writerId: 'w1',
        content: 'second',
        mode: 'chat',
      });
      const stats = manager.getRuntimeStats();
      expect(stats.ingressSeq).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // background process management
  // -----------------------------------------------------------------------

  describe('background processes', () => {
    it('listBackgroundProcesses throws for non-existent session', () => {
      expect(() => manager.listBackgroundProcesses('nonexistent')).toThrow(
        'Session not found: nonexistent'
      );
    });

    it('listBackgroundProcesses succeeds for existing session', async () => {
      await manager.createSession({ sessionId: 'bg-list' });
      const result = await manager.listBackgroundProcesses('bg-list');
      expect(result).toEqual([]);
    });

    it('listBackgroundProcesses without sessionId returns all', async () => {
      const result = await manager.listBackgroundProcesses();
      expect(result).toEqual([]);
    });

    it('startBackgroundProcess throws for non-existent session', async () => {
      await expect(
        manager.startBackgroundProcess({
          sessionId: 'nonexistent',
          command: 'echo hi',
        }),
      ).rejects.toThrow('Session not found: nonexistent');
    });

    it('startBackgroundProcess returns snapshot for valid session', async () => {
      await manager.createSession({ sessionId: 'bg-start' });
      const result = await manager.startBackgroundProcess({
        sessionId: 'bg-start',
        command: 'echo hi',
      });
      expect(result).toBeDefined();
      expect(result.processId).toBe('p-1');
    });

    it('getBackgroundStatus returns null for unknown process', () => {
      const result = manager.getBackgroundStatus('unknown');
      expect(result).toBeNull();
    });

    it('getBackgroundOutput returns null for unknown process', () => {
      const result = manager.getBackgroundOutput('unknown', { afterSeq: 0, limit: 100, stream: 'both' });
      expect(result).toBeNull();
    });

    it('killBackgroundProcess returns null for unknown process', async () => {
      const result = await manager.killBackgroundProcess('unknown');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // close
  // -----------------------------------------------------------------------

  describe('close', () => {
    it('closes without error', async () => {
      await expect(manager.close()).resolves.toBeUndefined();
    });

    it('closes gracefully even if config fails', async () => {
      const failManager = new SessionManager(DAEMON_ID, async () => {
        throw new Error('config unavailable');
      });
      await expect(failManager.close()).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // hydrateFromDisk
  // -----------------------------------------------------------------------

  describe('hydrateFromDisk', () => {
    it('hydrates sessions from disk', async () => {
      const { listStoredSessions, readSessionSnapshot } = await import(
        '../../src/daemon/session-store.js'
      );
      vi.mocked(listStoredSessions).mockResolvedValue(['disk-1', 'disk-2']);
      vi.mocked(readSessionSnapshot).mockImplementation(async (id: string) => ({
        sessionId: id,
        model: 'hydrated-model',
        title: `Session ${id}`,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        messages: [],
        toolCallCount: 0,
        seq: 0,
      }));

      await manager.hydrateFromDisk();
      const stats = manager.getRuntimeStats();
      expect(stats.sessionCount).toBe(2);

      const snap = await manager.getSession('disk-1');
      expect(snap).not.toBeNull();
      expect(snap!.model).toBe('hydrated-model');
    });

    it('skips sessions with missing snapshots', async () => {
      const { listStoredSessions, readSessionSnapshot } = await import(
        '../../src/daemon/session-store.js'
      );
      vi.mocked(listStoredSessions).mockResolvedValue(['good', 'bad']);
      vi.mocked(readSessionSnapshot).mockImplementation(async (id: string) => {
        if (id === 'bad') return null;
        return {
          sessionId: id,
          model: 'm',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          messages: [],
          toolCallCount: 0,
          seq: 0,
        };
      });

      await manager.hydrateFromDisk();
      expect(manager.getRuntimeStats().sessionCount).toBe(1);
    });
  });
});
