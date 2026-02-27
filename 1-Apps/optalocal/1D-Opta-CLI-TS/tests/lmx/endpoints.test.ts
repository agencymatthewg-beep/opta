import { beforeEach, describe, expect, it, vi } from 'vitest';

const { probeSpy } = vi.hoisted(() => ({
  probeSpy: vi.fn(),
}));

vi.mock('../../src/lmx/connection.js', () => ({
  probeLmxConnection: probeSpy,
}));

import {
  clearLmxEndpointCache,
  listCandidateHosts,
  resolveLmxEndpoint,
} from '../../src/lmx/endpoints.js';

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('lmx endpoint resolution', () => {
  beforeEach(() => {
    probeSpy.mockReset();
    clearLmxEndpointCache();
  });

  it('deduplicates candidate hosts preserving order', () => {
    expect(listCandidateHosts({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11', 'mono512', ' 192.168.188.11 '],
    })).toEqual(['mono512', '192.168.188.11']);
  });

  it('prefers primary host when reachable', async () => {
    probeSpy.mockResolvedValue({
      state: 'connected',
      latencyMs: 8,
    });

    const endpoint = await resolveLmxEndpoint({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11'],
      port: 1234,
    });

    expect(endpoint.host).toBe('mono512');
    expect(endpoint.source).toBe('primary');
  });

  it('falls back when primary host is down', async () => {
    probeSpy
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({
        state: 'connected',
        latencyMs: 12,
      });

    const endpoint = await resolveLmxEndpoint({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11'],
      port: 1234,
    });

    expect(endpoint.host).toBe('192.168.188.11');
    expect(endpoint.source).toBe('fallback');
  });

  it('returns primary host when no candidate is reachable', async () => {
    probeSpy
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));

    const endpoint = await resolveLmxEndpoint({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11'],
      port: 1234,
    });

    expect(endpoint.host).toBe('mono512');
    expect(endpoint.state).toBe('unknown');
    expect(endpoint.source).toBe('primary');
  });

  it('caches a resolved endpoint for repeated lookups', async () => {
    probeSpy.mockResolvedValue({
      state: 'connected',
      latencyMs: 3,
    });

    await resolveLmxEndpoint({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11'],
      port: 1234,
    });
    await resolveLmxEndpoint({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11'],
      port: 1234,
    });

    expect(probeSpy).toHaveBeenCalledTimes(2);
  });

  it('returns earliest connected fallback when primary remains in-flight past grace window', async () => {
    vi.useFakeTimers();
    try {
      const primaryProbe = createDeferred<{ state: 'connected'; latencyMs: number }>();
      const fallbackProbe = createDeferred<{ state: 'connected'; latencyMs: number }>();

      probeSpy.mockImplementation((host: string) => {
        if (host === 'mono512') return primaryProbe.promise;
        return fallbackProbe.promise;
      });

      const pending = resolveLmxEndpoint({
        host: 'mono512',
        fallbackHosts: ['192.168.188.11'],
        port: 1234,
      }, {
        timeoutMs: 2_000,
        primaryGraceMs: 25,
      });

      fallbackProbe.resolve({ state: 'connected', latencyMs: 9 });
      await Promise.resolve();

      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(25);
      const endpoint = await pending;
      expect(endpoint.host).toBe('192.168.188.11');
      expect(endpoint.source).toBe('fallback');
      expect(endpoint.state).toBe('connected');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps primary preference when primary becomes connected during fallback grace window', async () => {
    vi.useFakeTimers();
    try {
      const primaryProbe = createDeferred<{ state: 'connected'; latencyMs: number }>();
      const fallbackProbe = createDeferred<{ state: 'connected'; latencyMs: number }>();

      probeSpy.mockImplementation((host: string) => {
        if (host === 'mono512') return primaryProbe.promise;
        return fallbackProbe.promise;
      });

      const pending = resolveLmxEndpoint({
        host: 'mono512',
        fallbackHosts: ['192.168.188.11'],
        port: 1234,
      }, {
        timeoutMs: 2_000,
        primaryGraceMs: 60,
      });

      fallbackProbe.resolve({ state: 'connected', latencyMs: 6 });
      await Promise.resolve();
      primaryProbe.resolve({ state: 'connected', latencyMs: 14 });

      const endpoint = await pending;
      expect(endpoint.host).toBe('mono512');
      expect(endpoint.source).toBe('primary');
      expect(endpoint.state).toBe('connected');
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports cancellation via AbortSignal', async () => {
    probeSpy.mockImplementation(() => new Promise(() => {}));

    const controller = new AbortController();
    const pending = resolveLmxEndpoint({
      host: 'mono512',
      fallbackHosts: ['192.168.188.11'],
      port: 1234,
    }, {
      signal: controller.signal,
      timeoutMs: 2_000,
    });

    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
