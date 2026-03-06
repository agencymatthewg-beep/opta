/**
 * auth.ts — Native Supabase PKCE auth for Opta Code Desktop.
 *
 * Flow (Tauri native):
 *   1. startNativeOAuthFlow() → gets OAuth URL from Supabase, opens via OS browser
 *   2. User completes OAuth (Google/Apple) in system browser
 *   3. Browser redirects to opta-code://auth/callback?code=...
 *   4. Tauri deep-link fires → deepLinks.ts calls exchangeNativeAuthCode(url)
 *   5. Supabase exchanges PKCE code for session, stores in localStorage
 *   6. onAuthStateChange listeners fire with the new session
 *
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in env.
 * Supabase project must allow opta-code://auth/callback as a redirect URI.
 */
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import { openUrl } from "./openUrl";

export type OAuthProvider = "google" | "apple";

/** Opens the system browser to start OAuth. Returns immediately — session
 *  arrives later via deep link + exchangeNativeAuthCode. */
export async function startNativeOAuthFlow(
  provider: OAuthProvider = "google",
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local.",
    );
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: "opta-code://auth/callback",
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error("No OAuth URL returned from Supabase");

  await openUrl(data.url);
}

/** Called by the deep-link handler after the OS opens opta-code://auth/callback?code=...
 *  Exchanges the PKCE code for a real session. The Supabase client stores it in localStorage
 *  and fires onAuthStateChange. */
export async function exchangeNativeAuthCode(
  callbackUrl: string,
): Promise<Session> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.auth.exchangeCodeForSession(callbackUrl);
  if (error) throw error;
  if (!data.session) throw new Error("No session returned after PKCE exchange");

  return data.session;
}

/** Returns the current session, or null if not authenticated. */
export async function getNativeSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Signs out and clears the local session. */
export async function signOutNative(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Subscribes to auth state changes. Returns an unsubscribe function. */
export function onNativeAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}

export { isSupabaseConfigured };
