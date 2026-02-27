import { describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';
import { updateSession } from '@/lib/supabase/middleware';

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
}));

function makeRequest(url: string, forwardedProto?: string) {
  return {
    headers: new Headers(
      forwardedProto ? { 'x-forwarded-proto': forwardedProto } : undefined,
    ),
    nextUrl: new URL(url),
  };
}

describe('proxy auth gate', () => {
  it('passes through in LAN mode (http)', async () => {
    const response = await proxy(
      makeRequest('http://localhost:3004/sessions') as Parameters<typeof proxy>[0],
    );

    expect(vi.mocked(updateSession)).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('delegates to updateSession in cloud mode (https)', async () => {
    const cloudResponse = new Response(null, { status: 204 });
    vi.mocked(updateSession).mockResolvedValueOnce(
      cloudResponse as Awaited<ReturnType<typeof updateSession>>,
    );
    const request = makeRequest('https://optalocal.com/sessions');

    const response = await proxy(request as Parameters<typeof proxy>[0]);

    expect(vi.mocked(updateSession)).toHaveBeenCalledWith(request);
    expect(response).toBe(cloudResponse);
  });
});
