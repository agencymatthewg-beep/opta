import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptOAuthToken } from '@/lib/oauth/token-crypto';

export const dynamic = 'force-dynamic';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const CODEX_COOKIE = 'opta_codex_device';
const DEVICE_FLOW_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

type PollStatus = 'authorized' | 'pending' | 'expired' | 'denied' | 'error';

type GitHubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
};

/**
 * POST /api/oauth/codex/device/poll
 *
 * Polls GitHub for Device Flow completion for OpenAI Codex authorization.
 * Reads device_code from the HttpOnly cookie set by /device/start — it is
 * never sent to or from clients.
 *
 * Response: { status: 'authorized' | 'pending' | 'expired' | 'denied' | 'error' }
 *
 * On 'authorized': encrypts token and writes to accounts_provider_connections
 * with provider 'openai-codex', then clears the device_code cookie.
 */
export async function POST() {
  const clientId = process.env.OPENAI_CODEX_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OPENAI_CODEX_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'openai_codex_not_configured' }, { status: 503 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const cookieStore = await cookies();
  const deviceCode = cookieStore.get(CODEX_COOKIE)?.value;
  if (!deviceCode) {
    return NextResponse.json({ error: 'no_active_device_flow' }, { status: 400 });
  }

  const ghRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      device_code: deviceCode,
      grant_type: DEVICE_FLOW_GRANT,
    }),
  });

  const ghData = await ghRes.json() as GitHubTokenResponse;

  // Success — token granted
  if (ghData.access_token) {
    const tokenPayload = JSON.stringify({
      access_token: ghData.access_token,
      token_type: ghData.token_type ?? 'Bearer',
      scope: ghData.scope ?? 'codex',
      obtained_at: new Date().toISOString(),
    });

    const { error: dbError } = await supabase
      .from('accounts_provider_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'openai-codex',
          status: 'connected',
          token_encrypted: encryptOAuthToken(tokenPayload),
          token_scope: ghData.scope ?? 'codex',
          connected_via: 'device_flow',
          meta: { connectedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );

    if (dbError?.code === 'PGRST205') {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
    }
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const response = NextResponse.json({ status: 'authorized' as PollStatus });
    response.cookies.delete(CODEX_COOKIE);
    return response;
  }

  // Pending states
  const errorCode = ghData.error;
  if (errorCode === 'authorization_pending' || errorCode === 'slow_down') {
    return NextResponse.json({ status: 'pending' as PollStatus });
  }

  // Terminal error states — clear the cookie
  const response = NextResponse.json({
    status: (
      errorCode === 'expired_token' ? 'expired' :
      errorCode === 'access_denied' ? 'denied' :
      'error'
    ) as PollStatus,
  });
  response.cookies.delete(CODEX_COOKIE);
  return response;
}
