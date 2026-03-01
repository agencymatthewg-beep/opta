import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/api/audit';
import { isUuid } from '@/lib/api/policy';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_session_id' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'session.revoke');
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const revokedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('accounts_sessions')
    .update({ revoked_at: revokedAt })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id,user_id,device_id,session_type,expires_at,revoked_at')
    .maybeSingle();

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_sessions' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'session_not_found_or_revoked' }, { status: 404 });

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'session.revoke',
    riskLevel: 'medium',
    decision: 'allow',
    deviceId: data.device_id ?? null,
    context: { sessionId: id, sessionType: data.session_type },
  });

  return NextResponse.json({ ok: true, session: data });
}
