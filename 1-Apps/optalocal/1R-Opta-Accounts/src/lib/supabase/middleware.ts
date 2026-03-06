/**
 * Supabase middleware helper — session refresh with .optalocal.com cookie domain.
 *
 * Bridges cookies between the incoming request and outgoing response,
 * refreshing the session token if expired. Sets cookies on the parent
 * domain for cross-subdomain SSO.
 *
 * IMPORTANT: Do not add logic between `createServerClient` and
 * `supabase.auth.getUser()`.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.optalocal.com' : undefined;

function resolveSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

type UpdateSessionOptions = {
  requestHeaders?: Headers;
};

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

  const config = resolveSupabaseConfig();
  if (!config) return supabaseResponse;
  const { url, key } = config;

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

  // IMPORTANT: Do not add logic between createServerClient and getUser().
  await supabase.auth.getUser();

  return supabaseResponse;
}
