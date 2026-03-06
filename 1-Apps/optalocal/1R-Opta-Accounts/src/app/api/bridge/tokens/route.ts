import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, parseString, isUuid } from '@/lib/api/policy';
import { writeAuditEvent } from '@/lib/api/audit';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';
import { RateLimiter } from '@/lib/rate-limit';
import { createBridgeToken } from '@/lib/control-plane/store';
import { buildBridgeTokenMetadata } from '@/lib/control-plane/types';

const rateLimiter = new RateLimiter(30, 60_000);

type MintBridgeTokenBody = {
  deviceId?: string;
  scopes?: string[];
  ttlSeconds?: number;
};

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 120 && /^[a-z]+(?:\.[a-z_]+)+$/.test(item))
    .slice(0, 32);
}

function normalizeTtlSeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  if (rounded < 60 || rounded > 86_400) return undefined;
  return rounded;
}

export async function POST(request: Request) {
  const requestIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!rateLimiter.check(requestIp)) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const authz = await requireScopeOrPrivilegedRole(supabase, user.id, 'bridge.tokens.issue');
  if (!authz.ok && authz.error !== 'schema_missing_accounts_capability_grants') {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const body = asObject((await request.json().catch(() => ({}))) as MintBridgeTokenBody);
  const deviceId = parseString(body.deviceId, 64);
  const scopes = normalizeScopes(body.scopes);
  const ttlSeconds = normalizeTtlSeconds(body.ttlSeconds);

  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }
  if (scopes.length === 0) {
    return NextResponse.json({ error: 'invalid_scopes' }, { status: 400 });
  }

  const { data: device, error: deviceError } = await supabase
    .from('accounts_devices')
    .select('trust_state')
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

  const minted = await createBridgeToken(
    {
      userId: user.id,
      deviceId,
      trustState: typeof device.trust_state === 'string' ? device.trust_state : null,
      scopes,
      ttlSeconds,
    },
    { supabase },
  );

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'bridge.token.mint',
    riskLevel: 'high',
    decision: 'allow',
    deviceId,
    context: {
      tokenId: minted.claims.tokenId,
      scopes: minted.claims.scopes,
      expiresAt: minted.claims.expiresAt,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      token: minted.token,
      claims: minted.claims,
      metadata: buildBridgeTokenMetadata(minted.claims),
    },
    { status: 201 },
  );
}
