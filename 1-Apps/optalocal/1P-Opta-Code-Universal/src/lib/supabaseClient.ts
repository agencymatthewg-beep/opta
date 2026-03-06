/**
 * supabaseClient.ts — Supabase browser client for Opta Code Desktop.
 *
 * Uses PKCE flow (required for native Tauri apps) with localStorage persistence.
 * Env vars (VITE_ prefix = safe to bundle in client):
 *   VITE_SUPABASE_URL      — https://cytjsmezydytbmjrolyz.supabase.co
 *   VITE_SUPABASE_ANON_KEY — public anon JWT
 *
 * detectSessionInUrl is false because we handle deep-link callbacks manually
 * via exchangeNativeAuthCode() — letting Supabase auto-detect would fail since
 * the opta-code:// URL never appears in window.location.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
