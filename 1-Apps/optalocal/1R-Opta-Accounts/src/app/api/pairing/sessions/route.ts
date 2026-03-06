import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, parseString, isUuid } from '@/lib/api/policy';
import { writeAuditEvent } from '@/lib/api/audit';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';
import { RateLimiter } from '@/lib/rate-limit';
import { createPairingSession } from '@/lib/control-plane/store';
import { buildPairingSessionMetadata } from '@/lib/control-plane/types';

const createLimiter = new RateLimiter(15, 60_000);

type CreatePairingBody = {
  deviceId?: string;
  deviceLabel?: string;
  capabilityScopes?: string[];
  ttlSeconds?: number;
};

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 120 && /^[a-z]+(?:\.[a-z_]+)+$/.test(item))
    .slice(0, 20);
}

function normalizeTtlSeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  if (rounded < 60 || rounded > 900) return undefined;
  return rounded;
}

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

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'pairing.sessions.manage');
  if (!authz.ok && authz.error !== 'schema_missing_accounts_capability_grants') {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const body = asObject((await request.json().catch(() => ({}))) as CreatePairingBody);
  const deviceId = parseString(body.deviceId, 64);
  const deviceLabel = parseString(body.deviceLabel, 120);
  const capabilityScopes = normalizeScopes(body.capabilityScopes);
  const ttlSeconds = normalizeTtlSeconds(body.ttlSeconds);

  if (deviceId && !isUuid(deviceId)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }

  const session = await createPairingSession(
    {
      userId: user.id,
      deviceId: deviceId ?? null,
      deviceLabel: deviceLabel ?? null,
      capabilityScopes,
      ttlSeconds,
    },
    { supabase },
  );

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'pairing.session.create',
    riskLevel: 'medium',
    decision: 'allow',
    deviceId: session.deviceId,
    context: {
      sessionId: session.id,
      scopes: session.capabilityScopes,
      expiresAt: session.expiresAt,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      session,
      metadata: buildPairingSessionMetadata(session),
    },
    { status: 201 },
  );
}
