import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseString, isUuid } from '@/lib/api/policy';
import { writeAuditEvent } from '@/lib/api/audit';
import { requireScopeOrPrivilegedRole } from '@/lib/api/authz';
import { RateLimiter } from '@/lib/rate-limit';
import {
  listDeviceCommandsForDelivery,
  resolveBridgeTokenClaimsFromSecret,
} from '@/lib/control-plane/store';
import { createCommandSSEStream } from '@/lib/control-plane/sse-hold';

export const dynamic = 'force-dynamic';

// Rate limiter for this endpoint.
//
// The original 240 req/min (≈ 4/sec) was sized for HTTP polling where the
// daemon would call every 250–300 ms.  With the new SSE hold approach the
// daemon opens one persistent connection every 25 s, which is ~2.4 req/min —
// far below this ceiling.  We keep the limiter as-is; it prevents abuse from
// clients that do not use the SSE path or that fail to hold the connection.
const streamLimiter = new RateLimiter(240, 60_000);

// SSE hold parameters (Node.js runtime — setInterval / setTimeout available).
const SSE_HOLD_DURATION_MS = 25_000;
const SSE_POLL_INTERVAL_MS = 3_000;
const SSE_KEEPALIVE_INTERVAL_MS = 10_000;

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const trimmed = auth.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function GET(request: Request) {
  const requestIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!streamLimiter.check(requestIp)) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const url = new URL(request.url);
  const deviceId = parseString(url.searchParams.get('deviceId'), 64);
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 20;

  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }

  const bearer = getBearerToken(request);
  const bridgeClaims = bearer ? await resolveBridgeTokenClaimsFromSecret(bearer) : null;

  // Bridge token was supplied but could not be resolved (expired / revoked / unknown).
  if (bearer && !bridgeClaims) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

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

  // Determine transport: JSON polling (legacy) vs. SSE hold (new).
  const acceptHeader = request.headers.get('accept')?.toLowerCase() ?? '';
  const wantsSse = acceptHeader.includes('text/event-stream');

  // -------------------------------------------------------------------------
  // JSON path — unchanged behaviour for non-SSE clients.
  // -------------------------------------------------------------------------
  if (!wantsSse) {
    const commands = await listDeviceCommandsForDelivery(
      { deviceId, limit },
      bridgeClaims ? undefined : { supabase },
    );

    if (actorUserId) {
      await writeAuditEvent(supabase, {
        userId: actorUserId,
        eventType: 'device.command.stream',
        riskLevel: 'medium',
        decision: 'allow',
        deviceId,
        context: { count: commands.length },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        commands,
        delivered: commands.length,
      },
      { status: 200 },
    );
  }

  // -------------------------------------------------------------------------
  // SSE hold path — fetch initial batch, then hold connection for up to 25 s
  // polling for new commands every 3 s and pushing them as they arrive.
  // -------------------------------------------------------------------------
  const initialCommands = await listDeviceCommandsForDelivery(
    { deviceId, limit },
    bridgeClaims ? undefined : { supabase },
  );

  if (actorUserId) {
    await writeAuditEvent(supabase, {
      userId: actorUserId,
      eventType: 'device.command.stream',
      riskLevel: 'medium',
      decision: 'allow',
      deviceId,
      context: { count: initialCommands.length, transport: 'sse' },
    });
  }

  // Capture auth context for use inside the polling closure.
  const storeOptions = bridgeClaims ? undefined : { supabase };

  const stream = createCommandSSEStream({
    initialCommands,
    pollIntervalMs: SSE_POLL_INTERVAL_MS,
    holdDurationMs: SSE_HOLD_DURATION_MS,
    keepaliveIntervalMs: SSE_KEEPALIVE_INTERVAL_MS,
    fetchNewCommands: (since) =>
      listDeviceCommandsForDelivery({ deviceId, limit, since }, storeOptions),
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
