/**
 * Tests for the crash guardian in ensureDaemonRunning() and related
 * lifecycle helpers: isDaemonRunning, isProcessRunning, clearDaemonState.
 *
 * All file-system and network I/O is mocked so no real daemon is started.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DaemonState } from '../../src/daemon/lifecycle.js';

// ---------------------------------------------------------------------------
// Static mock values
// ---------------------------------------------------------------------------

const LIVE_STATE: DaemonState = {
  pid: process.pid, // guaranteed to exist
  daemonId: 'daemon-test-live',
  host: '127.0.0.1',
  port: 9999,
  token: 'test-token-live',
  startedAt: new Date().toISOString(),
  logsPath: '/tmp/opta-test.log',
};

const DEAD_STATE: DaemonState = {
  pid: 99999999, // non-existent pid
  daemonId: 'daemon-test-dead',
  host: '127.0.0.1',
  port: 9999,
  token: 'test-token-dead',
  startedAt: new Date().toISOString(),
  logsPath: '/tmp/opta-test.log',
};

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted before any imports of the module under test)
// ---------------------------------------------------------------------------

// Mock disk utilities so ensureDaemonDir() never touches the real filesystem.
vi.mock('../../src/utils/disk.js', () => ({
  diskHeadroomMbToBytes: vi.fn(() => 0),
  ensureDiskHeadroom: vi.fn(async () => ({ path: '/tmp', totalBytes: 1e9, freeBytes: 1e9, availableBytes: 1e9 })),
}));

// Mock platform file-permission helper.
vi.mock('../../src/platform/index.js', () => ({
  restrictFileToCurrentUser: vi.fn(async () => {}),
}));

// Mock telemetry so daemonLogsPath() has a value and no real files are written.
vi.mock('../../src/daemon/telemetry.js', () => ({
  logDaemonEvent: vi.fn(async () => {}),
  daemonLogsPath: vi.fn(() => '/tmp/opta-daemon-test.log'),
}));

// ---------------------------------------------------------------------------
// node:fs/promises — all async file operations
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn<[string, string], Promise<string>>();
const mockWriteFile = vi.fn<unknown[], Promise<void>>(async () => {});
const mockMkdir = vi.fn<unknown[], Promise<void>>(async () => {});
const mockRm = vi.fn<unknown[], Promise<void>>(async () => {});

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...(args as [string, string])),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  rm: (...args: unknown[]) => mockRm(...args),
}));

// ---------------------------------------------------------------------------
// node:fs — synchronous existsSync (used by resolveCliEntrypoint)
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// node:child_process — spawn (used by startDaemonDetached)
// ---------------------------------------------------------------------------

const mockSpawn = vi.fn(() => ({
  unref: vi.fn(),
  pid: 12345,
}));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configures mockReadFile to return the given state (or throw ENOENT).
 */
function setStoredState(state: DaemonState | null): void {
  if (state === null) {
    mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  } else {
    mockReadFile.mockResolvedValue(JSON.stringify(state));
  }
}

// ---------------------------------------------------------------------------
// Tests: isProcessRunning
// ---------------------------------------------------------------------------

