import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, isUuid, parseString } from '@/lib/api/policy';
import { writeAuditEvent } from '@/lib/api/audit';
import { claimPairingSession, getPairingSession } from '@/lib/control-plane/store';
import { buildPairingSessionMetadata } from '@/lib/control-plane/types';

type RouteContext = { params: Promise<{ id: string }> };

type ClaimBody = {
  deviceId?: string;
  deviceLabel?: string;
  bridgeTokenId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_pairing_session_id' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const existing = await getPairingSession(id, { supabase });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'pairing_session_not_found' }, { status: 404 });
  }

  if (existing.status === 'expired' || existing.status === 'cancelled') {
    return NextResponse.json({ error: `pairing_session_${existing.status}` }, { status: 409 });
  }

  const body = asObject((await request.json().catch(() => ({}))) as ClaimBody);
  const deviceId = parseString(body.deviceId, 64);
  const deviceLabel = parseString(body.deviceLabel, 120);
  const bridgeTokenId = parseString(body.bridgeTokenId, 64);

  if (deviceId && !isUuid(deviceId)) {
    return NextResponse.json({ error: 'invalid_device_id' }, { status: 400 });
  }

  const session = await claimPairingSession(
    {
      id,
      userId: user.id,
      deviceId: deviceId ?? null,
      deviceLabel: deviceLabel ?? null,
      bridgeTokenId: bridgeTokenId ?? null,
    },
    { supabase },
  );

  if (!session) {
    return NextResponse.json({ error: 'pairing_session_not_found' }, { status: 404 });
  }

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'pairing.session.claim',
    riskLevel: 'medium',
    decision: 'allow',
    deviceId: session.deviceId,
    context: {
      sessionId: session.id,
      status: session.status,
    },
  });

  return NextResponse.json({
    ok: true,
    session,
    metadata: buildPairingSessionMetadata(session),
  });
}
