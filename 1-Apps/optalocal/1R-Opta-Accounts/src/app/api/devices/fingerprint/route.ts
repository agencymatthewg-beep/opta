import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/devices/fingerprint?hash=<sha256hex>
 *
 * Looks up an existing device by fingerprint hash for the authenticated user.
 * Returns { deviceId: string } if found, { deviceId: null } if not.
 *
 * The fingerprint is hardened server-side with IP + User-Agent (same as
 * the register endpoint) before querying, so the caller sends the same
 * raw hash it would send to /api/devices/register.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const rawHash = url.searchParams.get('hash')?.trim();
  if (!rawHash) {
    return NextResponse.json({ error: 'hash query parameter is required' }, { status: 400 });
  }

  // Harden the fingerprint the same way the register endpoint does.
  const requestIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown_ua';
  const fingerprintHash = createHash('sha256')
    .update(`${rawHash}|${requestIp}|${userAgent}`)
    .digest('hex');

  const { data, error } = await supabase
    .from('accounts_devices')
    .select('id')
    .eq('user_id', user.id)
    .eq('fingerprint_hash', fingerprintHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deviceId: data?.id ?? null });
}
