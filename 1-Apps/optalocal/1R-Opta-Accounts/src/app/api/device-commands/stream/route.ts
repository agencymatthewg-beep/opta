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

export const dynamic = 'force-dynamic';

const streamLimiter = new RateLimiter(240, 60_000);

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

  const acceptHeader = request.headers.get('accept')?.toLowerCase() ?? '';
  const wantsSse = acceptHeader.includes('text/event-stream');
  if (!wantsSse) {
    return NextResponse.json(
      {
        ok: true,
        commands,
        delivered: commands.length,
      },
      { status: 200 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: connected\ndata: {"ok":true}\n\n'));
      for (const command of commands) {
        controller.enqueue(encoder.encode(`event: command\ndata: ${JSON.stringify(command)}\n\n`));
      }
      controller.enqueue(
        encoder.encode(
          `event: end\ndata: ${JSON.stringify({ ok: true, delivered: commands.length })}\n\n`,
        ),
      );
      controller.close();
    },
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
