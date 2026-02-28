import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sanitizeRedirect } from '@/lib/allowed-redirects';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.optalocal.com' : undefined;

/**
 * OAuth callback handler.
 *
 * Supabase redirects here after Google/Apple sign-in with a `code` param.
 * We exchange it for a session, set cookies on .optalocal.com, and redirect
 * the user to their destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.redirect(`${origin}/sign-in?error=config`);
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              domain: COOKIE_DOMAIN,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const,
            }),
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination = sanitizeRedirect(next);
      // If destination is an absolute URL (external redirect), go there
      if (destination.startsWith('http')) {
        return NextResponse.redirect(destination);
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
