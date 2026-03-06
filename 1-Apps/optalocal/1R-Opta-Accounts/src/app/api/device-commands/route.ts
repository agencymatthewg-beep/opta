import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, parseString, isUuid } from '@/lib/api/policy';
import { writeAuditEvent } from '@/lib/api/audit';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';
import { RateLimiter } from '@/lib/rate-limit';
import { createDeviceCommand } from '@/lib/control-plane/store';

const createLimiter = new RateLimiter(120, 60_000);

type CreateCommandBody = {
  deviceId?: string;
  command?: string;
  payload?: Record<string, unknown>;
  request?: Record<string, unknown>;
  scope?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const requestIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!createLimiter.check(requestIp)) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'device.commands.issue');
  if (!authz.ok && authz.error !== 'schema_missing_accounts_capability_grants') {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const body = asObject((await request.json().catch(() => ({}))) as CreateCommandBody);
  const deviceId = parseString(body.deviceId, 64);
  const requestPayload = asObject(body.request);
  const command = parseString(body.command, 120) ?? parseString(requestPayload.command, 120);
  const scope = parseString(body.scope, 120);
  const idempotencyKey = parseString(body.idempotencyKey, 120);
  const payload = asObject(body.payload);
  const normalizedPayload =
    Object.keys(payload).length > 0
      ? payload
      : (requestPayload.method && requestPayload.path
        ? {
            method: requestPayload.method,
            path: requestPayload.path,
            body: requestPayload.body,
          }
        : {});

  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }
  if (!command) {
    return NextResponse.json({ error: 'invalid_command' }, { status: 400 });
  }

  const { data: device, error: deviceError } = await supabase
    .from('accounts_devices')
    .select('id,trust_state')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (deviceError?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_devices' }, { status: 503 });
  }
  if (deviceError) return NextResponse.json({ error: deviceError.message }, { status: 500 });
  if (!device) return NextResponse.json({ error: 'device_not_found' }, { status: 404 });
  if (device.trust_state === 'revoked' || device.trust_state === 'quarantined') {
    return NextResponse.json({ error: 'device_not_trusted' }, { status: 403 });
  }

  const commandRecord = await createDeviceCommand(
    {
      userId: user.id,
      request: {
        deviceId,
        command,
        payload: normalizedPayload,
        scope: scope ?? null,
        idempotencyKey: idempotencyKey ?? null,
      },
    },
    { supabase },
  );

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'device.command.enqueue',
    riskLevel: 'high',
    decision: 'allow',
    deviceId,
    context: {
      commandId: commandRecord.id,
      command: commandRecord.command,
      scope: commandRecord.scope,
      idempotencyKey: commandRecord.idempotencyKey,
    },
  });

  return NextResponse.json({ ok: true, command: commandRecord }, { status: 201 });
}
