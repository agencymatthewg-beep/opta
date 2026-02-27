/**
 * Supabase browser client factory.
 *
 * Creates a Supabase client configured for browser-side usage.
 * Uses `createBrowserClient` from @supabase/ssr which automatically
 * manages auth tokens via cookies for Next.js App Router compatibility.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Returns null if env vars are not configured (e.g. during next build
 * pre-rendering or LAN-only deployments without Supabase).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createBrowserClient(url, key);
}

export type SupabaseBrowserClient = NonNullable<ReturnType<typeof createClient>>;
