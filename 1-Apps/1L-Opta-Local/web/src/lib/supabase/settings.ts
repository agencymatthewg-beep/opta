/**
 * Supabase user_settings Server Actions.
 *
 * Read/write per-user LMX connection settings stored in the
 * user_settings table. These settings sync across devices via
 * Supabase, replacing the old localStorage-only approach.
 */

'use server';

import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSettings {
  lmx_host: string;
  lmx_port: number;
  admin_key_encrypted: string | null;
  tunnel_url: string | null;
  use_tunnel: boolean;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch the authenticated user's connection settings from Supabase. */
export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .select('lmx_host, lmx_port, admin_key_encrypted, tunnel_url, use_tunnel')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;
  return data as UserSettings;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Upsert the authenticated user's connection settings to Supabase. */
export async function saveUserSettings(
  settings: Partial<UserSettings>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const { error } = await supabase.from('user_settings').upsert({
    user_id: user.id,
    ...settings,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
