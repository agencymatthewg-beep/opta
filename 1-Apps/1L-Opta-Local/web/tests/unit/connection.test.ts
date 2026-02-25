import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, getOptimalBaseUrl } from '@/lib/connection';

describe('DEFAULT_SETTINGS tunnel URL', () => {
  it('tunnelUrl is a string (reads from env var or defaults to empty string)', () => {
    expect(typeof DEFAULT_SETTINGS.tunnelUrl).toBe('string');
  });

  it('tunnelUrl matches NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL env var at module load time', () => {
    const envVal = process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL ?? '';
    expect(DEFAULT_SETTINGS.tunnelUrl).toBe(envVal);
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
