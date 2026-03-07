import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const GITHUB_DEVICE_URL = 'https://github.com/login/device/code';
const CODEX_COOKIE = 'opta_codex_device';

type GitHubDeviceResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

/**
 * POST /api/oauth/codex/device/start
 *
 * Initiates GitHub Device Flow (RFC 8628) for OpenAI Codex authorization.
 * OpenAI Codex uses GitHub OAuth under the hood (different client_id from Copilot).
 * Stores device_code in an HttpOnly cookie — never exposed to the browser.
 *
 * Response: { user_code, verification_uri, expires_in, interval }
 * The client shows user_code and opens verification_uri, then polls /device/poll.
 */
export async function POST() {
  const clientId = process.env.OPENAI_CODEX_GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'openai_codex_not_configured' }, { status: 503 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const ghRes = await fetch(GITHUB_DEVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, scope: 'codex' }),
  });

  if (!ghRes.ok) {
    return NextResponse.json({ error: 'github_device_code_request_failed' }, { status: 502 });
  }

  const ghData = await ghRes.json() as GitHubDeviceResponse;
  if (!ghData.device_code || !ghData.user_code) {
    return NextResponse.json({ error: 'invalid_github_response' }, { status: 502 });
  }

  const response = NextResponse.json({
    user_code: ghData.user_code,
    verification_uri: ghData.verification_uri,
    expires_in: ghData.expires_in,
    interval: ghData.interval,
  });

  // Store device_code server-side — clients never see it
  response.cookies.set(CODEX_COOKIE, ghData.device_code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ghData.expires_in,
    path: '/api/oauth/codex',
  });

  return response;
}
