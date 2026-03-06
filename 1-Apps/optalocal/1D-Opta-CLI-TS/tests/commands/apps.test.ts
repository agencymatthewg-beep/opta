import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDaemonServiceStatusMock = vi.fn();
const installDaemonServiceMock = vi.fn();
const uninstallDaemonServiceMock = vi.fn();

vi.mock('../../src/daemon/installer.js', () => ({
  getDaemonServiceStatus: () => getDaemonServiceStatusMock(),
  installDaemonService: () => installDaemonServiceMock(),
  uninstallDaemonService: () => uninstallDaemonServiceMock(),
}));

describe('apps command', () => {
  let output: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    getDaemonServiceStatusMock.mockReset().mockResolvedValue('not-installed');
    installDaemonServiceMock.mockReset().mockResolvedValue(undefined);
    uninstallDaemonServiceMock.mockReset().mockResolvedValue(undefined);
    output = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map((arg) => String(arg)).join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('apps list json reflects daemon service availability', async () => {
    const { appsList } = await import('../../src/commands/apps.js');

    getDaemonServiceStatusMock.mockResolvedValueOnce('installed-running');
    await appsList({ json: true });

    const withDaemon = JSON.parse(output.join('\n')) as Array<{ id: string; path: string }>;
    expect(withDaemon.some((entry) => entry.id === 'opta-daemon')).toBe(true);
    expect(withDaemon.find((entry) => entry.id === 'opta-daemon')?.path).toContain(
      'installed-running'
    );

    output = [];
    getDaemonServiceStatusMock.mockResolvedValueOnce('not-installed');
    await appsList({ json: true });

    const withoutDaemon = JSON.parse(output.join('\n')) as Array<{ id: string }>;
    expect(withoutDaemon.some((entry) => entry.id === 'opta-daemon')).toBe(false);
  });

  it('only allows daemon install/uninstall through managed app actions', async () => {
    const { appsInstall, appsUninstall } = await import('../../src/commands/apps.js');

    await appsInstall(['opta-daemon']);
    expect(installDaemonServiceMock).toHaveBeenCalledTimes(1);

    await appsInstall(['opta-lmx']);
    expect(output.join('\n')).toContain('not implemented yet');

    await appsUninstall(['opta-daemon']);
    expect(uninstallDaemonServiceMock).toHaveBeenCalledTimes(1);
  });
});
