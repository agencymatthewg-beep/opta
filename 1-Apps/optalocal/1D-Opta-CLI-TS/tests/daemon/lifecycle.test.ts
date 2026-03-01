import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDaemonRunning, type DaemonState } from '../../src/daemon/lifecycle.js';

describe('daemon lifecycle health checks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks /v3/health with daemon token query', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(process, 'kill').mockImplementation(() => true);

    const state: DaemonState = {
      pid: 4242,
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 9999,
      token: 'secret token+/=',
      startedAt: new Date().toISOString(),
      logsPath: '/tmp/opta-daemon.log',
    };

    const running = await isDaemonRunning(state);
    expect(running).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'http://127.0.0.1:9999/v3/health?token=secret%20token%2B%2F%3D'
    );
  });

  it('returns false when authenticated health check is unauthorized', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(process, 'kill').mockImplementation(() => true);

    const state: DaemonState = {
      pid: 4242,
      daemonId: 'daemon_test',
      host: '127.0.0.1',
      port: 9999,
      token: 'bad-token',
      startedAt: new Date().toISOString(),
      logsPath: '/tmp/opta-daemon.log',
    };

    const running = await isDaemonRunning(state);
    expect(running).toBe(false);
  });
});