describe('isProcessRunning', () => {
  it('returns false for pid=99999999 (non-existent process)', async () => {
    const { isProcessRunning } = await import('../../src/daemon/lifecycle.js');
    expect(isProcessRunning(99999999)).toBe(false);
  });

  it('returns true for process.pid (current process is always alive)', async () => {
    const { isProcessRunning } = await import('../../src/daemon/lifecycle.js');
    expect(isProcessRunning(process.pid)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: isDaemonRunning — pid-level check
// ---------------------------------------------------------------------------

describe('isDaemonRunning — pid checks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true } as unknown as Response)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false for a state with a dead pid (99999999)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true } as unknown as Response)));
    const { isDaemonRunning } = await import('../../src/daemon/lifecycle.js');
    const result = await isDaemonRunning(DEAD_STATE);
    // process.kill(99999999, 0) throws → isProcessRunning returns false → isDaemonRunning short-circuits
    expect(result).toBe(false);
  });

  it('returns true for a state with the current process pid (alive)', async () => {
    // fetch returns ok:true so the HTTP ping succeeds
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true } as unknown as Response)));
    const { isDaemonRunning } = await import('../../src/daemon/lifecycle.js');
    const result = await isDaemonRunning(LIVE_STATE);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: ensureDaemonRunning — crash guardian behaviour
// ---------------------------------------------------------------------------

describe('ensureDaemonRunning', () => {
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSpawn.mockReset().mockReturnValue({ unref: vi.fn(), pid: 12345 });
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockRm.mockReset();
    mockMkdir.mockReset();

    // By default: make pid 12345 appear alive (fresh daemon), 99999999 dead
    killSpy = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (signal !== 0) return true; // non-probe signals always succeed
      if (pid === 12345) return true;
      if (pid === process.pid) return true;
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    });

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true } as unknown as Response)));
  });

  afterEach(() => {
    killSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('starts daemon fresh when no state file exists', async () => {
    const freshState: DaemonState = {
      pid: 12345,
      daemonId: 'daemon-fresh',
      host: '127.0.0.1',
      port: 9999,
      token: 'fresh-token',
      startedAt: new Date().toISOString(),
      logsPath: '/tmp/opta-test.log',
    };

    // Read sequence across all internal calls to readDaemonState():
    //   call 1: ensureDaemonRunning's initial readDaemonState → ENOENT (no state)
    //   call 2: startDaemonDetached's existing-check readDaemonState → ENOENT
    //   call 3: isDaemonRunning(null) re-reads internally → ENOENT (still nothing)
    //   call 4+: waitForDaemonReady poll → freshState (daemon published state)
    //   final: readDaemonState after ready → freshState
    let readCallCount = 0;
    mockReadFile.mockImplementation(async () => {
      readCallCount++;
      if (readCallCount <= 3) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return JSON.stringify(freshState);
    });

    const { ensureDaemonRunning } = await import('../../src/daemon/lifecycle.js');
    const result = await ensureDaemonRunning();

    expect(result.daemonId).toBe('daemon-fresh');
    expect(mockSpawn).toHaveBeenCalledOnce();
    // clearDaemonState should NOT have been called (no stale state to clear)
    expect(mockRm).not.toHaveBeenCalled();
  }, 15000);

  it('returns existing state without restart when daemon is alive', async () => {
    // State file exists; process is current PID (alive); ping returns ok
    mockReadFile.mockResolvedValue(JSON.stringify(LIVE_STATE));

    const { ensureDaemonRunning } = await import('../../src/daemon/lifecycle.js');
    const result = await ensureDaemonRunning();

    expect(result.pid).toBe(LIVE_STATE.pid);
    expect(result.daemonId).toBe(LIVE_STATE.daemonId);
    // No new process should have been spawned
    expect(mockSpawn).not.toHaveBeenCalled();
    // clearDaemonState should NOT have been called
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('crash guardian: clears stale state and restarts when process is dead', async () => {
    // DEAD_STATE has pid=99999999 which cannot be signalled → isProcessRunning=false
    const freshState: DaemonState = {
      pid: 12345,
      daemonId: 'daemon-restarted',
      host: '127.0.0.1',
      port: 9999,
      token: 'restarted-token',
      startedAt: new Date().toISOString(),
      logsPath: '/tmp/opta-test.log',
    };

    // Read sequence across all internal calls to readDaemonState():
    //   call 1: ensureDaemonRunning's initial readDaemonState → DEAD_STATE
    //   (isDaemonRunning(DEAD_STATE) is called with state provided, no extra read)
    //   (isProcessRunning(99999999) → false, returns early without fetching)
    //   → crash guardian: clearDaemonState() called
    //   call 2: startDaemonDetached's existing-check readDaemonState → ENOENT (cleared)
    //   call 3: isDaemonRunning(null) re-reads internally → ENOENT (still cleared)
    //   call 4+: waitForDaemonReady polls → freshState (new daemon came up)
    //   final: readDaemonState after ready → freshState
    let readCallCount = 0;
    mockReadFile.mockImplementation(async () => {
      readCallCount++;
      if (readCallCount === 1) return JSON.stringify(DEAD_STATE);
      if (readCallCount <= 3) {
        // State was cleared by crash guardian; daemon not yet up
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return JSON.stringify(freshState);
    });

    const { ensureDaemonRunning } = await import('../../src/daemon/lifecycle.js');
    const result = await ensureDaemonRunning();

    expect(result.daemonId).toBe('daemon-restarted');

    // Crash guardian must have cleared state (rm called for state.json and daemon.pid)
    expect(mockRm).toHaveBeenCalled();

    // A new process must have been spawned
    expect(mockSpawn).toHaveBeenCalledOnce();
  }, 15000);
});
