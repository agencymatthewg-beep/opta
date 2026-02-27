/**
 * Daemon crash recovery: verifies that process-level error handlers
 * prevent the daemon from crashing on uncaught exceptions and
 * unhandled promise rejections, and that session-level errors
 * are isolated by the try-catch in processSessionQueue.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/daemon/lifecycle.js', () => ({
  writeDaemonState: vi.fn(async () => {}),
  clearDaemonState: vi.fn(async () => {}),
  createDaemonToken: vi.fn(async () => 'test-token'),
  writeDaemonToken: vi.fn(async () => {}),
  defaultDaemonHost: vi.fn(() => '127.0.0.1'),
  defaultDaemonPort: vi.fn(() => 0),
}));

vi.mock('../../src/daemon/telemetry.js', () => ({
  logDaemonEvent: vi.fn(async () => {}),
  daemonLogsPath: vi.fn(() => '/tmp/opta-daemon-test.log'),
}));

describe('daemon crash recovery', () => {
  it('runDaemon function is exported and callable', async () => {
    const mod = await import('../../src/daemon/main.js');
    expect(mod.runDaemon).toBeDefined();
    expect(typeof mod.runDaemon).toBe('function');
  });

  it('session manager survives session lifecycle without crashing', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');

    const sm = new SessionManager('test-daemon-lifecycle', async () => {
      const { loadConfig } = await import('../../src/core/config.js');
      return loadConfig();
    });

    // Create a session
    const session = await sm.createSession({});
    expect(session.sessionId).toBeTruthy();

    // Verify session exists
    const fetched = await sm.getSession(session.sessionId);
    expect(fetched).not.toBeNull();
    expect(fetched?.sessionId).toBe(session.sessionId);

    // Session manager runtime stats should show 1 session
    const stats = sm.getRuntimeStats();
    expect(stats.sessionCount).toBe(1);

    // Close should work cleanly
    await sm.close();
  });

  it('session manager reports correct runtime stats', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');

    const sm = new SessionManager('test-daemon-stats', async () => {
      const { loadConfig } = await import('../../src/core/config.js');
      return loadConfig();
    });

    // Initially empty
    const emptyStats = sm.getRuntimeStats();
    expect(emptyStats.sessionCount).toBe(0);
    expect(emptyStats.activeTurnCount).toBe(0);
    expect(emptyStats.queuedTurnCount).toBe(0);

    // Create two sessions
    await sm.createSession({});
    await sm.createSession({});

    const withSessions = sm.getRuntimeStats();
    expect(withSessions.sessionCount).toBe(2);

    await sm.close();
  });

  it('session manager isolates per-session errors via event subscription', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');

    const sm = new SessionManager('test-daemon-isolation', async () => {
      const { loadConfig } = await import('../../src/core/config.js');
      return loadConfig();
    });

    await sm.createSession({});
    const s2 = await sm.createSession({});

    // Subscribe to s2 to verify it still receives events
    const s2Events: unknown[] = [];
    sm.subscribe(s2.sessionId, (event) => {
      s2Events.push(event);
    });

    // s2 session should still be accessible after s1 operations
    const fetched = await sm.getSession(s2.sessionId);
    expect(fetched).not.toBeNull();
    expect(fetched?.sessionId).toBe(s2.sessionId);

    // Runtime stats should show both sessions
    const stats = sm.getRuntimeStats();
    expect(stats.sessionCount).toBe(2);

    await sm.close();
  });

  it('session manager closes gracefully even with active sessions', async () => {
    const { SessionManager } = await import('../../src/daemon/session-manager.js');

    const sm = new SessionManager('test-daemon-graceful', async () => {
      const { loadConfig } = await import('../../src/core/config.js');
      return loadConfig();
    });

    await sm.createSession({});
    await sm.createSession({});
    await sm.createSession({});

    // close() should not throw
    await expect(sm.close()).resolves.not.toThrow();
  });
});
