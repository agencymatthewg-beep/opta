/**
 * Supabase server client with .optalocal.com cookie domain for SSO.
 *
 * In production, all auth cookies are set on the parent domain so that
 * sessions are shared across *.optalocal.com subdomains. In development,
 * the domain is omitted (localhost cookies work without a domain).
 */

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { parseBearerToken } from './auth-header';

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

export async function createClient() {
  const config = resolveSupabaseConfig();
  if (!config) return null;
  const { url, key } = config;

  // API routes can authenticate with Authorization: Bearer <access_token>
  // (used by CLI/Desktop machine-to-machine calls). Prefer this when present.
  try {
    const headerStore = await headers();
    const bearerToken = parseBearerToken(headerStore.get('authorization'));
    if (bearerToken) {
      return createSupabaseClient(url, key, {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    }
  } catch {
    // No request header context (or unavailable in this execution path) — fallback to cookies.
  }

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
