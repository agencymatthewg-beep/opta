import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/api/audit';
import { RateLimiter } from '@/lib/rate-limit';

// Global rate limiter for revokes (10 per minute per IP to prevent spam)
const rateLimiter = new RateLimiter(10, 60_000);

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Await the params according to Next.js 15
) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!rateLimiter.check(ip)) {
        return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
    }

    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const resolvedParams = await params;
    const deviceId = resolvedParams.id;

    if (!deviceId) {
        return NextResponse.json({ error: 'missing_device_id' }, { status: 400 });
    }

    // Ensure the device belongs to the authenticated user before revoking
    const { data: device, error: checkError } = await supabase
        .from('accounts_devices')
        .select('id, device_label')
        .eq('id', deviceId)
        .eq('user_id', user.id)
        .single();

    if (checkError || !device) {
        return NextResponse.json({ error: 'device_not_found_or_unauthorized' }, { status: 404 });
    }

    // Revoke the device
    const { error: updateError } = await supabase
        .from('accounts_devices')
        .update({ trust_state: 'revoked' })
        .eq('id', deviceId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await writeAuditEvent(supabase, {
        userId: user.id,
        eventType: 'device.revoke',
        riskLevel: 'medium',
        decision: 'allow',
        deviceId: deviceId,
        context: {
            deviceLabel: device.device_label,
            reason: 'user_initiated_revocation'
        },
    });

    return NextResponse.json({ ok: true, message: 'Device revoked successfully' });
}
