/**
 * Supabase server client factory with .optalocal.com cookie domain for SSO.
 *
 * Creates a Supabase client configured for server-side usage in
 * Server Components, Server Actions, and Route Handlers. Reads and
 * writes auth cookies via the Next.js `cookies()` API.
 *
 * The `setAll` call is wrapped in a try/catch because it will throw
 * when called from a Server Component (cookies are read-only there).
 * The middleware handles session refresh in that case.
 *
 * In production, cookies use `.optalocal.com` domain for SSO across
 * all Opta subdomains. In development, domain is omitted.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? ".optalocal.com" : undefined;

/**
 * Returns null if env vars are not configured (build-time safety).
 */
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
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax" as const,
            }),
          );
        } catch {
          // Called from a Server Component — middleware handles refresh
        }
      },
    },
  });
}
