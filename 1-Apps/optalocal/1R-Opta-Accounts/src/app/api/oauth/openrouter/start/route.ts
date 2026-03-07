/**
 * GET /api/oauth/openrouter/start?return_to=<path>
 *
 * Initiates the OpenRouter OAuth PKCE flow.
 * OpenRouter is registration-free — no client_id or app credentials required.
 * The callback_url is embedded directly in the auth request. State is embedded
 * in the callback_url so OpenRouter returns it when redirecting back.
 *
 * Docs: https://openrouter.ai/docs/use-cases/oauth
 *
 * Auth: Supabase session required.
 */

import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedRedirect } from '@/lib/allowed-redirects';

export const dynamic = 'force-dynamic';

const PKCE_COOKIE_NAME = 'opta_openrouter_pkce';
const PKCE_COOKIE_MAX_AGE = 600; // 10 minutes
const PKCE_COOKIE_PATH = '/api/oauth/openrouter';

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const rawReturnTo = url.searchParams.get('return_to') ?? '';
  const returnTo = isAllowedRedirect(rawReturnTo) ? rawReturnTo : '/connections';

  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');

  const cookieValue = JSON.stringify({ verifier, returnTo, state });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  // Embed state in callback_url — OpenRouter appends ?code=X to whatever URL we provide,
  // so ?state=Y becomes ?state=Y&code=X, enabling normal CSRF validation in the callback.
  const callbackUrl = `${siteUrl}/api/oauth/openrouter/callback?state=${encodeURIComponent(state)}`;

  const orParams = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://openrouter.ai/auth?${orParams.toString()}`;

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
