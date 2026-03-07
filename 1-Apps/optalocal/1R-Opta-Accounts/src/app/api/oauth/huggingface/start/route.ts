/**
 * GET /api/oauth/huggingface/start?return_to=<path>
 *
 * Initiates the Hugging Face OAuth2 PKCE flow for Inference API access.
 * Generates a code verifier + challenge, stores them in a short-lived
 * HttpOnly PKCE cookie, then redirects to HF's authorization endpoint.
 *
 * Scopes requested:
 *   - inference-api  → serverless inference on HF-hosted models
 *   - read-repos     → read model cards / metadata
 *
 * Auth: Supabase session required (user must be signed in).
 */

import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedRedirect } from '@/lib/allowed-redirects';

export const dynamic = 'force-dynamic';

const PKCE_COOKIE_NAME = 'opta_hf_pkce';
const PKCE_COOKIE_MAX_AGE = 600; // 10 minutes
const PKCE_COOKIE_PATH = '/api/oauth/huggingface';

const HF_SCOPES = ['inference-api', 'read-repos'].join(' ');

export async function GET(request: Request) {
  const clientId = process.env.HUGGINGFACE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'huggingface_not_configured' }, { status: 503 });
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

  const url = new URL(request.url);
  const rawReturnTo = url.searchParams.get('return_to') ?? '';
  const returnTo = isAllowedRedirect(rawReturnTo) ? rawReturnTo : '/connections';

  // PKCE: code_verifier → code_challenge (S256)
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');

  const cookieValue = JSON.stringify({ verifier, returnTo, state });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const redirectUri = `${siteUrl}/api/oauth/huggingface/callback`;

  const hfParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: HF_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://huggingface.co/oauth/authorize?${hfParams.toString()}`;

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
