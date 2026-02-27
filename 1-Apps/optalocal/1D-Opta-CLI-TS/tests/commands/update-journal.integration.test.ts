import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_CONFIG = {
  connection: {
    host: 'localhost',
    port: 1234,
    ssh: {
      user: 'opta',
      identityFile: '~/.ssh/id_ed25519',
      lmxPath: '/tmp/1M-Opta-LMX',
      pythonPath: '/usr/bin/python3',
    },
  },
  journal: {
    enabled: true,
    updateLogsDir: 'updates',
    author: 'tester',
    timezone: 'local',
  },
};

describe('updateCommand journal integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes update logs in json mode', async () => {
    const loadConfig = vi.fn().mockResolvedValue(BASE_CONFIG);
    const writeUpdateLog = vi.fn().mockResolvedValue({
      id: 200,
      path: '/tmp/updates/200_2026-02-23_update.md',
      fileName: '200_2026-02-23_update.md',
    });

    vi.doMock('../../src/core/config.js', () => ({ loadConfig }));
    vi.doMock('../../src/journal/update-log.js', () => ({ writeUpdateLog }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { updateCommand } = await import('../../src/commands/update.js');

    await expect(updateCommand({ target: 'remote', remoteHost: 'localhost', json: true })).resolves.toBeUndefined();

    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(writeUpdateLog).toHaveBeenCalledTimes(1);
    expect(writeUpdateLog).toHaveBeenCalledWith(expect.objectContaining({
      rangeStart: 200,
      rangeEnd: 299,
    }));

    logSpy.mockRestore();
  });

  it('fails open when update log writing throws', async () => {
    const loadConfig = vi.fn().mockResolvedValue(BASE_CONFIG);
    const writeUpdateLog = vi.fn().mockRejectedValue(new Error('disk full'));

    vi.doMock('../../src/core/config.js', () => ({ loadConfig }));
    vi.doMock('../../src/journal/update-log.js', () => ({ writeUpdateLog }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { updateCommand } = await import('../../src/commands/update.js');

    await expect(updateCommand({ target: 'remote', remoteHost: 'localhost', json: true })).resolves.toBeUndefined();

    expect(writeUpdateLog).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });
});
