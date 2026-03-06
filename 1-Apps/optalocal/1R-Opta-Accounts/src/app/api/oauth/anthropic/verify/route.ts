import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptOAuthToken } from '@/lib/oauth/token-crypto';
import { asObject, parseString } from '@/lib/api/policy';

export const dynamic = 'force-dynamic';

const ANTHROPIC_VERIFY_URL = 'https://api.anthropic.com/v1/messages';

/**
 * POST /api/oauth/anthropic/verify
 *
 * Validates an Anthropic setup-token by making a minimal API call, then
 * stores the token encrypted in accounts_provider_connections.
 *
 * Body: { setup_token: string }
 *
 * The setup-token is obtained from `opta auth token` or `claude setup-token`.
 * It is NOT a standard OAuth token — Anthropic does not support OAuth for API access.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = asObject(await request.json().catch(() => ({})));
  const setupToken = parseString(body.setup_token, 512);
  if (!setupToken) {
    return NextResponse.json({ error: 'setup_token_required' }, { status: 400 });
  }

  // Validate the token with a minimal API call (count tokens, cheapest endpoint)
  const verifyRes = await fetch(ANTHROPIC_VERIFY_URL, {
    method: 'POST',
    headers: {
      'x-api-key': setupToken,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });

  // 401 = invalid key, 403 = no access — both are token failures
  if (verifyRes.status === 401 || verifyRes.status === 403) {
    return NextResponse.json({ error: 'invalid_setup_token' }, { status: 422 });
  }

  // Any other non-2xx from Anthropic (rate limits, etc.) still means the token format is valid
  // Only reject on explicit auth errors
  if (verifyRes.status !== 200 && verifyRes.status !== 400) {
    // 400 can occur for model params but means auth succeeded — still accept the token
    const isAuthError = verifyRes.status === 401 || verifyRes.status === 403;
    if (isAuthError) {
      return NextResponse.json({ error: 'invalid_setup_token' }, { status: 422 });
    }
  }

  const tokenPayload = JSON.stringify({
    api_key: setupToken,
    obtained_at: new Date().toISOString(),
    connected_method: 'setup_token',
  });

  const { error: dbError } = await supabase
    .from('accounts_provider_connections')
    .upsert(
      {
        user_id: user.id,
        provider: 'anthropic',
        status: 'connected',
        token_encrypted: encryptOAuthToken(tokenPayload),
        connected_via: 'setup_token',
        meta: { connectedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );

  if (dbError?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
  }
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true, provider: 'anthropic', status: 'connected' });
}
