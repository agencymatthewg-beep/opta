import { beforeEach, describe, expect, it, vi } from 'vitest';
import { daemonAdminRequest } from '@/lib/daemon-admin';
import { GET as getStatus } from '@/app/api/services/status/route';
import { POST as postTest } from '@/app/api/services/test/route';
import { POST as postSetup } from '@/app/api/services/setup/route';

vi.mock('@/lib/daemon-admin', () => ({
  daemonAdminRequest: vi.fn(),
}));

describe('services API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('proxies GET /api/services/status to daemon status endpoint', async () => {
    vi.mocked(daemonAdminRequest).mockResolvedValueOnce({
      status: 200,
      body: { integrations: { github: { configured: true } } },
    });

    const response = await getStatus();

    expect(vi.mocked(daemonAdminRequest)).toHaveBeenCalledWith(
      '/v3/services/status',
      { method: 'GET' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      integrations: { github: { configured: true } },
    });
  });

  it('proxies POST /api/services/test with JSON payload', async () => {
    vi.mocked(daemonAdminRequest).mockResolvedValueOnce({
      status: 200,
      body: { ok: true },
    });

    const request = new Request('http://localhost:3004/api/services/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'github' }),
    });

    const response = await postTest(request);

    expect(vi.mocked(daemonAdminRequest)).toHaveBeenCalledWith(
      '/v3/services/test',
      {
        method: 'POST',
        json: { provider: 'github' },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('returns 400 when setup payload is invalid JSON', async () => {
    const request = new Request('http://localhost:3004/api/services/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });

    const response = await postSetup(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Request body must be valid JSON',
    });
    expect(vi.mocked(daemonAdminRequest)).not.toHaveBeenCalled();
  });
});
