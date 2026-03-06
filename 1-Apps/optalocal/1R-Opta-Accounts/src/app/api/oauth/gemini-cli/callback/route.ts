/**
 * GET /api/oauth/gemini-cli/callback?code=...&state=...
 *
 * OAuth2 PKCE callback for the Gemini CLI flow.
 * Validates CSRF state, exchanges the authorization code for tokens,
 * encrypts the token payload, and persists it to accounts_provider_connections.
 *
 * On success: redirects to returnTo (from PKCE cookie) or '/connections'.
 * On error:   redirects to '/connections?error=<reason>'.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptOAuthToken } from '@/lib/oauth/token-crypto';
import { sanitizeRedirect } from '@/lib/allowed-redirects';

export const dynamic = 'force-dynamic';

const PKCE_COOKIE_NAME = 'opta_gemini_pkce';
const PKCE_COOKIE_PATH = '/api/oauth/gemini-cli';

interface PkceCookiePayload {
  verifier: string;
  returnTo: string;
  state: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
  expires_in: number;
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

  // If Google returned an error (e.g. user denied), redirect immediately.
  if (errorParam) {
    return NextResponse.redirect(new URL('/connections?error=gemini_oauth_denied', url.origin));
  }

  // Read the PKCE cookie from the incoming request's Cookie header.
  const cookieHeader = request.headers.get('cookie') ?? '';
  const rawPkceCookie = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${PKCE_COOKIE_NAME}=`))
    ?.slice(PKCE_COOKIE_NAME.length + 1);

  const pkce = parsePkceCookie(rawPkceCookie ? decodeURIComponent(rawPkceCookie) : undefined);

  // Validate CSRF state and cookie presence.
  if (!pkce || !stateParam || pkce.state !== stateParam || !code) {
    return NextResponse.redirect(new URL('/connections?error=invalid_state', url.origin));
  }

  const { verifier, returnTo } = pkce;

  // Exchange authorization code for tokens.
  const clientId = process.env.GEMINI_CLI_OAUTH_CLIENT_ID ?? '';
  const clientSecret = process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const redirectUri = `${siteUrl}/api/oauth/gemini-cli/callback`;

  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });

  let tokenData: GoogleTokenResponse;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errBody = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
      console.error('[gemini-cli/callback] token exchange failed', errBody);
      return NextResponse.redirect(new URL('/connections?error=gemini_oauth_denied', url.origin));
    }

    tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  } catch (err) {
    console.error('[gemini-cli/callback] token exchange network error', err);
    return NextResponse.redirect(new URL('/connections?error=gemini_oauth_denied', url.origin));
  }

  // Build the encrypted token payload for storage.
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const tokenPayload = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    expiry_date: expiresAt.getTime(),
  };

  let tokenEncrypted: string;
  try {
    tokenEncrypted = encryptOAuthToken(JSON.stringify(tokenPayload));
  } catch (err) {
    console.error('[gemini-cli/callback] encryption failed', err);
    return NextResponse.redirect(new URL('/connections?error=gemini_oauth_denied', url.origin));
  }

  // Authenticate the current user via Supabase session.
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL('/connections?error=gemini_oauth_denied', url.origin));
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/connections?error=invalid_state', url.origin));
  }

  // Upsert connection record.
  const { error: dbError } = await supabase.from('accounts_provider_connections').upsert(
    {
      user_id: user.id,
      provider: 'gemini-cli',
      status: 'connected',
      token_encrypted: tokenEncrypted,
      token_expires_at: expiresAt.toISOString(),
      token_scope: tokenData.scope,
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
    console.error('[gemini-cli/callback] db upsert failed', dbError);
    return NextResponse.redirect(new URL('/connections?error=gemini_oauth_denied', url.origin));
  }

  // Redirect to the intended destination (or /connections) and clear the PKCE cookie.
  const destination = sanitizeRedirect(returnTo);
  const redirectUrl = destination.startsWith('/')
    ? new URL(destination, url.origin).toString()
    : destination;

  const response = NextResponse.redirect(redirectUrl);
  clearPkceCookie(response);
  return response;
}
