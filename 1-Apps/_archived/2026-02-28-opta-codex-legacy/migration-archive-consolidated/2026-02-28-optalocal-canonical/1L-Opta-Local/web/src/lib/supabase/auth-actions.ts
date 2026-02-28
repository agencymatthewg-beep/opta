'use client';

import { createClient } from '@/lib/supabase/client';

export interface PasswordAuthResult {
  ok: boolean;
  error?: string;
}

function getCallbackUrl(): string {
  if (typeof window === 'undefined') return '/auth/callback';
  return `${window.location.origin}/auth/callback`;
}

function normalizeIdentifier(identifier: string): {
  email?: string;
  phone?: string;
} {
  const value = identifier.trim();
  if (value.includes('@')) return { email: value };
  return { phone: value };
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getCallbackUrl(),
    },
  });

  if (error) throw error;
}

export async function signInWithApple(): Promise<void> {
  const supabase = createClient();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: getCallbackUrl(),
    },
  });

  if (error) throw error;
}

export async function signInWithPasswordIdentifier(
  identifier: string,
  password: string,
): Promise<PasswordAuthResult> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const credentials = normalizeIdentifier(identifier);
  const { error } = credentials.email
    ? await supabase.auth.signInWithPassword({
        email: credentials.email,
        password,
      })
    : await supabase.auth.signInWithPassword({
        phone: credentials.phone ?? identifier.trim(),
        password,
      });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function signUpWithPasswordIdentifier(
  identifier: string,
  password: string,
  name?: string,
): Promise<PasswordAuthResult> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const credentials = normalizeIdentifier(identifier);
  const { error } = credentials.email
    ? await supabase.auth.signUp({
        email: credentials.email,
        password,
        options: {
          data: name ? { full_name: name } : undefined,
          emailRedirectTo: getCallbackUrl(),
        },
      })
    : await supabase.auth.signUp({
        phone: credentials.phone ?? identifier.trim(),
        password,
        options: {
          data: name ? { full_name: name } : undefined,
          emailRedirectTo: getCallbackUrl(),
        },
      });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
