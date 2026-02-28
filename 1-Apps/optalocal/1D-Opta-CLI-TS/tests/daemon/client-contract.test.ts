import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ensureDaemonRunningMock = vi.fn();

vi.mock('../../src/daemon/lifecycle.js', () => ({
  ensureDaemonRunning: ensureDaemonRunningMock,
}));

describe('DaemonClient contract validation', () => {
  beforeEach(() => {
    ensureDaemonRunningMock.mockResolvedValue({
      host: '127.0.0.1',
      port: 9999,
      token: 'token',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns parsed health payload with contract metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        version: '0.5.0-alpha.1',
        daemonId: 'daemon_test',
        contract: { name: 'opta-daemon-v3', version: 1 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { DaemonClient } = await import('../../src/daemon/client.js');
    const client = new DaemonClient('127.0.0.1', 9999, 'token');

    await expect(client.health()).resolves.toMatchObject({
      status: 'ok',
      daemonId: 'daemon_test',
      contract: { name: 'opta-daemon-v3', version: 1 },
    });
  });

  it('throws actionable error when daemon health omits contract metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        daemonId: 'daemon_test',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { DaemonClient } = await import('../../src/daemon/client.js');
    const client = new DaemonClient('127.0.0.1', 9999, 'token');

    await expect(client.health()).rejects.toThrow(/missing contract metadata/i);
  });

  it('connect fails fast on contract mismatch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        daemonId: 'daemon_legacy',
        contract: { name: 'opta-daemon-v2', version: 9 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { DaemonClient } = await import('../../src/daemon/client.js');

    await expect(DaemonClient.connect()).rejects.toThrow(/contract mismatch.*daemon_legacy/i);
  });
});
