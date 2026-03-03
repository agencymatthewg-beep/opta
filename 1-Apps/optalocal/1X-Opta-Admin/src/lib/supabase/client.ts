import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Returns null if env vars are absent (build safety).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createBrowserClient(url, key);
}
