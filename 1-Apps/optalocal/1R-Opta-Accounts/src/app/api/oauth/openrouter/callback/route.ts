/**
 * GET /api/oauth/openrouter/callback?code=...&state=...
 *
 * OAuth2 PKCE callback for the OpenRouter flow.
 * Validates CSRF state, exchanges the authorization code for an API key,
 * encrypts the token payload, and persists it to accounts_provider_connections.
 *
 * OpenRouter PKCE returns a provisioned API key (not a short-lived access_token).
 * The key has no expiry — we default to 1 year for housekeeping.
 *
 * On success: redirects to returnTo (from PKCE cookie) or '/connections'.
 * On error:   redirects to '/connections?error=<reason>'.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptOAuthToken } from '@/lib/oauth/token-crypto';
import { sanitizeRedirect } from '@/lib/allowed-redirects';

export const dynamic = 'force-dynamic';

const PKCE_COOKIE_NAME = 'opta_openrouter_pkce';
const PKCE_COOKIE_PATH = '/api/oauth/openrouter';

interface PkceCookiePayload {
  verifier: string;
  returnTo: string;
  state: string;
}

interface OpenRouterKeyResponse {
  key: string;
}

function parsePkceCookie(raw: string | undefined): PkceCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.verifier !== 'string' ||
      typeof parsed.returnTo !== 'string' ||
      typeof parsed.state !== 'string'
    ) {
      return null;
    }
    return { verifier: parsed.verifier, returnTo: parsed.returnTo, state: parsed.state };
  } catch {
    return null;
  }
}

function clearPkceCookie(response: NextResponse): void {
  response.cookies.set(PKCE_COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: PKCE_COOKIE_PATH,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(new URL('/connections?error=openrouter_oauth_denied', url.origin));
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const rawPkceCookie = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${PKCE_COOKIE_NAME}=`))
    ?.slice(PKCE_COOKIE_NAME.length + 1);

  const pkce = parsePkceCookie(rawPkceCookie ? decodeURIComponent(rawPkceCookie) : undefined);

  if (!pkce || !stateParam || pkce.state !== stateParam || !code) {
    return NextResponse.redirect(new URL('/connections?error=invalid_state', url.origin));
  }

  const { verifier, returnTo } = pkce;

  const clientId = process.env.OPENROUTER_OAUTH_CLIENT_ID ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const redirectUri = `${siteUrl}/api/oauth/openrouter/callback`;

  // OpenRouter PKCE token exchange — returns { key: "sk-or-..." }
  let tokenData: OpenRouterKeyResponse;
  try {
    const tokenRes = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        client_id: clientId,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
      console.error('[openrouter/callback] token exchange failed', errBody);
      return NextResponse.redirect(
        new URL('/connections?error=openrouter_oauth_denied', url.origin),
      );
    }

    tokenData = (await tokenRes.json()) as OpenRouterKeyResponse;
  } catch (err) {
    console.error('[openrouter/callback] token exchange network error', err);
    return NextResponse.redirect(new URL('/connections?error=openrouter_oauth_denied', url.origin));
  }

  if (!tokenData.key) {
    console.error('[openrouter/callback] no key in response');
    return NextResponse.redirect(new URL('/connections?error=openrouter_oauth_denied', url.origin));
  }

  // OpenRouter API keys don't expire — store with 1-year TTL for housekeeping
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const tokenPayload = {
    access_token: tokenData.key,
    refresh_token: null,
    token_type: 'bearer',
    scope: 'all',
    expiry_date: expiresAt.getTime(),
  };

  let tokenEncrypted: string;
  try {
    tokenEncrypted = encryptOAuthToken(JSON.stringify(tokenPayload));
  } catch (err) {
    console.error('[openrouter/callback] encryption failed', err);
    return NextResponse.redirect(new URL('/connections?error=openrouter_oauth_denied', url.origin));
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL('/connections?error=openrouter_oauth_denied', url.origin));
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/connections?error=invalid_state', url.origin));
  }

  const { error: dbError } = await supabase.from('accounts_provider_connections').upsert(
    {
      user_id: user.id,
      provider: 'openrouter',
      status: 'connected',
      token_encrypted: tokenEncrypted,
      token_expires_at: expiresAt.toISOString(),
      token_scope: 'all',
      connected_via: 'oauth_pkce',
      meta: { connectedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );

  if (dbError) {
    if (dbError.code === 'PGRST205') {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
    }
    console.error('[openrouter/callback] db upsert failed', dbError);
    return NextResponse.redirect(
      new URL('/connections?error=openrouter_oauth_denied', url.origin),
    );
  }

  const destination = sanitizeRedirect(returnTo);
  const redirectUrl = destination.startsWith('/')
    ? new URL(destination, url.origin).toString()
    : destination;

  const response = NextResponse.redirect(redirectUrl);
  clearPkceCookie(response);
  return response;
}
