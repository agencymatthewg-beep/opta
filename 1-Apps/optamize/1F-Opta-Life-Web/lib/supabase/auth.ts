import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "./tokens";

/**
 * Get the current authenticated Supabase user
 */
export async function getUser() {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get the current Supabase session
 */
export async function getSession() {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  return session;
}

/**
 * Get a valid Google access token for the current user
 * Combines user authentication check with token retrieval
 */
export async function getGoogleToken(): Promise<string | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }

  return await getGoogleAccessToken(user.id);
}
