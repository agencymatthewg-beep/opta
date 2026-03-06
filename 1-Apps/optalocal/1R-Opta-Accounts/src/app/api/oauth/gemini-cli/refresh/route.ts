/**
 * POST /api/oauth/gemini-cli/refresh
 *
 * Refreshes the stored Gemini CLI OAuth access token using the saved
 * refresh_token. Updates the encrypted token and expiry in the database.
 *
 * Auth: Supabase session (cookie or Bearer token via createClient).
 *
 * Returns: { ok: true, expires_at: ISO string } on success.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptOAuthToken, decryptOAuthToken } from '@/lib/oauth/token-crypto';

export const dynamic = 'force-dynamic';

interface StoredTokenPayload {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  scope: string;
  expiry_date: number;
}

interface GoogleRefreshResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
}

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Fetch the existing connection record.
  const { data: connection, error: fetchError } = await supabase
    .from('accounts_provider_connections')
    .select('token_encrypted')
    .eq('user_id', user.id)
    .eq('provider', 'gemini-cli')
    .eq('status', 'connected')
    .maybeSingle();

  if (fetchError) {
    if (fetchError.code === 'PGRST205') {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!connection) {
    return NextResponse.json({ error: 'provider_not_connected' }, { status: 404 });
  }

  const record = connection as { token_encrypted: string | null };

  if (!record.token_encrypted) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 400 });
  }

  // Decrypt and parse the stored token payload.
  let stored: StoredTokenPayload;
  try {
    stored = JSON.parse(decryptOAuthToken(record.token_encrypted)) as StoredTokenPayload;
  } catch (err) {
    console.error('[gemini-cli/refresh] failed to decrypt token', err);
    return NextResponse.json({ error: 'token_decrypt_failed' }, { status: 500 });
  }

  if (!stored.refresh_token) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 400 });
  }

  // Exchange the refresh token with Google.
  const clientId = process.env.GEMINI_CLI_OAUTH_CLIENT_ID ?? '';
  const clientSecret = process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET ?? '';

  const refreshBody = new URLSearchParams({
    refresh_token: stored.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  let refreshed: GoogleRefreshResponse;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: refreshBody.toString(),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      console.error('[gemini-cli/refresh] Google refresh failed', errBody);
      return NextResponse.json({ error: 'token_refresh_failed' }, { status: 502 });
    }

    refreshed = (await res.json()) as GoogleRefreshResponse;
  } catch (err) {
    console.error('[gemini-cli/refresh] network error during refresh', err);
    return NextResponse.json({ error: 'token_refresh_failed' }, { status: 502 });
  }

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  // Build updated payload — preserve the existing refresh_token (Google may not return one on refresh).
  const updatedPayload: StoredTokenPayload = {
    access_token: refreshed.access_token,
    refresh_token: stored.refresh_token,
    token_type: refreshed.token_type,
    scope: refreshed.scope ?? stored.scope,
    expiry_date: newExpiresAt.getTime(),
  };

  let newTokenEncrypted: string;
  try {
    newTokenEncrypted = encryptOAuthToken(JSON.stringify(updatedPayload));
  } catch (err) {
    console.error('[gemini-cli/refresh] encryption failed', err);
    return NextResponse.json({ error: 'token_refresh_failed' }, { status: 500 });
  }

  // Persist the refreshed token.
  const { error: updateError } = await supabase
    .from('accounts_provider_connections')
    .update({
      token_encrypted: newTokenEncrypted,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('provider', 'gemini-cli');

  if (updateError) {
    if (updateError.code === 'PGRST205') {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expires_at: newExpiresAt.toISOString() });
}
