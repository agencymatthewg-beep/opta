/**
 * OAuth callback route handler.
 *
 * After the user completes the OAuth consent screen (Google or Apple),
 * the provider redirects back here with a `code` query parameter.
 * This route exchanges the code for a Supabase session, then redirects
 * the user to their intended destination (or `/` by default).
 *
 * On failure, redirects to `/sign-in?error=auth` so the sign-in page
 * can display an appropriate error message.
 */

import { NextResponse } from 'next/server';
import { sanitizeNextPath } from '@/lib/auth-utils';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNextPath(searchParams.get('next')) ?? '/';

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth`);
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to sign-in with error indicator
  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
