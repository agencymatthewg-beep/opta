import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sanitizeRedirect } from '@/lib/allowed-redirects';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.optalocal.com' : undefined;

function isAbsoluteRedirect(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol.length > 0;
  } catch {
    return false;
  }
}

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
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

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
      // Absolute redirects include https/http and app deep links (e.g. opta-life://...).
      if (isAbsoluteRedirect(destination)) {
        return NextResponse.redirect(destination);
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
