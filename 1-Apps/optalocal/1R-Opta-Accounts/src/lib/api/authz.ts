import type { SupabaseClient } from '@supabase/supabase-js';

type AuthzResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function requireScopeOrPrivilegedRole(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
): Promise<AuthzResult> {
  const { data: profile, error: profileError } = await supabase
    .from('accounts_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError?.code === 'PGRST205') {
    return { ok: false, status: 503, error: 'schema_missing_accounts_profiles' };
  }
  if (profileError) return { ok: false, status: 500, error: profileError.message };

  if (profile?.role === 'owner' || profile?.role === 'admin') {
    return { ok: true };
  }

  const { data: grants, error: grantError } = await supabase
    .from('accounts_capability_grants')
    .select('granted,expires_at')
    .eq('user_id', userId)
    .eq('scope', scope)
    .is('device_id', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (grantError?.code === 'PGRST205') {
    return { ok: false, status: 503, error: 'schema_missing_accounts_capability_grants' };
  }
  if (grantError) return { ok: false, status: 500, error: grantError.message };

  const grant = grants?.[0];
  if (!grant?.granted) {
    return { ok: false, status: 403, error: 'forbidden' };
  }

  if (grant.expires_at && new Date(grant.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 403, error: 'forbidden' };
  }

  return { ok: true };
}
