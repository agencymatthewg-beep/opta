import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, parseString, isUuid } from '@/lib/api/policy';
import { writeAuditEvent } from '@/lib/api/audit';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';
import { RateLimiter } from '@/lib/rate-limit';
import {
  getDeviceCommand,
  resolveBridgeTokenClaimsFromSecret,
  storeDeviceCommandResult,
} from '@/lib/control-plane/store';
import type { DeviceCommandResult } from '@/lib/control-plane/types';

const resultLimiter = new RateLimiter(240, 60_000);

type RouteContext = { params: Promise<{ id: string }> };

type CommandResultBody = {
  deviceId?: string;
  status?: DeviceCommandResult['status'];
  result?: Record<string, unknown>;
  error?: string;
  resultHash?: string;
};

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const trimmed = auth.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

function parseStatus(value: unknown): DeviceCommandResult['status'] | null {
  if (value === 'completed' || value === 'failed' || value === 'denied') return value;
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const requestIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!resultLimiter.check(requestIp)) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_command_id' }, { status: 400 });
  }

  const existing = await getDeviceCommand(id);
  if (!existing) {
    return NextResponse.json({ error: 'command_not_found' }, { status: 404 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const body = asObject((await request.json().catch(() => ({}))) as CommandResultBody);
  const deviceId = parseString(body.deviceId, 64);
  const status = parseStatus(body.status);
  const error = parseString(body.error, 1000);
  const resultHash = parseString(body.resultHash, 200);
  const result = asObject(body.result);

  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if (existing.deviceId !== deviceId) {
    return NextResponse.json({ error: 'command_device_mismatch' }, { status: 403 });
  }

  const bearer = getBearerToken(request);
  const bridgeClaims = bearer ? await resolveBridgeTokenClaimsFromSecret(bearer) : null;
  let actorUserId: string | null = null;

  if (bridgeClaims) {
    if (bridgeClaims.deviceId !== deviceId) {
      return NextResponse.json({ error: 'bridge_token_device_mismatch' }, { status: 403 });
    }
    if (!bridgeClaims.scopes.includes('device.commands.consume')) {
      return NextResponse.json({ error: 'bridge_token_scope_denied' }, { status: 403 });
    }
    actorUserId = bridgeClaims.userId;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'device.commands.consume');
    if (!authz.ok && authz.error !== 'schema_missing_accounts_capability_grants') {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }
    actorUserId = user.id;
  }

  const updated = await storeDeviceCommandResult(
    {
      id,
      deviceId,
      result: {
        status,
        result,
        error: error ?? undefined,
        resultHash: resultHash ?? undefined,
      },
    },
    bridgeClaims ? undefined : { supabase },
  );
  if (!updated) {
    return NextResponse.json({ error: 'command_not_found' }, { status: 404 });
  }

  if (actorUserId) {
    await writeAuditEvent(supabase, {
      userId: actorUserId,
      eventType: 'device.command.result',
      riskLevel: status === 'completed' ? 'low' : 'high',
      decision: status === 'completed' ? 'allow' : 'deny',
      deviceId,
      context: { commandId: id, status, resultHash: updated.resultHash },
    });
  }

  return NextResponse.json({ ok: true, command: updated });
}
