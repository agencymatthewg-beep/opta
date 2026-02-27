'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SupabaseBrowserClient = SupabaseClient;

let cachedClient: SupabaseBrowserClient | null | undefined;

function getClientConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function createClient(): SupabaseBrowserClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const config = getClientConfig();
  if (!config) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createBrowserClient(config.url, config.anonKey);
  return cachedClient;
}
