/**
 * Supabase server client with .optalocal.com cookie domain for SSO.
 *
 * In production, all auth cookies are set on the parent domain so that
 * sessions are shared across *.optalocal.com subdomains. In development,
 * the domain is omitted (localhost cookies work without a domain).
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? '.optalocal.com' : undefined;

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
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
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              domain: COOKIE_DOMAIN,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const,
            }),
          );
        } catch {
          // Called from a Server Component — middleware handles refresh
        }
      },
    },
  });
}
