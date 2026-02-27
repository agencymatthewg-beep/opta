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

export type PasswordAuthResult = {
  ok: boolean;
  error?: string;
};

type PasswordIdentifierPayload = { email: string } | { phone: string };

function routePasswordIdentifier(identifier: string): PasswordIdentifierPayload | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return { email: trimmed.toLowerCase() };
  }

  const phone = trimmed.replace(/[\s\-().+]/g, '');
  if (!phone || !/^\d{7,15}$/.test(phone)) return null;

  // Preserve original formatting for E.164 (e.g. leading + and spaces stripped)
  const formattedPhone = trimmed.replace(/\s+/g, '');
  return { phone: formattedPhone };
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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
 * Sign in with email+password or phone+password.
 * Returns a structured result without redirecting.
 */
export async function signInWithPasswordIdentifier(
  identifier: string,
  password: string,
): Promise<PasswordAuthResult> {
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

    const identifierPayload = routePasswordIdentifier(identifier);
    if (!identifierPayload) {
      return { ok: false, error: 'Enter a valid email or phone.' };
    }
    if (!password) return { ok: false, error: 'Enter your password.' };

    const { error } = await supabase.auth.signInWithPassword({
      ...identifierPayload,
      password,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: getAuthErrorMessage(error, 'Unable to sign in right now. Please try again.'),
    };
  }
}

/**
 * Sign up with email+password or phone+password.
 * Returns a structured result without redirecting.
 */
export async function signUpWithPasswordIdentifier(
  identifier: string,
  password: string,
  name?: string,
): Promise<PasswordAuthResult> {
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

    const identifierPayload = routePasswordIdentifier(identifier);
    if (!identifierPayload) {
      return { ok: false, error: 'Enter a valid email or phone.' };
    }
    if (!password) return { ok: false, error: 'Enter your password.' };

    const trimmedName = name?.trim();

    const { error } = await supabase.auth.signUp({
      ...identifierPayload,
      password,
      options: trimmedName
        ? {
            data: {
              name: trimmedName,
              full_name: trimmedName,
            },
          }
        : undefined,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: getAuthErrorMessage(error, 'Unable to sign up right now. Please try again.'),
    };
  }
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
