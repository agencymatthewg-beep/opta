/**
 * Supabase auth server actions.
 *
 * Provides OAuth sign-in (Google, Apple) and sign-out as Next.js
 * Server Actions. These are invoked from client components via
 * form actions or direct calls. Each action creates a fresh
 * Supabase server client, performs the auth operation, and
 * redirects the user.
 */

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Initiate Google OAuth sign-in flow.
 * Redirects the user to Google's consent screen, then back to
 * `/auth/callback` where the code is exchanged for a session.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) throw error;
  if (data.url) redirect(data.url);
}

/**
 * Initiate Apple OAuth sign-in flow.
 * Redirects the user to Apple's consent screen, then back to
 * `/auth/callback` where the code is exchanged for a session.
 */
export async function signInWithApple() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) throw error;
  if (data.url) redirect(data.url);
}

/**
 * Sign the current user out and redirect to the home page.
 */
export async function signOut() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');
  await supabase.auth.signOut();
  redirect('/');
}
