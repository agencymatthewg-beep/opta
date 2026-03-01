import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/api/audit';
import { asObject, parseTrustState, isUuid } from '@/lib/api/policy';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }

  const body = asObject(await request.json().catch(() => ({})));
  const trustState = parseTrustState(body.trustState);
  if (!trustState) {
    return NextResponse.json({ error: 'invalid_trust_state' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'device.manage');
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const { data, error } = await supabase
    .from('accounts_devices')
    .update({ trust_state: trustState, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id,device_label,platform,trust_state,last_seen_at,last_ip,updated_at')
    .maybeSingle();

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_devices' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'device_not_found' }, { status: 404 });

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'device.trust_change',
    riskLevel: 'medium',
    decision: 'allow',
    deviceId: data.id,
    context: { trustState: data.trust_state },
  });

  return NextResponse.json({ ok: true, device: data });
}
