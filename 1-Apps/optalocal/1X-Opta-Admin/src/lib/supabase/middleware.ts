import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.optalocal.com' : undefined;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const path = request.nextUrl.pathname;
    const allowWhenAuthUnavailable = path === '/api/health' || path === '/unauthorized';

    // Fail closed in production if auth env is missing, while preserving
    // health probe visibility for status monitoring.
    if (process.env.NODE_ENV === 'production' && !allowWhenAuthUnavailable) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Auth backend unavailable' }, { status: 503 });
      }

      const redirect = request.nextUrl.clone();
      redirect.pathname = '/unauthorized';
      return NextResponse.redirect(redirect);
    }

    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>,
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            domain: COOKIE_DOMAIN,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
          }),
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isHealthEndpoint = path === '/api/health';

  // Protect all routes except the public health endpoint and /unauthorized.
  if (path !== '/unauthorized' && !isHealthEndpoint) {
    if (!user || user.email !== 'agencymatthewg@gmail.com') {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      } else {
        const redirect = request.nextUrl.clone();
        redirect.pathname = '/unauthorized';
        return NextResponse.redirect(redirect);
      }
    }
  }

  return supabaseResponse;
}
