import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * CLI callback relay.
 *
 * After the user signs in via the portal, this route relays the session
 * tokens to the CLI's ephemeral localhost HTTP server.
 *
 * Flow:
 *   1. CLI navigates browser to /sign-in?mode=cli&port=PORT&state=CSRF
 *   2. User signs in (OAuth or password)
 *   3. Sign-in page redirects to /cli/callback?port=PORT&state=CSRF
 *   4. This route reads the server session and redirects to
 *      http://127.0.0.1:PORT/callback?access_token=...&refresh_token=...&state=CSRF
 *
 * Security:
 *   - Only redirects to 127.0.0.1 (never 0.0.0.0 or external hosts)
 *   - CSRF state parameter is passed through for CLI verification
 *   - Tokens are short-lived; refresh token enables persistence
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const port = searchParams.get('port');
  const state = searchParams.get('state');

  if (!port || !state) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_params`);
  }

  // Validate port is numeric
  if (!/^\d+$/.test(port)) {
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_port`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/sign-in?error=config`);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(`${origin}/sign-in?error=no_session`);
  }

  // Build the CLI callback URL (127.0.0.1 only)
  const callbackUrl = new URL(`http://127.0.0.1:${port}/callback`);
  callbackUrl.searchParams.set('access_token', session.access_token);
  callbackUrl.searchParams.set('refresh_token', session.refresh_token);
  callbackUrl.searchParams.set('expires_at', String(session.expires_at ?? ''));
  callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl.toString());
}
