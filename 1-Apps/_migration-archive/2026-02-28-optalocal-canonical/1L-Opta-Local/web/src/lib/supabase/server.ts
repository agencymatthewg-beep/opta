import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SupabaseServerClient = SupabaseClient;

type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
};

export async function createClient(): Promise<SupabaseServerClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const store = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          (store as unknown as {
            set: (name: string, value: string, options?: CookieOptions) => void;
          }).set(name, value, options);
        } catch {
          // Ignore writes in read-only rendering contexts.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          (store as unknown as {
            set: (name: string, value: string, options?: CookieOptions) => void;
          }).set(name, '', { ...options, maxAge: 0 });
        } catch {
          // Ignore writes in read-only rendering contexts.
        }
      },
    },
  });
}
