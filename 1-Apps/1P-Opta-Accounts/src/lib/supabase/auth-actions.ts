'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/allowed-redirects';

export type PasswordAuthResult = {
  ok: boolean;
  error?: string;
};

type PasswordIdentifierPayload = { email: string } | { phone: string };

function routePasswordIdentifier(
  identifier: string,
): PasswordIdentifierPayload | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return { email: trimmed.toLowerCase() };
  }

  const digits = trimmed.replace(/[\s\-().]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) return null;
  return { phone: trimmed.replace(/\s+/g, '') };
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Google OAuth — redirects to Google consent screen.
 * After sign-in, Supabase redirects back to /auth/callback.
 */
export async function signInWithGoogle(redirectAfter?: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const callbackUrl = new URL(
    '/auth/callback',
    process.env.NEXT_PUBLIC_SITE_URL,
  );
  if (redirectAfter) {
    callbackUrl.searchParams.set('next', redirectAfter);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl.toString() },
  });
  if (error) throw error;
  if (data.url) redirect(data.url);
}

/**
 * Apple OAuth — redirects to Apple consent screen.
 */
export async function signInWithApple(redirectAfter?: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const callbackUrl = new URL(
    '/auth/callback',
    process.env.NEXT_PUBLIC_SITE_URL,
  );
  if (redirectAfter) {
    callbackUrl.searchParams.set('next', redirectAfter);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: callbackUrl.toString() },
  });
  if (error) throw error;
  if (data.url) redirect(data.url);
}

/**
 * Email/phone + password sign-in.
 */
export async function signInWithPassword(
  identifier: string,
  password: string,
): Promise<PasswordAuthResult> {
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

    const payload = routePasswordIdentifier(identifier);
    if (!payload) return { ok: false, error: 'Enter a valid email or phone.' };
    if (!password) return { ok: false, error: 'Enter your password.' };

    const { error } = await supabase.auth.signInWithPassword({
      ...payload,
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: getAuthErrorMessage(error, 'Unable to sign in. Please try again.'),
    };
  }
}

/**
 * Email/phone + password sign-up.
 */
export async function signUpWithPassword(
  identifier: string,
  password: string,
  name?: string,
): Promise<PasswordAuthResult> {
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

    const payload = routePasswordIdentifier(identifier);
    if (!payload) return { ok: false, error: 'Enter a valid email or phone.' };
    if (!password) return { ok: false, error: 'Enter your password.' };

    const trimmedName = name?.trim();

    const { error } = await supabase.auth.signUp({
      ...payload,
      password,
      options: trimmedName
        ? { data: { name: trimmedName, full_name: trimmedName } }
        : undefined,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: getAuthErrorMessage(
        error,
        'Unable to sign up. Please try again.',
      ),
    };
  }
}

/**
 * Sign out and redirect.
 */
export async function signOut(redirectTo?: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured');
  await supabase.auth.signOut();
  redirect(sanitizeRedirect(redirectTo) || '/sign-in');
}
