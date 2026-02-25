import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, getOptimalBaseUrl, isLanAvailable } from '@/lib/connection';

describe('isLanAvailable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true on http: (plain LAN)', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
    expect(isLanAvailable()).toBe(true);
  });

  it('returns false on https: (mixed content blocked)', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
    expect(isLanAvailable()).toBe(false);
  });

  it('returns false when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(isLanAvailable()).toBe(false);
  });
});

const settings = {
  ...DEFAULT_SETTINGS,
  host: '10.0.0.42',
  port: 9000,
  adminKey: 'top-secret',
  useTunnel: true,
  tunnelUrl: 'https://tunnel.example.com/',
};

describe('getOptimalBaseUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers LAN when LAN is reachable', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    const result = await getOptimalBaseUrl(settings);

    expect(result).toMatchObject({
      url: 'http://10.0.0.42:9000',
      type: 'lan',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.0.42:9000/v1/models',
      expect.objectContaining({
        headers: { 'X-Admin-Key': 'top-secret' },
      }),
    );
  });

  it('falls back to WAN tunnel when LAN probe fails', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('LAN unavailable'))
      .mockResolvedValueOnce({ ok: true } as Response);

    const result = await getOptimalBaseUrl(settings);

    expect(result).toMatchObject({
      url: 'https://tunnel.example.com',
      type: 'wan',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://10.0.0.42:9000/v1/models',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://tunnel.example.com/v1/models',
      expect.any(Object),
    );
  });

  it('returns null when neither LAN nor WAN is reachable', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('LAN unavailable'))
      .mockResolvedValueOnce({ ok: false } as Response);

    const result = await getOptimalBaseUrl(settings);

    expect(result).toBeNull();
  });
});
