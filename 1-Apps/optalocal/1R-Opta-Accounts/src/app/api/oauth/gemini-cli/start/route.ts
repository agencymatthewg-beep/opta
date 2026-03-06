/**
 * GET /api/oauth/gemini-cli/start?return_to=<path>
 *
 * Initiates the Google OAuth2 PKCE flow for Gemini CLI access.
 * Generates a code verifier + challenge, stores them in a short-lived
 * HttpOnly PKCE cookie, then redirects to Google's authorization endpoint.
 *
 * Auth: Supabase session (cookie or Bearer token via createClient).
 * The user must be signed in before connecting a Gemini CLI OAuth token.
 */

import { createHash, randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isAllowedRedirect } from '@/lib/allowed-redirects';

export const dynamic = 'force-dynamic';

const PKCE_COOKIE_NAME = 'opta_gemini_pkce';
const PKCE_COOKIE_MAX_AGE = 600; // 10 minutes
const PKCE_COOKIE_PATH = '/api/oauth/gemini-cli';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/generative-language',
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
  'profile',
].join(' ');

export async function GET(request: Request) {
  const clientId = process.env.GEMINI_CLI_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'gemini_cli_not_configured' }, { status: 503 });
  }

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

  // Parse return_to — only allow relative or optalocal.com URLs
  const url = new URL(request.url);
  const rawReturnTo = url.searchParams.get('return_to') ?? '';
  const returnTo = isAllowedRedirect(rawReturnTo) ? rawReturnTo : '/connections';

  // PKCE: code_verifier → code_challenge (S256)
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  // CSRF state
  const state = randomBytes(16).toString('base64url');

  // Store verifier + returnTo + state in a short-lived HttpOnly cookie.
  // We set it on NextResponse (cookies().set is read-only in route handlers
  // for response cookies; we must use NextResponse.cookies.set instead).
  const cookieValue = JSON.stringify({ verifier, returnTo, state });

  // Build Google authorization URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const redirectUri = `${siteUrl}/api/oauth/gemini-cli/callback`;

  const googleParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`;

  // Set the PKCE cookie on a NextResponse, then redirect.
  // We cannot call redirect() and also set cookies via next/headers in the
  // same route handler — instead we return a 302 response manually.
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(PKCE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    maxAge: PKCE_COOKIE_MAX_AGE,
    path: PKCE_COOKIE_PATH,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
