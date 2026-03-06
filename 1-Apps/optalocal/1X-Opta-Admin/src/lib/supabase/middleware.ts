import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.optalocal.com' : undefined;
const ADMIN_ALLOWLIST_ENV = 'OPTA_ADMIN_ALLOWED_EMAILS';

type UpdateSessionOptions = {
  requestHeaders?: Headers;
};

function parseAllowedAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();

  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function unauthorizedResponse(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const redirect = request.nextUrl.clone();
  redirect.pathname = '/unauthorized';
  return NextResponse.redirect(redirect);
}

export async function updateSession(
  request: NextRequest,
  options: UpdateSessionOptions = {},
) {
  const passthroughHeaders = options.requestHeaders ?? request.headers;
  const passthrough = () =>
    NextResponse.next({
      request: {
        headers: passthroughHeaders,
      },
    });

  let supabaseResponse = passthrough();

  const path = request.nextUrl.pathname;
  const isHealthEndpoint = path === '/api/health';
  const isUnauthorizedPage = path === '/unauthorized';
  const requiresAdminAuth = !isHealthEndpoint && !isUnauthorizedPage;
  const isProduction = process.env.NODE_ENV === 'production';

  const allowedAdminEmails = parseAllowedAdminEmails(
    process.env[ADMIN_ALLOWLIST_ENV],
  );
  const hasAllowlist = allowedAdminEmails.size > 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (requiresAdminAuth) {
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
        supabaseResponse = passthrough();
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

  if (requiresAdminAuth) {
    if (!user) {
      return unauthorizedResponse(request);
    }

    if (!hasAllowlist) {
      if (isProduction) {
        if (path.startsWith('/api/')) {
          return NextResponse.json(
            { error: `Admin allowlist missing: set ${ADMIN_ALLOWLIST_ENV}` },
            { status: 503 },
          );
        }

        const redirect = request.nextUrl.clone();
        redirect.pathname = '/unauthorized';
        return NextResponse.redirect(redirect);
      }

      return supabaseResponse;
    }

    const email = user.email?.toLowerCase();
    if (!email || !allowedAdminEmails.has(email)) {
      return unauthorizedResponse(request);
    }
  }

  return supabaseResponse;
}
