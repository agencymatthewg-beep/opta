import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  consumeCliHandoff,
  isValidCliHandoff,
  isValidCliState,
  parseCliCallbackPort,
  peekCliHandoff,
} from '@/lib/cli/handoff';
import { registerCliTokenRelay } from '@/lib/cli/token-relay';

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
 *   4. This route mints a short-lived one-time relay code and redirects to
 *      http://127.0.0.1:PORT/callback?exchange_code=...&state=CSRF
 *      (plus optional return_to/handoff values for desktop deep-link handoff).
 *   5. CLI exchanges exchange_code at /api/cli/exchange over HTTPS.
 *
 * Security:
 *   - Only redirects to 127.0.0.1 (never 0.0.0.0 or external hosts)
 *   - CSRF state parameter is passed through for CLI verification
 *   - Session tokens are never placed directly on localhost callback query params
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const portRaw = searchParams.get('port');
  const state = searchParams.get('state')?.trim() ?? '';
  const handoffRaw = searchParams.get('handoff');
  const proofRaw = searchParams.get('proof');
  const port = parseCliCallbackPort(portRaw);
  const handoff = handoffRaw?.trim() ?? '';
  const proof = proofRaw?.trim() ?? '';

  if (!port || !isValidCliState(state)) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_params`);
  }
  if (handoff.length > 0 && !isValidCliHandoff(handoff)) {
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_handoff`);
  }
  const pendingHandoff = peekCliHandoff({
    state,
    port,
    handoff: handoff.length > 0 ? handoff : null,
    proof: proof.length > 0 ? proof : null,
  });
  if (!pendingHandoff) {
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_cli_handoff`);
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
  let consumedHandoff: Awaited<ReturnType<typeof consumeCliHandoff>>;
  try {
    consumedHandoff = await consumeCliHandoff({
      state,
      port,
      handoff: handoff.length > 0 ? handoff : null,
      proof: proof.length > 0 ? proof : null,
    });
  } catch (error) {
    console.error('[cli/callback] replay-store consume failed', error);
    return NextResponse.redirect(`${origin}/sign-in?error=cli_replay_store`);
  }
  if (!consumedHandoff) {
    return NextResponse.redirect(`${origin}/sign-in?error=invalid_cli_handoff`);
  }

  const relay = registerCliTokenRelay({
    state,
    port,
    handoff: consumedHandoff.handoff,
    returnTo: consumedHandoff.returnTo,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
    tokenType: session.token_type ?? null,
    providerToken: session.provider_token ?? null,
    providerRefreshToken: session.provider_refresh_token ?? null,
  });

  // Build the CLI callback URL (127.0.0.1 only, one-time exchange code)
  const callbackUrl = new URL(`http://127.0.0.1:${port}/callback`);
  callbackUrl.searchParams.set('exchange_code', relay.code);
  callbackUrl.searchParams.set('exchange_expires_at', String(relay.expiresAt));
  callbackUrl.searchParams.set('state', state);
  if (consumedHandoff.returnTo) {
    callbackUrl.searchParams.set('return_to', consumedHandoff.returnTo);
  }
  if (consumedHandoff.handoff) {
    callbackUrl.searchParams.set('handoff', consumedHandoff.handoff);
  }

  return NextResponse.redirect(callbackUrl.toString());
}
