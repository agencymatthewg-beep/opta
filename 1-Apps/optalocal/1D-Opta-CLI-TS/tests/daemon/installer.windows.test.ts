import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DaemonState } from '../../src/daemon/lifecycle.js';

const execaMock = vi.fn();
const existsSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
const readDaemonStateMock = vi.fn<[], Promise<DaemonState | null>>();
const isDaemonRunningMock = vi.fn<[DaemonState], Promise<boolean>>();

vi.mock('execa', () => ({
  execa: (...args: unknown[]) => execaMock(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  unlinkSync: (...args: unknown[]) => unlinkSyncMock(...args),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async () => {}),
}));

vi.mock('../../src/daemon/lifecycle.js', () => ({
  readDaemonState: () => readDaemonStateMock(),
  isDaemonRunning: (state: DaemonState) => isDaemonRunningMock(state),
}));

const originalPlatform = process.platform;
const originalArgv = [...process.argv];

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });
}

function mockSchtasksDefaults(): void {
  execaMock.mockImplementation(async (cmd: string, args?: string[], opts?: { reject?: boolean }) => {
    if (cmd === 'where') {
      return {
        exitCode: 0,
        stdout: 'C:\\Users\\user\\AppData\\Roaming\\npm\\opta.ps1\r\nC:\\Users\\user\\AppData\\Roaming\\npm\\opta.cmd\r\n',
        stderr: '',
      };
    }
    if (cmd === 'schtasks' && args?.includes('/Create')) {
      return { exitCode: 0, stdout: 'SUCCESS', stderr: '' };
    }
    if (cmd === 'schtasks' && args?.includes('/Run')) {
      return { exitCode: 0, stdout: 'SUCCESS', stderr: '' };
    }
    if (cmd === 'schtasks' && args?.includes('/Query')) {
      return { exitCode: 0, stdout: 'TaskName,Status\r\nOpta Daemon,Ready\r\n', stderr: '' };
    }
    if (cmd === 'schtasks' && args?.includes('/Delete')) {
      return { exitCode: 0, stdout: 'SUCCESS', stderr: '' };
    }
    if (opts?.reject === false) {
      return { exitCode: 1, stdout: '', stderr: 'mocked failure' };
    }
    throw new Error(`unexpected call: ${cmd} ${(args ?? []).join(' ')}`);
  });
}

describe('daemon installer (win32)', () => {
  beforeEach(() => {
    vi.resetModules();
    setPlatform('win32');
    process.argv = [...originalArgv];
    execaMock.mockReset();
    existsSyncMock.mockReset().mockReturnValue(false);
    unlinkSyncMock.mockReset();
    readDaemonStateMock.mockReset().mockResolvedValue(null);
    isDaemonRunningMock.mockReset().mockResolvedValue(false);
    mockSchtasksDefaults();
  });

  afterAll(() => {
    setPlatform(originalPlatform);
    process.argv = [...originalArgv];
  });

  it('builds task action using cmd.exe wrapper for .cmd shims', async () => {
    const { installDaemonService } = await import('../../src/daemon/installer.js');
    await installDaemonService();

    const createCall = execaMock.mock.calls.find(
      ([cmd, args]) =>
        cmd === 'schtasks' && Array.isArray(args) && args.includes('/Create')
    );
    expect(createCall).toBeDefined();

    const args = createCall?.[1] as string[];
    const trIndex = args.indexOf('/TR');
    const taskAction = args[trIndex + 1];
    expect(taskAction).toContain('cmd.exe /d /s /c');
    expect(taskAction).toContain('opta.cmd');
    expect(taskAction).toContain('daemon run');
  });

  it('falls back to node + argv entry when opta is not resolvable via where', async () => {
    process.argv[1] = '/repo/bin/opta.js';
    existsSyncMock.mockImplementation((path: string) => path === '/repo/bin/opta.js');
    execaMock.mockImplementation(async (cmd: string, args?: string[]) => {
      if (cmd === 'where') {
        throw new Error('not found');
      }
      if (cmd === 'schtasks' && args?.includes('/Create')) {
        return { exitCode: 0, stdout: 'SUCCESS', stderr: '' };
      }
      if (cmd === 'schtasks' && args?.includes('/Run')) {
        return { exitCode: 0, stdout: 'SUCCESS', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const { installDaemonService } = await import('../../src/daemon/installer.js');
    await installDaemonService();

    const createCall = execaMock.mock.calls.find(
      ([cmd, args]) =>
        cmd === 'schtasks' && Array.isArray(args) && args.includes('/Create')
    );
    const args = createCall?.[1] as string[];
    const trIndex = args.indexOf('/TR');
    const taskAction = args[trIndex + 1];
    expect(taskAction).toContain(process.execPath);
    expect(taskAction).toContain('/repo/bin/opta.js');
    expect(taskAction).toContain('daemon run');
  });

  it('treats uninstall as idempotent when task is not installed', async () => {
    execaMock.mockImplementation(async (cmd: string, args?: string[]) => {
      if (cmd === 'schtasks' && args?.includes('/Query')) {
        return { exitCode: 1, stdout: '', stderr: 'ERROR: The system cannot find the file specified.' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const { uninstallDaemonService } = await import('../../src/daemon/installer.js');
    await expect(uninstallDaemonService()).resolves.toBeUndefined();

    const deleteCall = execaMock.mock.calls.find(
      ([cmd, args]) =>
        cmd === 'schtasks' && Array.isArray(args) && args.includes('/Delete')
    );
    expect(deleteCall).toBeUndefined();
  });

  it('uses daemon state for running/stopped status when task is installed', async () => {
    const { getDaemonServiceStatus } = await import('../../src/daemon/installer.js');
    const daemonState: DaemonState = {
      pid: 1234,
      daemonId: 'daemon-test',
      host: '127.0.0.1',
      port: 9999,
      token: 'token',
      startedAt: new Date().toISOString(),
      logsPath: 'C:\\Users\\user\\AppData\\Roaming\\opta\\daemon\\daemon.log',
    };

    readDaemonStateMock.mockResolvedValue(daemonState);
    isDaemonRunningMock.mockResolvedValueOnce(true);
    await expect(getDaemonServiceStatus()).resolves.toBe('installed-running');

    isDaemonRunningMock.mockResolvedValueOnce(false);
    await expect(getDaemonServiceStatus()).resolves.toBe('installed-stopped');
  });
});
