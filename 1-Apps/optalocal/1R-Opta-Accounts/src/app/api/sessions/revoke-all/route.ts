import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/api/audit';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';

export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'session.revoke');
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('accounts_sessions')
    .update({ revoked_at: now })
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_sessions' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'session.revoke_all',
    riskLevel: 'medium',
    decision: 'allow',
    context: { revokedAt: now },
  });

  if (signOutError) {
    return NextResponse.json({ ok: true, warning: signOutError.message });
  }

  return NextResponse.json({ ok: true, revokedAt: now });
}
