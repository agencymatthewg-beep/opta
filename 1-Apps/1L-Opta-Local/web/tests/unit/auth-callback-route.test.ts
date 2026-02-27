import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/auth/callback/route';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

type ExchangeResult = {
  auth: {
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
  };
};

function createSupabaseFixture(error: unknown = null): ExchangeResult {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error }),
    },
  };
}

describe('auth callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to a sanitized next path after successful auth exchange', async () => {
    const supabase = createSupabaseFixture();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await GET(
      new Request(
        'https://optalocal.com/auth/callback?code=oauth-code&next=%2Fsettings%3Ftab%3Daccount',
      ),
    );

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    expect(response.headers.get('location')).toBe(
      'https://optalocal.com/settings?tab=account',
    );
  });

  it('falls back to / when next points to an external URL', async () => {
    const supabase = createSupabaseFixture();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await GET(
      new Request(
        'https://optalocal.com/auth/callback?code=oauth-code&next=https%3A%2F%2Fevil.example%2Fsteal',
      ),
    );

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    expect(response.headers.get('location')).toBe('https://optalocal.com/');
  });
});
