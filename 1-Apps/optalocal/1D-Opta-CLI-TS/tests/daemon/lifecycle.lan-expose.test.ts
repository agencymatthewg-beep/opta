/**
 * Tests for the LAN bind address feature (Phase 4a).
 *
 * Covers:
 *  - resolveDaemonBindHost() returns '127.0.0.1' by default
 *  - resolveDaemonBindHost() returns '0.0.0.0' when daemon.lanExpose = true
 *  - daemonStart() with opts.lan = true writes lanExpose = true to config
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config module
// ---------------------------------------------------------------------------

const mockLoadConfig = vi.fn();
const mockSaveConfig = vi.fn(async () => {});

vi.mock('../../src/core/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
  clearLoadConfigCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock dependencies required by lifecycle.ts
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/disk.js', () => ({
  diskHeadroomMbToBytes: vi.fn(() => 0),
  ensureDiskHeadroom: vi.fn(async () => ({
    path: '/tmp',
    totalBytes: 1e9,
    freeBytes: 1e9,
    availableBytes: 1e9,
  })),
}));

vi.mock('../../src/platform/index.js', () => ({
  isWindows: false,
  isMacOS: true,
  isLinux: false,
  homedir: () => process.env['HOME'] ?? '/tmp',
  pathSep: '/',
  requiresPosixPlatform: vi.fn(),
  shellArgs: () => ['/bin/sh', '-c'],
  isBinaryAvailable: vi.fn(async () => true),
  restrictFileToCurrentUser: vi.fn(async () => {}),
}));

vi.mock('../../src/daemon/telemetry.js', () => ({
  logDaemonEvent: vi.fn(async () => {}),
  daemonLogsPath: vi.fn(() => '/tmp/opta-daemon-lan-test.log'),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  rm: vi.fn(async () => {}),
  chmod: vi.fn(async () => {}),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Mock daemon installer (required by daemon.ts import chain)
// ---------------------------------------------------------------------------

vi.mock('../../src/daemon/installer.js', () => ({
  installDaemonService: vi.fn(async () => {}),
  uninstallDaemonService: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Mock ensureDaemonRunning for daemonStart tests
// ---------------------------------------------------------------------------

const mockEnsureDaemonRunning = vi.fn();

vi.mock('../../src/daemon/lifecycle.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/daemon/lifecycle.js')>();
  return {
    ...original,
    ensureDaemonRunning: (...args: unknown[]) => mockEnsureDaemonRunning(...args),
    stopDaemon: vi.fn(async () => true),
    daemonStatus: vi.fn(async () => ({ running: false, state: null, logsPath: '/tmp/opta.log' })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(lanExpose: boolean) {
  return {
    daemon: { host: '127.0.0.1', port: 9999, lanExpose },
    connection: { host: 'localhost', port: 1234 },
    safety: { diskHeadroomMb: 64 },
  };
}

// ---------------------------------------------------------------------------
// Tests: resolveDaemonBindHost
// ---------------------------------------------------------------------------

describe('resolveDaemonBindHost', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 127.0.0.1 when lanExpose is false (default)', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(false));

    const { resolveDaemonBindHost } = await import('../../src/daemon/lifecycle.js');
    const host = await resolveDaemonBindHost();

    expect(host).toBe('127.0.0.1');
  });

  it('returns 0.0.0.0 when lanExpose is true in config', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));

    const { resolveDaemonBindHost } = await import('../../src/daemon/lifecycle.js');
    const host = await resolveDaemonBindHost();

    expect(host).toBe('0.0.0.0');
  });

  it('returns 127.0.0.1 when loadConfig throws (safe fallback)', async () => {
    mockLoadConfig.mockRejectedValue(new Error('config read error'));

    const { resolveDaemonBindHost } = await import('../../src/daemon/lifecycle.js');
    const host = await resolveDaemonBindHost();

    expect(host).toBe('127.0.0.1');
  });
});

// ---------------------------------------------------------------------------
// Tests: daemonStart --lan flag
// ---------------------------------------------------------------------------

describe('daemonStart --lan flag', () => {
  const fakeState = {
    pid: 42,
    daemonId: 'daemon_test',
    host: '0.0.0.0',
    port: 9999,
    token: 'tok',
    startedAt: new Date().toISOString(),
    logsPath: '/tmp/opta.log',
  };

  beforeEach(() => {
    mockEnsureDaemonRunning.mockResolvedValue(fakeState);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saves daemon.lanExpose=true in config when --lan is passed', async () => {
    const { daemonStart } = await import('../../src/commands/daemon.js');
    await daemonStart({ lan: true });

    expect(mockSaveConfig).toHaveBeenCalledWith({ 'daemon.lanExpose': true });
    expect(mockEnsureDaemonRunning).toHaveBeenCalledOnce();
  });

  it('does NOT write config when --lan is not passed', async () => {
    const { daemonStart } = await import('../../src/commands/daemon.js');
    await daemonStart({});

    expect(mockSaveConfig).not.toHaveBeenCalled();
    expect(mockEnsureDaemonRunning).toHaveBeenCalledOnce();
  });

  it('does NOT write config when lan is explicitly false', async () => {
    const { daemonStart } = await import('../../src/commands/daemon.js');
    await daemonStart({ lan: false });

    expect(mockSaveConfig).not.toHaveBeenCalled();
  });
});
