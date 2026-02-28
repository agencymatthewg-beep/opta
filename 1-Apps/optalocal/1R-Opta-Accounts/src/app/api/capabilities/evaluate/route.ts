import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, HIGH_RISK_SCOPES, isIsoDateInPast, isUuid, parseString } from '@/lib/api/policy';

type Decision = 'allow' | 'deny' | 'step_up';

type EvalRequest = {
  scope?: string;
  deviceId?: string;
  context?: Record<string, unknown>;
};

function isValidScope(value: string): boolean {
  return /^[a-z]+(?:\.[a-z_]+)+$/.test(value);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ allow: false, reason: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ allow: false, reason: 'unauthenticated' }, { status: 401 });

  const body = asObject((await request.json().catch(() => ({}))) as EvalRequest);
  const scope = parseString(body.scope, 120);
  const deviceId = parseString(body.deviceId, 64);
  const contextObj = asObject(body.context);

  if (!scope || !isValidScope(scope)) {
    return NextResponse.json({ allow: false, reason: 'invalid_scope' }, { status: 400 });
  }

  if (deviceId && !isUuid(deviceId)) {
    return NextResponse.json({ allow: false, reason: 'invalid_device_id' }, { status: 400 });
  }

  if (Object.keys(contextObj).length > 24) {
    return NextResponse.json({ allow: false, reason: 'context_too_large' }, { status: 400 });
  }

  if (deviceId) {
    const { data: device, error: deviceErr } = await supabase
      .from('accounts_devices')
      .select('trust_state')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (deviceErr?.code === 'PGRST205') {
      return NextResponse.json({ allow: false, reason: 'schema_missing_accounts_devices' }, { status: 503 });
    }
    if (deviceErr) {
      return NextResponse.json({ allow: false, reason: deviceErr.message }, { status: 500 });
    }

    const trust = typeof device?.trust_state === 'string' ? device.trust_state : null;
    if (!trust || trust === 'revoked' || trust === 'quarantined') {
      return NextResponse.json({ allow: false, decision: 'deny' as Decision, reason: 'device_not_trusted' }, { status: 403 });
    }

    if (trust === 'restricted' && HIGH_RISK_SCOPES.has(scope)) {
      return NextResponse.json({ allow: false, decision: 'step_up' as Decision, reason: 'restricted_device_high_risk' }, { status: 403 });
    }
  }

  const query = supabase
    .from('accounts_capability_grants')
    .select('granted, expires_at')
    .eq('user_id', user.id)
    .eq('scope', scope)
    .order('created_at', { ascending: false })
    .limit(1);

  const scoped = deviceId ? query.eq('device_id', deviceId) : query.is('device_id', null);
  const { data, error } = await scoped;

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ allow: false, reason: 'schema_missing_accounts_capability_grants' }, { status: 503 });
  }
  if (error) {
    return NextResponse.json({ allow: false, reason: error.message }, { status: 500 });
  }

  const grant = data?.[0];
  const allow = Boolean(grant?.granted) && !isIsoDateInPast(grant?.expires_at ?? null);

  return NextResponse.json({
    allow,
    decision: (allow ? 'allow' : 'deny') as Decision,
    scope,
    reason: allow ? 'grant_found' : 'no_active_grant',
  }, { status: allow ? 200 : 403 });
}
