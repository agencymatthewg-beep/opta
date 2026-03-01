import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/api/audit';
import { RateLimiter } from '@/lib/rate-limit';

// 5 registrations per minute per IP
const rateLimiter = new RateLimiter(5, 60_000);

type RegisterBody = {
  deviceLabel?: string;
  platform?: string;
  fingerprintHash?: string;
  trustState?: 'trusted' | 'restricted' | 'quarantined' | 'revoked';
};

function normalizeFingerprint(input: string): string {
  return createHash('sha256').update(input).digest('hex');
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

  const body = (await request.json().catch(() => ({}))) as RegisterBody;
  const deviceLabel = body.deviceLabel?.trim() || 'Unknown device';
  const platform = body.platform?.trim() || 'unknown';
  const trustState = body.trustState ?? 'trusted';

  // Hardened Fingerprinting
  const rawFingerprint = body.fingerprintHash?.trim();
  const userAgent = request.headers.get('user-agent') || 'unknown_ua';
  const fingerprintHash = rawFingerprint
    ? normalizeFingerprint(`${rawFingerprint}|${requestIp}|${userAgent}`)
    : null;

  const { data, error } = await supabase
    .from('accounts_devices')
    .upsert(
      {
        user_id: user.id,
        device_label: deviceLabel,
        platform,
        fingerprint_hash: fingerprintHash,
        trust_state: trustState,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,fingerprint_hash' },
    )
    .select('id')
    .single();

  if (error?.code === 'PGRST205') {
    return NextResponse.json({ error: 'schema_missing_accounts_devices' }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditEvent(supabase, {
    userId: user.id,
    eventType: 'device.register',
    riskLevel: 'low',
    decision: 'allow',
    deviceId: data?.id ?? null,
    context: { platform, trustState },
  });

  return NextResponse.json({ ok: true, deviceId: data?.id ?? null });
}
